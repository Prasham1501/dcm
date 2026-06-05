<?php
/**
 * RIS branding + receipt settings.
 * GET returns settings; POST saves the editable header/footer/clinic fields.
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
    'brand_name' => 'One Clickz Imaging',
    'brand_tagline' => 'Radiology Information System',
    'brand_phone' => '',
    'brand_email' => '',
    'brand_address' => '',
    'brand_website' => '',
    'brand_logo_image' => '',
    'receipt_header' => '',
    'receipt_footer' => 'Thank you. Get well soon.',
    'gst_number' => '',
    'default_tax_percentage' => '0',
    'receipt_paper_size' => 'A5',
    'receipt_signature_label' => 'Authorized sign / stamp',
    'receipt_signature_image' => '',
    'receipt_stamp_image' => '',
];

function ris_branding_read(mysqli $db, array $defaults): array {
    $keys = array_keys($defaults);
    $quoted = "'" . implode("','", array_map([$db, 'real_escape_string'], $keys)) . "'";
    $res = $db->query("SELECT setting_key, setting_value FROM hospital_settings WHERE setting_key IN ($quoted)");
    $out = $defaults;
    while ($res && $row = $res->fetch_assoc()) {
        $out[$row['setting_key']] = (string)$row['setting_value'];
    }
    return $out;
}

try {
    $db = getDbConnection();
    $db->query("ALTER TABLE hospital_settings MODIFY setting_value MEDIUMTEXT DEFAULT NULL");
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        sendSuccessResponse(ris_branding_read($db, $defaults));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendErrorResponse('Method not allowed', 405);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $stmt = $db->prepare(
        "INSERT INTO hospital_settings (setting_key, setting_value, setting_group)
         VALUES (?, ?, 'branding')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_group = VALUES(setting_group)"
    );
    foreach ($defaults as $key => $default) {
        $value = isset($input[$key]) ? (string)$input[$key] : $default;
        if ($key === 'default_tax_percentage') {
            $value = (string)max(0, (float)$value);
        }
        $stmt->bind_param('ss', $key, $value);
        $stmt->execute();
    }
    $stmt->close();
    sendSuccessResponse(ris_branding_read($db, $defaults), 'Branding saved');
} catch (Throwable $e) {
    logMessage('RIS branding error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
