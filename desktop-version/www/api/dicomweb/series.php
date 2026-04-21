<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Series for Study API Endpoint
 *
 * GET /api/dicomweb/series.php
 * Parameters: studyUID (required)
 * Returns: { "success": true, "data": [...] }
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');

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
    sendErrorResponse('Not authenticated', 401);
}

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Validate required parameters
    if (!isset($_GET['studyUID']) || empty($_GET['studyUID'])) {
        sendErrorResponse('studyUID parameter is required', 400);
    }

    $studyUID = sanitizeInput($_GET['studyUID']);

    // Get database connection
    $db = getDbConnection();

    // Initialize DICOMweb proxy
    $proxy = new \DicomViewer\DicomWebProxy($db);

    // Get series for study
    $series = $proxy->getStudySeries($studyUID);

    // Return results
    sendJsonResponse([
        'success' => true,
        'data' => $series,
        'count' => count($series)
    ], 200);

} catch (Exception $e) {
    logMessage("Get series API error: " . $e->getMessage(), 'error', 'dicomweb.log');
    sendErrorResponse('Failed to get series: ' . $e->getMessage(), 500);
}
