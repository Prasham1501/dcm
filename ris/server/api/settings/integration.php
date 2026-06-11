<?php
/**
 * Integration API key management (for the separate reporting software).
 *   GET                      -> { api_key, endpoint }  (generates a key on first use)
 *   POST { action:'regenerate' } -> new key
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

function ris_int_get_key(mysqli $db): string
{
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = 'integration_api_key' LIMIT 1");
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? (string)$row['setting_value'] : '';
}

function ris_int_set_key(mysqli $db, string $key): void
{
    $stmt = $db->prepare(
        "INSERT INTO hospital_settings (setting_key, setting_value, setting_group)
         VALUES ('integration_api_key', ?, 'integration')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    );
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $stmt->close();
}

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $key = 'rkey_' . bin2hex(random_bytes(20));
        ris_int_set_key($db, $key);
        sendSuccessResponse(['api_key' => $key], 'New API key generated');
    }

    $key = ris_int_get_key($db);
    if ($key === '') {
        $key = 'rkey_' . bin2hex(random_bytes(20));
        ris_int_set_key($db, $key);
    }
    sendSuccessResponse([
        'api_key' => $key,
        'endpoint' => '/api/integration/report-status.php',
    ]);
} catch (Throwable $e) {
    logMessage('Integration settings error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
