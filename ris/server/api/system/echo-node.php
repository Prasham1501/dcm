<?php
/**
 * RIS C-ECHO helper. Temporarily registers the selected node with Orthanc and
 * runs /modalities/{alias}/echo.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $name = trim((string)($input['name'] ?? 'TestNode'));
    $aeTitle = trim((string)($input['ae_title'] ?? ''));
    $host = trim((string)($input['host_name'] ?? ''));
    $port = (int)($input['port'] ?? 0);
    if ($aeTitle === '' || $host === '' || $port <= 0) {
        sendErrorResponse('Invalid node configuration', 400);
    }

    $alias = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
    if ($alias === '') { $alias = 'RISTestNode'; }
    $modalityConfig = [$aeTitle, $host, $port];

    $ch = curl_init(ORTHANC_URL . '/modalities/' . $alias);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($modalityConfig));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) {
        throw new Exception('Failed to register node with Orthanc (HTTP ' . $httpCode . '): ' . $response);
    }

    $start = microtime(true);
    $ch = curl_init(ORTHANC_URL . '/modalities/' . $alias . '/echo');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, '{}');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $json = json_decode((string)$response, true);
        $msg = $json['Message'] ?? $json['Description'] ?? $response ?: 'Unknown Orthanc error';
        throw new Exception((string)$msg);
    }

    sendSuccessResponse(['time' => (int)round((microtime(true) - $start) * 1000)]);
} catch (Throwable $e) {
    logMessage('RIS echo-node error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
