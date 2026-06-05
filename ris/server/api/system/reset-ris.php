<?php
/**
 * Clear operational RIS data so a clinic can start over without deleting
 * configuration, DICOM node setup, license data, or the service catalog.
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
        'ris_receipts',
        'ris_payments',
        'ris_orders',
        'ris_visits',
        'ris_patients',
        'ris_referring_doctors',
        'cached_studies',
        'cached_patients',
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

    $counters = ['mrn', 'accession', 'receipt', 'visit'];
    $stmt = $db->prepare("UPDATE app_counters SET current_value = 0 WHERE name = ?");
    $reset = [];
    foreach ($counters as $counter) {
        $stmt->bind_param('s', $counter);
        $stmt->execute();
        if ($stmt->affected_rows >= 0) { $reset[] = $counter; }
    }
    $stmt->close();

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

    logAuditEvent((int)(getCurrentUser()['id'] ?? 0), 'reset', 'ris_data', null, 'Cleared RIS operational data, referring doctors, and worklist files');
    sendSuccessResponse(
        [
            'cleared' => $cleared,
            'counters_reset' => $reset,
            'worklist_files_removed' => $worklistCleared,
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
