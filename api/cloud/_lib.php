<?php
/**
 * Shared helpers for the /api/cloud/* endpoints.
 *
 *  - Provider-agnostic upload (Dropbox + Google Drive) over plain cURL so
 *    no extra composer dependencies are required.
 *  - Per-patient folder snapshotting + zip bundling.
 */

declare(strict_types=1);

// Suppress PHP warnings/notices from leaking into the JSON response body.
// Errors still go to Apache's error log (error_log() entries are unaffected).
// Without this, transient warnings like "mysqli::__construct(): connection
// refused" sneak into the response and break JSON.parse() on the client.
ini_set('display_errors', '0');
ini_set('html_errors',    '0');
error_reporting(E_ERROR | E_PARSE);

// Start an output buffer — anything PHP/other includes print to stdout
// (warnings, var_dump leftovers, the BOM from a config file, …) gets
// captured and DISCARDED by cloud_json() right before our real JSON is
// written. Guarantees the client always receives parseable JSON.
if (!ob_get_level()) ob_start();

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

/** Read + decode the JSON body of a POST request. */
function cloud_read_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function cloud_json($payload, int $code = 200): void {
    // Throw away anything other code accidentally wrote to stdout
    // (PHP warnings, stray whitespace, BOMs) so the client always sees
    // a pure JSON body it can parse.
    while (ob_get_level() > 0) { @ob_end_clean(); }
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($payload);
    exit;
}

function cloud_error(string $message, int $code = 400): void {
    cloud_json(['ok' => false, 'error' => $message], $code);
}

/** Sanitise a string for filesystem use (filenames, dir names). */
function cloud_safe_name(string $s, string $fallback = 'unknown'): string {
    $s = trim($s);
    if ($s === '') return $fallback;
    $s = preg_replace('/[^A-Za-z0-9._-]+/', '_', $s);
    return substr($s, 0, 80) ?: $fallback;
}

/* ─────────────────────────────────────────────────────────────
   Local data → temp working folder
   We build a directory tree under sys_get_temp_dir() that
   mirrors the bundle structure the user will see inside the zip,
   then zip the whole thing in one pass. The caller is
   responsible for cleaning it up.
   ───────────────────────────────────────────────────────────── */

function cloud_make_temp_dir(string $prefix = 'dcm-bundle-'): string {
    $base = sys_get_temp_dir() . DIRECTORY_SEPARATOR . uniqid($prefix, true);
    if (!mkdir($base, 0777, true) && !is_dir($base)) {
        cloud_error('Unable to create temp folder', 500);
    }
    return $base;
}

function cloud_rmtree(string $dir): void {
    if (!is_dir($dir)) return;
    $items = scandir($dir) ?: [];
    foreach ($items as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        is_dir($path) ? cloud_rmtree($path) : @unlink($path);
    }
    @rmdir($dir);
}

/** Zip a directory tree to a target file path. */
function cloud_zip_dir(string $sourceDir, string $zipPath): void {
    if (!class_exists('ZipArchive')) {
        cloud_error('PHP ZipArchive extension is required for cloud backup', 500);
    }
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        cloud_error('Cannot create zip at ' . $zipPath, 500);
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if ($file->isDir()) continue;
        $local = ltrim(str_replace($sourceDir, '', $file->getPathname()), DIRECTORY_SEPARATOR);
        $zip->addFile($file->getPathname(), str_replace(DIRECTORY_SEPARATOR, '/', $local));
    }
    $zip->close();
}

/* ─────────────────────────────────────────────────────────────
   Snapshot helpers — gather local data into the temp tree
   ───────────────────────────────────────────────────────────── */

/**
 *  Reports: read from the DB (`saved_reports` table is the modern home;
 *  fall back to `reports` if that exists instead) and write one HTML file
 *  per report under reports/<patient>/<report_id>.html.
 */
function cloud_snapshot_reports(string $tempDir, mysqli $db): int {
    $base = $tempDir . DIRECTORY_SEPARATOR . 'reports';
    @mkdir($base, 0777, true);
    $count = 0;
    $tableCandidates = ['saved_reports', 'reports'];
    foreach ($tableCandidates as $table) {
        $check = $db->query("SHOW TABLES LIKE '$table'");
        if (!$check || $check->num_rows === 0) continue;
        $res = $db->query("SELECT * FROM `$table`");
        if (!$res) continue;
        while ($row = $res->fetch_assoc()) {
            $patient = cloud_safe_name((string)($row['patient_name'] ?? $row['patient_id'] ?? 'unknown'));
            $patientDir = $base . DIRECTORY_SEPARATOR . $patient;
            @mkdir($patientDir, 0777, true);
            $reportId = cloud_safe_name((string)($row['id'] ?? $row['report_id'] ?? bin2hex(random_bytes(4))));
            $content = $row['content'] ?? $row['html'] ?? '';
            $studyDate = $row['study_date'] ?? '';
            $title  = htmlspecialchars((string)($row['title'] ?? 'Report'), ENT_QUOTES);
            $html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>$title</title></head><body>\n"
                  . "<h1>$title</h1>"
                  . ($studyDate ? "<p><b>Study date:</b> " . htmlspecialchars((string)$studyDate, ENT_QUOTES) . "</p>" : '')
                  . "<hr>\n" . $content . "\n</body></html>";
            file_put_contents($patientDir . DIRECTORY_SEPARATOR . "{$reportId}.html", $html);
            $count++;
        }
        break; // first matching table wins
    }
    return $count;
}

/**
 *  DICOM files: when the Orthanc storage path is reachable, group by
 *  PatientID using a simple DB lookup so each patient gets their own
 *  folder. If storage isn't reachable (e.g. cloud-only setup), skip.
 */
function cloud_snapshot_dicom(string $tempDir, mysqli $db): int {
    if (!defined('ORTHANC_STORAGE_PATH') || !is_dir(ORTHANC_STORAGE_PATH)) return 0;
    $base = $tempDir . DIRECTORY_SEPARATOR . 'dicom';
    @mkdir($base, 0777, true);
    $count = 0;
    // Best-effort patient grouping — use whatever patient → file mapping the
    // local DB exposes. If no such table exists, dump under "all/".
    $hasMap = (bool)$db->query("SHOW TABLES LIKE 'patient_studies'")?->num_rows;
    if ($hasMap) {
        $res = $db->query("SELECT patient_name, patient_id, file_path FROM patient_studies WHERE file_path IS NOT NULL");
        while ($res && ($row = $res->fetch_assoc())) {
            if (!$row['file_path'] || !file_exists($row['file_path'])) continue;
            $folder = cloud_safe_name((string)($row['patient_name'] ?: $row['patient_id']));
            $patientDir = $base . DIRECTORY_SEPARATOR . $folder;
            @mkdir($patientDir, 0777, true);
            @copy($row['file_path'], $patientDir . DIRECTORY_SEPARATOR . basename($row['file_path']));
            $count++;
        }
    } else {
        // Fallback: copy the entire Orthanc tree (warn: can be large)
        $all = $base . DIRECTORY_SEPARATOR . 'all';
        @mkdir($all, 0777, true);
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ORTHANC_STORAGE_PATH, RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->isDir()) continue;
            $local = str_replace(ORTHANC_STORAGE_PATH, '', $file->getPathname());
            $target = $all . $local;
            @mkdir(dirname($target), 0777, true);
            @copy($file->getPathname(), $target);
            $count++;
        }
    }
    return $count;
}

/**
 *  Study folders supplied by the client. The viewer / CR / Dual stores
 *  already know which local files the user has loaded (Electron mode),
 *  so the client sends a per-patient list of file paths and the server
 *  copies them into reports/<patient>/dicom/ inside the bundle.
 *
 *  This is the path that picks up ad-hoc studies the user opened from
 *  C:\Users\…\Downloads etc., which aren't in any DB table.
 *
 *  Input shape (from client):
 *    [ { "patient_name": "ALSAMIN MOMEEN", "patient_id": "P1", "files": ["C:\\…\\img1.dcm", …] } ]
 */
function cloud_snapshot_study_paths(string $tempDir, array $studies, array &$debug = null, array $alreadySynced = [], array &$syncedPaths = null): int {
    $base = $tempDir . DIRECTORY_SEPARATOR . 'studies';
    @mkdir($base, 0777, true);
    $count = 0;
    $skipped = [];
    $copied  = [];
    foreach ($studies as $study) {
        if (!is_array($study)) continue;
        $patient = cloud_safe_name((string)(
            $study['patient_name'] ?? $study['patient_id'] ?? 'unknown'
        ));
        $patientDir = $base . DIRECTORY_SEPARATOR . $patient;
        @mkdir($patientDir, 0777, true);
        foreach ((array)($study['files'] ?? []) as $src) {
            $src = (string)$src;
            if ($src === '') {
                $skipped[] = ['path' => '', 'reason' => 'empty'];
                continue;
            }
            // Check if this file was already synced — skip to avoid
            // re-uploading unchanged DICOM files on scheduled runs.
            $normForward = str_replace('\\', '/', $src);
            if (isset($alreadySynced[$normForward])) {
                $skipped[] = ['path' => $src, 'reason' => 'already_synced'];
                continue;
            }
            // Normalise Windows paths — viewer stores often use forward
            // slashes that confuse file_exists().
            $normalised = str_replace('/', DIRECTORY_SEPARATOR, $src);
            if (!file_exists($normalised)) {
                $skipped[] = ['path' => $src, 'reason' => 'missing'];
                continue;
            }
            if (!is_readable($normalised)) {
                $skipped[] = ['path' => $src, 'reason' => 'unreadable'];
                continue;
            }
            $dst = $patientDir . DIRECTORY_SEPARATOR . basename($normalised);
            if (@copy($normalised, $dst)) {
                $count++;
                $copied[] = $src;
                if ($syncedPaths !== null) $syncedPaths[] = $normForward;
            } else {
                $skipped[] = ['path' => $src, 'reason' => 'copy_failed'];
            }
        }
    }
    if ($debug !== null) {
        $debug['studies_copied']  = $copied;
        $debug['studies_skipped'] = $skipped;
    }
    return $count;
}

/**
 *  Walk the user-supplied folder(s) and copy every DICOM file in there,
 *  grouped by the Study Instance UID parsed straight from the DICOM header.
 *  This is what picks up the "3 studies in one folder" case — the viewer
 *  only displays one at a time, but the operator wants the whole folder
 *  backed up.
 *
 *  Each top-level folder becomes a bucket; inside, files are split into
 *  subfolders per Study UID so the bundle stays organised.
 */
function cloud_snapshot_study_folders(string $tempDir, array $folders, array &$debug = null, array $alreadySynced = [], array &$syncedPaths = null): int {
    $base = $tempDir . DIRECTORY_SEPARATOR . 'studies';
    @mkdir($base, 0777, true);
    $count = 0;
    $perFolder = [];
    foreach ($folders as $folder) {
        $folder = (string)$folder;
        if ($folder === '') continue;
        $normalised = str_replace('/', DIRECTORY_SEPARATOR, $folder);
        if (!is_dir($normalised)) {
            $perFolder[] = ['folder' => $folder, 'reason' => 'not_a_directory'];
            continue;
        }

        // Use the folder's basename as the bucket label so backups from
        // multiple unrelated folders don't collide.
        $bucket = cloud_safe_name(basename($normalised) ?: 'folder');
        $bucketDir = $base . DIRECTORY_SEPARATOR . $bucket;
        @mkdir($bucketDir, 0777, true);

        $perFolder[] = ['folder' => $folder, 'bucket' => $bucket, 'files' => 0, 'skipped_synced' => 0, 'unknown_study' => 0];
        $idx = count($perFolder) - 1;

        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($normalised, RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->isDir()) continue;
            $path = $file->getPathname();

            // Skip files the client has already backed up.
            $pathForward = str_replace('\\', '/', $path);
            if (isset($alreadySynced[$pathForward])) {
                $perFolder[$idx]['skipped_synced']++;
                continue;
            }

            // Cheap heuristic — DICOM files usually have a `DICM` magic
            // at byte 128, or end with .dcm / .dicom. Accept both.
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $isDicom = in_array($ext, ['dcm', 'dicom'], true);
            if (!$isDicom) {
                // Sniff the magic header without reading the whole file.
                $fp = @fopen($path, 'rb');
                if ($fp) {
                    @fseek($fp, 128);
                    $magic = @fread($fp, 4);
                    @fclose($fp);
                    $isDicom = $magic === 'DICM';
                }
            }
            if (!$isDicom) continue;

            $studyUid = cloud_extract_study_uid($path);
            $subdir   = $studyUid ? cloud_safe_name($studyUid, 'study') : 'unknown_study';
            $target   = $bucketDir . DIRECTORY_SEPARATOR . $subdir;
            @mkdir($target, 0777, true);
            if (@copy($path, $target . DIRECTORY_SEPARATOR . basename($path))) {
                $count++;
                $perFolder[$idx]['files']++;
                if ($syncedPaths !== null) $syncedPaths[] = $pathForward;
                if (!$studyUid) $perFolder[$idx]['unknown_study']++;
            }
        }
    }
    if ($debug !== null) $debug['folders'] = $perFolder;
    return $count;
}

/** Cheap DICOM Study Instance UID extractor — reads only the header,
 *  no full parser required. Returns null if not found. */
function cloud_extract_study_uid(string $path): ?string {
    $fp = @fopen($path, 'rb');
    if (!$fp) return null;
    // Skip the 128-byte preamble + DICM magic.
    @fseek($fp, 132);
    // Read up to 8 KB of header — plenty for Study UID which sits early.
    $buf = @fread($fp, 8192);
    @fclose($fp);
    if (!$buf) return null;
    // StudyInstanceUID = (0020,000D). Scan the bytes for that group/element.
    $needle = "\x20\x00\x0D\x00"; // little-endian
    $pos = strpos($buf, $needle);
    if ($pos === false) return null;
    // After group/element comes either Explicit VR ("UI" + 2-byte length)
    // or Implicit VR (4-byte length). Handle both pragmatically.
    $vr   = substr($buf, $pos + 4, 2);
    $isUI = ($vr === 'UI');
    $lenOffset = $pos + ($isUI ? 6 : 4);
    if ($isUI) {
        $len = unpack('v', substr($buf, $lenOffset, 2))[1] ?? 0;
        $val = substr($buf, $lenOffset + 2, $len);
    } else {
        $len = unpack('V', substr($buf, $lenOffset, 4))[1] ?? 0;
        $val = substr($buf, $lenOffset + 4, $len);
    }
    if ($len <= 0 || $len > 256) return null;
    return trim($val, " \0");
}

/**
 *  Templates: client sends them in the request body (they live in browser
 *  localStorage, server doesn't have direct access). Each template is
 *  written as a separate JSON file.
 */
function cloud_snapshot_templates(string $tempDir, array $templates): int {
    $dir = $tempDir . DIRECTORY_SEPARATOR . 'templates';
    @mkdir($dir, 0777, true);
    $n = 0;
    foreach ($templates as $tpl) {
        $name = cloud_safe_name((string)($tpl['name'] ?? 'template'));
        $id   = cloud_safe_name((string)($tpl['id']   ?? bin2hex(random_bytes(4))));
        file_put_contents($dir . DIRECTORY_SEPARATOR . "{$name}_{$id}.json", json_encode($tpl, JSON_PRETTY_PRINT));
        $n++;
    }
    return $n;
}

/**
 *  Branding: settings table dump (key/value pairs related to the brand /
 *  print header / footer). We export the whole settings table — small and
 *  always useful for restore.
 */
function cloud_snapshot_branding(string $tempDir, mysqli $db): int {
    $dir = $tempDir . DIRECTORY_SEPARATOR . 'branding';
    @mkdir($dir, 0777, true);
    $check = $db->query("SHOW TABLES LIKE 'settings'");
    if (!$check || $check->num_rows === 0) return 0;
    $res = $db->query("SELECT * FROM settings");
    if (!$res) return 0;
    $rows = [];
    while ($row = $res->fetch_assoc()) $rows[] = $row;
    file_put_contents($dir . DIRECTORY_SEPARATOR . 'settings.json', json_encode($rows, JSON_PRETTY_PRINT));
    return count($rows);
}

/* ─────────────────────────────────────────────────────────────
   Provider uploads
   ───────────────────────────────────────────────────────────── */

/** Generic cURL helper that returns [status, body]. */
function cloud_http(string $method, string $url, array $headers, $body): array {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 600,
        CURLOPT_SSL_VERIFYPEER => true,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $opts);
    $resp = curl_exec($ch);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return [0, $err];
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [(int)$status, (string)$resp];
}

function cloud_dropbox_upload(string $token, string $remotePath, string $localFile): array {
    $fp = fopen($localFile, 'rb'); if (!$fp) cloud_error('Cannot open zip for upload', 500);
    $body = stream_get_contents($fp); fclose($fp);
    $apiArg = json_encode([
        'path' => $remotePath,
        'mode' => 'add',
        'autorename' => true,
        'mute' => false,
    ]);
    [$status, $resp] = cloud_http('POST', 'https://content.dropboxapi.com/2/files/upload', [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/octet-stream',
        'Dropbox-API-Arg: ' . $apiArg,
    ], $body);
    if ($status < 200 || $status >= 300) cloud_error("Dropbox upload failed ($status): $resp", 500);
    return ['ok' => true, 'provider_response' => json_decode($resp, true)];
}

function cloud_dropbox_list(string $token, string $folder): array {
    $body = json_encode(['path' => $folder, 'recursive' => false]);
    [$status, $resp] = cloud_http('POST', 'https://api.dropboxapi.com/2/files/list_folder', [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ], $body);
    if ($status === 409) return ['entries' => []]; // empty folder / not found
    if ($status < 200 || $status >= 300) cloud_error("Dropbox list failed ($status): $resp", 500);
    $data = json_decode($resp, true) ?: [];
    $entries = [];
    foreach ($data['entries'] ?? [] as $e) {
        if (($e['.tag'] ?? '') !== 'file') continue;
        $entries[] = [
            'name'     => $e['name']           ?? '',
            'path'     => $e['path_lower']     ?? '',
            'size'     => (int)($e['size']     ?? 0),
            'modified' => $e['server_modified'] ?? '',
        ];
    }
    return ['entries' => $entries];
}

function cloud_dropbox_download(string $token, string $path): void {
    // Dropbox-API-Arg must be ASCII-only and non-curly JSON. Force the path
    // to forward-slash POSIX form and escape any non-ASCII bytes.
    $path = str_replace('\\', '/', $path);
    if ($path === '' || $path[0] !== '/') $path = '/' . ltrim($path, '/');
    $apiArg = json_encode(['path' => $path], JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);

    $ch = curl_init('https://content.dropboxapi.com/2/files/download');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Dropbox-API-Arg: ' . $apiArg,
        ],
        CURLOPT_TIMEOUT => 600,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status < 200 || $status >= 300) {
        // Dropbox returns its error as JSON in the response body — surface it
        // so the user sees the real reason rather than a bare HTTP code.
        $hint = '';
        $decoded = json_decode((string)$body, true);
        if (is_array($decoded)) {
            $hint = $decoded['error_summary'] ?? $decoded['error']['.tag'] ?? '';
            if (is_array($hint)) $hint = json_encode($hint);
        } elseif (is_string($body) && strlen($body) < 500) {
            $hint = $body;
        }
        cloud_error("Dropbox download failed ($status)" . ($hint ? " — $hint" : '') . " · path=$path", 500);
    }
    $name = basename($path);
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    echo $body;
    exit;
}

function cloud_gdrive_upload(string $token, string $remoteFolder, string $bundleName, string $localFile): array {
    // Ensure the folder exists — create it if missing (top-level under My Drive).
    $folderId = cloud_gdrive_ensure_folder($token, ltrim($remoteFolder, '/'));
    $metadata = json_encode([
        'name'    => $bundleName,
        'parents' => $folderId ? [$folderId] : [],
    ]);
    $boundary = 'dcm_boundary_' . bin2hex(random_bytes(8));
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: application/json; charset=UTF-8\r\n\r\n";
    $body .= $metadata . "\r\n";
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: application/zip\r\n\r\n";
    $body .= file_get_contents($localFile) . "\r\n";
    $body .= "--$boundary--";
    [$status, $resp] = cloud_http('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', [
        'Authorization: Bearer ' . $token,
        'Content-Type: multipart/related; boundary=' . $boundary,
    ], $body);
    if ($status < 200 || $status >= 300) cloud_error("Google Drive upload failed ($status): $resp", 500);
    return ['ok' => true, 'provider_response' => json_decode($resp, true)];
}

/** Find (or create) a top-level folder by name on Google Drive. */
function cloud_gdrive_ensure_folder(string $token, string $name): ?string {
    if ($name === '') return null;
    $q = urlencode("mimeType='application/vnd.google-apps.folder' and name='" . str_replace("'", "\\'", $name) . "' and trashed=false");
    [$status, $resp] = cloud_http('GET', "https://www.googleapis.com/drive/v3/files?q=$q&fields=files(id,name)", [
        'Authorization: Bearer ' . $token,
    ], null);
    if ($status >= 200 && $status < 300) {
        $data = json_decode($resp, true) ?: [];
        if (!empty($data['files'][0]['id'])) return (string)$data['files'][0]['id'];
    }
    // Create
    [$cs, $cr] = cloud_http('POST', 'https://www.googleapis.com/drive/v3/files', [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
    ], json_encode(['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder']));
    if ($cs >= 200 && $cs < 300) {
        $d = json_decode($cr, true) ?: [];
        return (string)($d['id'] ?? '');
    }
    return null;
}

function cloud_gdrive_list(string $token, string $folder): array {
    $folderId = cloud_gdrive_ensure_folder($token, ltrim($folder, '/'));
    if (!$folderId) return ['entries' => []];
    $q = urlencode("'$folderId' in parents and trashed=false");
    [$status, $resp] = cloud_http('GET', "https://www.googleapis.com/drive/v3/files?q=$q&fields=files(id,name,size,modifiedTime)", [
        'Authorization: Bearer ' . $token,
    ], null);
    if ($status < 200 || $status >= 300) cloud_error("Google Drive list failed ($status): $resp", 500);
    $data = json_decode($resp, true) ?: [];
    $entries = [];
    foreach ($data['files'] ?? [] as $f) {
        $entries[] = [
            'name'     => (string)($f['name']         ?? ''),
            'path'     => (string)($f['id']           ?? ''),
            'size'     => (int)   ($f['size']         ?? 0),
            'modified' => (string)($f['modifiedTime'] ?? ''),
        ];
    }
    return ['entries' => $entries];
}

function cloud_gdrive_download(string $token, string $fileId): void {
    $ch = curl_init("https://www.googleapis.com/drive/v3/files/$fileId?alt=media");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 600,
    ]);
    // Try to learn the original filename first
    $metaCh = curl_init("https://www.googleapis.com/drive/v3/files/$fileId?fields=name");
    curl_setopt_array($metaCh, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
    ]);
    $metaResp = curl_exec($metaCh);
    curl_close($metaCh);
    $name = 'backup.zip';
    if ($metaResp) {
        $m = json_decode($metaResp, true);
        if (!empty($m['name'])) $name = $m['name'];
    }
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status < 200 || $status >= 300) cloud_error("Google Drive download failed ($status)", 500);
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    echo $body;
    exit;
}
