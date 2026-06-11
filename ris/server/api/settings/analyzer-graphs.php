<?php
/**
 * Analyzer graph fetch settings.
 * Folders can be local paths or network shares, one per line.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

$defaults = [
    'analyzer_graph_source_dirs' => '',
    'analyzer_graph_extensions' => 'png,jpg,jpeg,pdf,bmp',
];

function ris_analyzer_read(mysqli $db, array $defaults): array {
    $out = $defaults;
    $quoted = "'" . implode("','", array_map([$db, 'real_escape_string'], array_keys($defaults))) . "'";
    $res = $db->query("SELECT setting_key, setting_value FROM hospital_settings WHERE setting_key IN ($quoted)");
    while ($res && $row = $res->fetch_assoc()) {
        $out[$row['setting_key']] = (string)$row['setting_value'];
    }
    return $out;
}

try {
    $db = getDbConnection();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        sendSuccessResponse(ris_analyzer_read($db, $defaults));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $stmt = $db->prepare(
        "INSERT INTO hospital_settings (setting_key, setting_value, setting_group)
         VALUES (?, ?, 'analyzer')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group)"
    );
    foreach ($defaults as $key => $default) {
        $value = isset($input[$key]) ? (string)$input[$key] : $default;
        if ($key === 'analyzer_graph_extensions') {
            $exts = array_filter(array_map(fn($v) => strtolower(trim($v)), explode(',', $value)));
            $value = implode(',', $exts ?: explode(',', $default));
        }
        $stmt->bind_param('ss', $key, $value);
        $stmt->execute();
    }
    $stmt->close();
    sendSuccessResponse(ris_analyzer_read($db, $defaults), 'Analyzer graph settings saved');
} catch (Throwable $e) {
    logMessage('Analyzer graph settings error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
