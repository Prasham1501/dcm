<?php
/** Commission — enable/disable toggle. GET -> {enabled}; POST {enabled:bool} */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $val = !empty($input['enabled']) ? '1' : '0';
        $stmt = $db->prepare(
            "INSERT INTO hospital_settings (setting_key, setting_value, setting_group)
             VALUES ('commission_enabled', ?, 'commission')
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
        );
        $stmt->bind_param('s', $val);
        $stmt->execute();
        $stmt->close();
        sendSuccessResponse(['enabled' => $val === '1']);
    }
    $res = $db->query("SELECT setting_value FROM hospital_settings WHERE setting_key='commission_enabled'");
    $row = $res ? $res->fetch_assoc() : null;
    sendSuccessResponse(['enabled' => $row ? ($row['setting_value'] !== '0') : true]);
} catch (Throwable $e) {
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
