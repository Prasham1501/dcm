<?php
/**
 * Fast DICOM retrieval with base64 encoding for thumbnails
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('DICOM_VIEWER', true);
require_once __DIR__ . '/includes/config.php';

// Support both 'id' and 'instanceId' parameters
$instanceId = $_GET['instanceId'] ?? $_GET['id'] ?? '';
$format = $_GET['format'] ?? 'dicom';

if (empty($instanceId)) {
    http_response_code(400);
    error_log("get_dicom_fast.php: Instance ID missing. GET params: " . json_encode($_GET));
    echo json_encode(['success' => false, 'error' => 'Instance ID required']);
    exit;
}

// Log what we received for debugging
error_log("get_dicom_fast.php: Processing request for instance: $instanceId, format: $format");

// Fetch DICOM file from Orthanc using create-archive
$orthancUrl = ORTHANC_URL . "/tools/create-archive";

$ch = curl_init($orthancUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['Resources' => [$instanceId]]));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$zipData = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$zipData) {
    http_response_code($httpCode ?: 500);
    die(json_encode(['error' => 'Failed to fetch DICOM file']));
}

// Extract DICOM from ZIP
require_once __DIR__ . '/api/get_dicom_from_orthanc.php';
$dicomData = extractDicomFromZip($zipData);

if (!$dicomData) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to extract DICOM from archive']));
}

if ($format === 'base64') {
    // Return base64 encoded for thumbnails
    echo json_encode([
        'success' => true,
        'data' => base64_encode($dicomData),
        'size' => strlen($dicomData)
    ]);
} else {
    // Return raw DICOM
    header('Content-Type: application/dicom');
    header('Content-Length: ' . strlen($dicomData));
    echo $dicomData;
}
