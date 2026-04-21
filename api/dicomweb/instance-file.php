<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get DICOM Instance File API Endpoint (WADO-RS)
 *
 * GET /api/dicomweb/instance-file.php
 * Parameters: studyUID (required), seriesUID (required), instanceUID (required)
 * Returns: DICOM file or image data with appropriate content type
 */

define('DICOM_VIEWER', true);

// Enable CORS
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/classes/DicomWebProxy.php';

// Require authentication
if (!validateSession()) {
    header('Content-Type: application/json');
    sendErrorResponse('Not authenticated', 401);
}

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Content-Type: application/json');
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Validate required parameters
    if (!isset($_GET['studyUID']) || empty($_GET['studyUID'])) {
        header('Content-Type: application/json');
        sendErrorResponse('studyUID parameter is required', 400);
    }

    if (!isset($_GET['seriesUID']) || empty($_GET['seriesUID'])) {
        header('Content-Type: application/json');
        sendErrorResponse('seriesUID parameter is required', 400);
    }

    if (!isset($_GET['instanceUID']) || empty($_GET['instanceUID'])) {
        header('Content-Type: application/json');
        sendErrorResponse('instanceUID parameter is required', 400);
    }

    $studyUID = sanitizeInput($_GET['studyUID']);
    $seriesUID = sanitizeInput($_GET['seriesUID']);
    $instanceUID = sanitizeInput($_GET['instanceUID']);

    // Get database connection
    $db = getDbConnection();

    // Initialize DICOMweb proxy
    $proxy = new \DicomViewer\DicomWebProxy($db);

    // Get instance file
    $response = $proxy->getInstance($studyUID, $seriesUID, $instanceUID);

    // Log access
    logAuditEvent(
        $_SESSION['user_id'],
        'download_instance',
        'dicom_instance',
        $instanceUID,
        "Downloaded DICOM instance: {$instanceUID}"
    );

    // Check if response contains data
    if (isset($response['data'])) {
        // Set appropriate content type
        $contentType = $response['content_type'] ?? 'application/dicom';
        header('Content-Type: ' . $contentType);

        // Set content disposition for download
        $filename = "instance_{$instanceUID}.dcm";
        header('Content-Disposition: attachment; filename="' . $filename . '"');

        // Set content length
        header('Content-Length: ' . strlen($response['data']));

        // Output the DICOM file data
        echo $response['data'];
        exit;
    } else {
        // Response is already JSON array
        header('Content-Type: application/json');
        sendJsonResponse([
            'success' => true,
            'data' => $response
        ], 200);
    }

} catch (Exception $e) {
    logMessage("Get instance file API error: " . $e->getMessage(), 'error', 'dicomweb.log');
    header('Content-Type: application/json');
    sendErrorResponse('Failed to get instance file: ' . $e->getMessage(), 500);
}
