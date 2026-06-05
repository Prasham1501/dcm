<?php
/**
 * System — Network setup info (for the "connect your devices" wizard).
 * GET: returns LAN URLs for client PCs and DICOM settings for modalities.
 * Admin only.
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/network_info.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}
if (!hasRole(['admin', 'super_admin'])) {
    sendErrorResponse('Forbidden - admin access required', 403);
}

try {
    // RIS app/web port that client PCs/consoles open. The standalone RIS serves
    // its UI on its own port (8090 in the packaged app), set via RIS_UI_PORT.
    $phpPort = (int) (getenv('RIS_UI_PORT') ?: 8090);
    // Orthanc REST port from ORTHANC_URL.
    $orthancRest = 8042;
    if (defined('ORTHANC_URL') && preg_match('/:(\d+)/', ORTHANC_URL, $m)) {
        $orthancRest = (int) $m[1];
    }

    // Optional overrides stored in hospital_settings.
    $dicomPort = 3458; // Orthanc DicomPort (see main.js generateOrthancConfig)
    $orthancAet = 'ONECLICKZ'; // Orthanc DicomAet (see main.js generateOrthancConfig)
    $db = getDbConnection();
    $res = $db->query("SELECT setting_key, setting_value FROM hospital_settings
                       WHERE setting_key IN ('orthanc_dicom_port','default_station_ae')");
    while ($res && $row = $res->fetch_assoc()) {
        if ($row['setting_key'] === 'orthanc_dicom_port' && $row['setting_value'] !== '') {
            $dicomPort = (int) $row['setting_value'];
        }
    }

    $info = ris_build_network_info([
        'lan_ips'            => ris_detect_lan_ips(),
        'php_port'           => $phpPort,
        'orthanc_rest_port'  => $orthancRest,
        'orthanc_dicom_port' => $dicomPort,
        'orthanc_aet'        => $orthancAet,
    ]);
    sendSuccessResponse($info);
} catch (Throwable $e) {
    logMessage('network-info error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
