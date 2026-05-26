<?php
/**
 * POST /api/cloud/backup.php
 *
 *  Snapshot the local data (reports / DICOM / templates / branding per
 *  user-selected scopes), zip it into a single bundle named
 *  `dcm-backup_YYYY-MM-DD_HHMM.zip`, and upload it to the configured
 *  provider (Dropbox / Google Drive).
 *
 *  Request body:
 *    {
 *      "provider":      "dropbox" | "google",
 *      "access_token":  "<bearer token>",
 *      "remote_folder": "/dcm-backups",
 *      "scopes":        { "reports": bool, "dicom": bool, "templates": bool, "branding": bool },
 *      "templates":     [ { id, name, content, type } ]   // optional; client-side localStorage payload
 *    }
 */

declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') cloud_error('POST only', 405);

$body         = cloud_read_body();
$provider     = (string)($body['provider']     ?? '');
$token        = trim((string)($body['access_token'] ?? ''));
$remoteFolder = (string)($body['remote_folder'] ?? '/dcm-backups');
$scopes       = (array) ($body['scopes']       ?? []);
$clientTpls   = (array) ($body['templates']    ?? []);
$studyPaths   = (array) ($body['study_paths']   ?? []);  // currently-loaded files
$studyFolders = (array) ($body['study_folders'] ?? []);  // parent folders to scan recursively

if (!in_array($provider, ['dropbox', 'google'], true)) cloud_error('Unsupported provider', 400);
if ($token === '') cloud_error('Access token is required', 400);

// Only open a DB connection if a scope that actually needs it is enabled —
// otherwise a backup of templates / studies / branding-from-files can still
// succeed when MySQL isn't running (e.g. local-only sync sessions).
$db = null;
$needsDb = !empty($scopes['reports']) || !empty($scopes['dicom']) || !empty($scopes['branding']);
if ($needsDb && function_exists('getDbConnection')) {
    try {
        $db = getDbConnection();
    } catch (\Throwable $e) {
        // DB is unreachable but the user asked for DB-backed scopes. Keep
        // going with $db=null so the file-system scopes still complete;
        // the affected snapshotter calls below will simply contribute 0
        // and the manifest will reflect that.
        error_log('[cloud/backup] DB unreachable, continuing without it: ' . $e->getMessage());
    }
}
$tempDir = cloud_make_temp_dir();
$counts = ['reports' => 0, 'dicom' => 0, 'studies' => 0, 'templates' => 0, 'branding' => 0];

try {
    if (!empty($scopes['reports'])   && $db) $counts['reports']   = cloud_snapshot_reports($tempDir, $db);
    if (!empty($scopes['dicom'])     && $db) $counts['dicom']     = cloud_snapshot_dicom($tempDir, $db);
    // Client-supplied study folders: included whenever the DICOM scope is on,
    // regardless of whether a DB mapping exists. This is the path that
    // captures ad-hoc local imports (Downloads folder, network shares).
    $studyDebug  = [];
    $folderDebug = [];
    if (!empty($scopes['dicom']) && $studyPaths) {
        $counts['studies'] = cloud_snapshot_study_paths($tempDir, $studyPaths, $studyDebug);
    }
    // Walk each parent folder for ALL DICOMs (covers the case where the
    // viewer only loaded one study from a folder of many). Grouped by
    // Study Instance UID inside the bundle.
    if (!empty($scopes['dicom']) && $studyFolders) {
        $counts['studies'] += cloud_snapshot_study_folders($tempDir, $studyFolders, $folderDebug);
    }
    if (!empty($scopes['templates']))        $counts['templates'] = cloud_snapshot_templates($tempDir, $clientTpls);
    if (!empty($scopes['branding'])  && $db) $counts['branding']  = cloud_snapshot_branding($tempDir, $db);

    // Always include a manifest.json describing what's in the bundle so a
    // restore tool can understand it without guesswork.
    file_put_contents($tempDir . DIRECTORY_SEPARATOR . 'manifest.json', json_encode([
        'created_at'   => gmdate('c'),
        'scopes'       => $scopes,
        'counts'       => $counts,
        'app'          => defined('APP_NAME')    ? APP_NAME    : 'One Clickz',
        'app_version'  => defined('APP_VERSION') ? APP_VERSION : '',
    ], JSON_PRETTY_PRINT));

    $timeline   = gmdate('Y-m-d_Hi');
    $bundleName = "dcm-backup_{$timeline}.zip";
    $zipPath    = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $bundleName;
    cloud_zip_dir($tempDir, $zipPath);

    if ($provider === 'dropbox') {
        $remotePath = rtrim($remoteFolder, '/') . '/' . $bundleName;
        cloud_dropbox_upload($token, $remotePath, $zipPath);
    } else {
        cloud_gdrive_upload($token, $remoteFolder, $bundleName, $zipPath);
    }

    $bytes = filesize($zipPath);
    @unlink($zipPath);
    cloud_rmtree($tempDir);

    cloud_json([
        'ok'          => true,
        'bundle_name' => $bundleName,
        'bytes'       => (int)$bytes,
        'counts'      => $counts,
        'debug'       => [
            'study_paths_received' => array_map(static function ($s) {
                return [
                    'patient' => $s['patient_name'] ?? $s['patient_id'] ?? '',
                    'files'   => count((array)($s['files'] ?? [])),
                ];
            }, $studyPaths),
            'study_folders_received' => $studyFolders,
            'studies'        => $studyDebug,
            'folder_scan'    => $folderDebug,
        ],
    ]);
} catch (\Throwable $e) {
    cloud_rmtree($tempDir);
    cloud_error($e->getMessage(), 500);
}
