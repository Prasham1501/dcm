<?php
/**
 * DICOM Echo (C-ECHO) API Endpoint
 * Temporarily registers a node with Orthanc and tests connectivity
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Set JSON response header
header('Content-Type: application/json');

// Handle CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $name = $input['name'] ?? 'TestNode';
    $aeTitle = $input['ae_title'] ?? '';
    $host = $input['host_name'] ?? '';
    $port = intval($input['port'] ?? 0);

    if (empty($aeTitle) || empty($host) || $port <= 0) {
        throw new Exception("Invalid node configuration");
    }

    // Sanitize name for Orthanc ID (alphanumeric only)
    $orthancNodeId = preg_replace('/[^a-zA-Z0-9]/', '', $name);
    if (empty($orthancNodeId)) {
        $orthancNodeId = 'TestNode_' . time();
    }

    // 1. Register node gracefully with Orthanc (PUT /modalities/{id})
    $orthancUrl = ORTHANC_URL;
    $orthancUser = ORTHANC_USERNAME;
    $orthancPass = ORTHANC_PASSWORD;

    $modalityConfig = [
        'AET' => $aeTitle,
        'Host' => $host,
        'Port' => $port,
        'Manufacturer' => 'Generic'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$orthancUrl/modalities/$orthancNodeId");
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($modalityConfig));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if (!empty($orthancUser)) {
        curl_setopt($ch, CURLOPT_USERPWD, "$orthancUser:$orthancPass");
    }

    $response = curl_exec($ch);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($statusCode !== 200) {
        throw new Exception("Failed to register node with Orthanc: " . $response);
    }

    // 2. Perform C-ECHO (POST /modalities/{id}/echo)
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$orthancUrl/modalities/$orthancNodeId/echo");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, "{}"); // Empty body for echo
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    if (!empty($orthancUser)) {
        curl_setopt($ch, CURLOPT_USERPWD, "$orthancUser:$orthancPass");
    }

    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $duration = round(($endTime - $startTime) * 1000); // ms

    if ($statusCode === 200) {
        // Echo successful
        echo json_encode([
            'success' => true,
            'time' => $duration
        ]);
    } else {
        // Echo failed
        // Parse Orthanc error if possible
        $errorDetails = "Unknown error";
        if ($response) {
            $json = json_decode($response, true);
            $errorDetails = $json['Message'] ?? $json['Description'] ?? $response;
            // Shorten common Orthanc errors
            if (strpos($errorDetails, 'TCP') !== false) {
                $errorDetails = "Network Unreachable (TCP Error). Check IP/Port and Firewall.";
            }
        }
        
        throw new Exception($errorDetails);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
