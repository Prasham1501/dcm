<?php
/**
 * Health Check API
 * Returns system status for startup verification
 */

header('Content-Type: application/json');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $host = parse_url($origin, PHP_URL_HOST);
    if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
}

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';

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

// Check MySQL connection using the live host/port/name (from env set by the launcher),
// with a short connect timeout so a missing DB never stalls the health check ~2s.
try {
    $dbPort = (int) (getenv('DB_PORT') ?: 3307);
    $dbName = getenv('DB_NAME') ?: 'dicom_viewer_pro';
    $mysqli = mysqli_init();
    $mysqli->options(MYSQLI_OPT_CONNECT_TIMEOUT, 1);
    if (@$mysqli->real_connect('127.0.0.1', 'root', '', $dbName, $dbPort)) {
        $response['components']['database'] = ['status' => 'ok', 'message' => 'Connected'];
        $mysqli->close();
    } else {
        $response['components']['database'] = ['status' => 'error', 'message' => 'Connection failed'];
    }
} catch (Throwable $e) {
    $response['components']['database'] = ['status' => 'error', 'message' => $e->getMessage()];
}

// Check Orthanc
$orthancUrl = 'http://127.0.0.1:8042/system';
$ch = curl_init($orthancUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 3);
curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
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

// Internet connectivity: this is an offline-first desktop app, so do NOT block the
// health check on a network probe (an offline machine stalls ~2s on fsockopen and DNS).
$response['components']['internet'] = ['status' => 'unknown'];

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
