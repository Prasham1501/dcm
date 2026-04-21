<?php
/**
 * Health Check API
 * Returns system status for startup verification
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

define('DICOM_VIEWER', true);

// Simple response without full config load for quick health check
$response = [
    'success' => true,
    'status' => 'healthy',
    'timestamp' => date('Y-m-d H:i:s'),
    'version' => '2.0.0-desktop',
    'components' => []
];

// Check PHP version
$response['components']['php'] = [
    'status' => version_compare(PHP_VERSION, '8.0.0', '>=') ? 'ok' : 'warning',
    'version' => PHP_VERSION
];

// Check MySQL connection
try {
    $mysqli = @new mysqli('127.0.0.1', 'root', '', 'dicom_viewer_desktop');
    if ($mysqli->connect_error) {
        $response['components']['database'] = [
            'status' => 'error',
            'message' => 'Connection failed'
        ];
    } else {
        $response['components']['database'] = [
            'status' => 'ok',
            'message' => 'Connected'
        ];
        $mysqli->close();
    }
} catch (Exception $e) {
    $response['components']['database'] = [
        'status' => 'error',
        'message' => $e->getMessage()
    ];
}

// Check Orthanc
$orthancUrl = 'http://localhost:8043/system';
$ch = curl_init($orthancUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 3);
curl_setopt($ch, CURLOPT_USERPWD, 'orthanc:orthanc');
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);

$orthancResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $orthancData = json_decode($orthancResponse, true);
    $response['components']['orthanc'] = [
        'status' => 'ok',
        'version' => $orthancData['Version'] ?? 'unknown'
    ];
} else {
    $response['components']['orthanc'] = [
        'status' => 'offline',
        'message' => 'Orthanc not responding (HTTP ' . $httpCode . ')'
    ];
}

// Check internet connectivity
$internetCheck = @fsockopen("www.google.com", 80, $errno, $errstr, 2);
if ($internetCheck) {
    fclose($internetCheck);
    $response['components']['internet'] = ['status' => 'online'];
} else {
    $response['components']['internet'] = ['status' => 'offline'];
}

// Overall status
$hasError = false;
foreach ($response['components'] as $component) {
    if ($component['status'] === 'error') {
        $hasError = true;
        break;
    }
}

$response['status'] = $hasError ? 'degraded' : 'healthy';

echo json_encode($response, JSON_PRETTY_PRINT);
