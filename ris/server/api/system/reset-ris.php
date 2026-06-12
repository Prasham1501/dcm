<?php
/**
 * Clear RIS data so a clinic can start over without deleting app users or
 * license data.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/worklist_dir.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

$input = json_decode(file_get_contents('php://input'), true) ?: [];
if (($input['confirm'] ?? '') !== 'RESET RIS') {
    sendErrorResponse('Type RESET RIS to clear RIS data', 400);
}

try {
    $db = getDbConnection();
    $tables = [
        'ris_commission_entries',
        'ris_commission_payouts',
        'pcpndt_form_f',
        'pcpndt_portal_credentials',
        'ris_test_results',
        'ris_test_ref_ranges',
        'ris_test_parameters',
        'ris_result_assets',
        'ris_receipts',
        'ris_payments',
        'ris_center_invoices',
        'ris_outbox',
        'ris_orders',
        'ris_visits',
        'ris_patients',
        'ris_referring_doctors',
        'ris_services',
        'ris_centers',
        'ris_pros',
        'ris_lookups',
        'cached_studies',
        'cached_patients',
        'dicom_nodes',
    ];
    $cleared = [];

    $db->query('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($tables as $table) {
        $exists = $db->query("SHOW TABLES LIKE '" . $db->real_escape_string($table) . "'");
        if ($exists && $exists->num_rows > 0) {
            $db->query("TRUNCATE TABLE `$table`");
            $cleared[] = $table;
        }
    }
    $db->query('SET FOREIGN_KEY_CHECKS = 1');

    $counterDefaults = [
        'mrn' => 'P',
        'accession' => 'OCZ',
        'receipt' => 'RCP',
        'visit' => 'V',
    ];
    $stmt = $db->prepare(
        "INSERT INTO app_counters (name, current_value, prefix)
         VALUES (?, 0, ?)
         ON DUPLICATE KEY UPDATE current_value = 0, prefix = VALUES(prefix)"
    );
    $reset = [];
    foreach ($counterDefaults as $counter => $prefix) {
        $stmt->bind_param('ss', $counter, $prefix);
        $stmt->execute();
        $reset[] = $counter;
    }
    $stmt->close();

    $settingKeys = [
        'clinic_state',
        'accession_prefix',
        'default_station_ae',
        'worklist_dir',
        'dicom_uid_root',
        'brand_name',
        'brand_tagline',
        'brand_phone',
        'brand_email',
        'brand_address',
        'brand_website',
        'brand_logo_image',
        'receipt_header',
        'receipt_footer',
        'receipt_paper_size',
        'receipt_signature_label',
        'receipt_signature_image',
        'receipt_stamp_image',
        'gst_number',
        'default_tax_percentage',
        'commission_enabled',
        'pcpndt_registration_no',
        'barcode_label_width_mm',
        'barcode_label_height_mm',
        'smtp_host',
        'smtp_port',
        'smtp_user',
        'smtp_pass',
        'smtp_from',
        'smtp_secure',
        'integration_api_key',
        'analyzer_graph_source_dirs',
        'analyzer_graph_extensions',
        'orthanc_dicom_port',
    ];
    $deletedSettings = 0;
    $settingStmt = $db->prepare('DELETE FROM hospital_settings WHERE setting_key = ?');
    foreach ($settingKeys as $key) {
        $settingStmt->bind_param('s', $key);
        $settingStmt->execute();
        $deletedSettings += max(0, $settingStmt->affected_rows);
    }
    $settingStmt->close();

    // Wipe the on-disk Modality Worklist (.wl files watched by Orthanc).
    // Truncating ris_orders alone leaves stale worklist entries visible to
    // modalities until a new order overwrites them.
    $worklistCleared = 0;
    try {
        $wlDir = ris_worklist_dir($db);
        if (is_dir($wlDir)) {
            foreach (glob(rtrim($wlDir, "/\\") . DIRECTORY_SEPARATOR . '*.wl') ?: [] as $wl) {
                if (@unlink($wl)) { $worklistCleared++; }
            }
        }
    } catch (Throwable $wlErr) {
        logMessage('RIS reset worklist cleanup error: ' . $wlErr->getMessage(), 'warning', 'ris.log');
    }

    $assetFilesCleared = 0;
    try {
        $assetFilesCleared = ris_delete_directory_contents(__DIR__ . '/../../data/ris_graphs');
    } catch (Throwable $assetErr) {
        logMessage('RIS reset graph/image cleanup error: ' . $assetErr->getMessage(), 'warning', 'ris.log');
    }

    $orthancDeleted = 0;
    try {
        $patients = ris_orthanc_json('GET', '/patients');
        if (is_array($patients)) {
            foreach ($patients as $patientId) {
                $res = ris_orthanc_request('DELETE', '/patients/' . rawurlencode((string)$patientId));
                if ($res['code'] >= 200 && $res['code'] < 300) { $orthancDeleted++; }
            }
        }
    } catch (Throwable $orthancErr) {
        logMessage('RIS reset Orthanc cleanup error: ' . $orthancErr->getMessage(), 'warning', 'ris.log');
    }

    logAuditEvent((int)(getCurrentUser()['id'] ?? 0), 'reset', 'ris_data', null, 'Cleared RIS data, settings, tests, masters, DICOM nodes, worklist files, and machine attachments');
    sendSuccessResponse(
        [
            'cleared' => $cleared,
            'counters_reset' => $reset,
            'settings_removed' => $deletedSettings,
            'worklist_files_removed' => $worklistCleared,
            'asset_files_removed' => $assetFilesCleared,
            'orthanc_patients_deleted' => $orthancDeleted,
        ],
        'RIS data cleared'
    );
} catch (Throwable $e) {
    try { getDbConnection()->query('SET FOREIGN_KEY_CHECKS = 1'); } catch (Throwable) {}
    logMessage('RIS reset error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ris_orthanc_json(string $method, string $path): mixed
{
    $res = ris_orthanc_request($method, $path);
    if ($res['code'] < 200 || $res['code'] >= 300) {
        throw new RuntimeException('Orthanc HTTP ' . $res['code'] . ': ' . $res['body']);
    }
    return json_decode($res['body'], true);
}

function ris_orthanc_request(string $method, string $path): array
{
    $ch = curl_init(rtrim(ORTHANC_URL, '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 30,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) { throw new RuntimeException($err); }
    return ['code' => $code, 'body' => (string)$body];
}

function ris_delete_directory_contents(string $dir): int
{
    if (!is_dir($dir)) {
        return 0;
    }

    $removed = 0;
    $items = scandir($dir);
    if ($items === false) {
        return 0;
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path)) {
            $removed += ris_delete_directory_contents($path);
            @rmdir($path);
            continue;
        }

        if (is_file($path) && @unlink($path)) {
            $removed++;
        }
    }

    return $removed;
}
