<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Query Studies API Endpoint
 *
 * GET /api/dicomweb/studies.php
 * Parameters: PatientName, PatientID, StudyDate, Modality, limit, offset
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
    // Get database connection
    $db = getDbConnection();

    // Initialize DICOMweb proxy
    $proxy = new \DicomViewer\DicomWebProxy($db);

    // Build filters from query parameters
    $filters = [];

    if (isset($_GET['PatientName']) && !empty($_GET['PatientName'])) {
        $filters['PatientName'] = sanitizeInput($_GET['PatientName']);
    }

    if (isset($_GET['PatientID']) && !empty($_GET['PatientID'])) {
        $filters['PatientID'] = sanitizeInput($_GET['PatientID']);
    }

    if (isset($_GET['StudyDate']) && !empty($_GET['StudyDate'])) {
        $filters['StudyDate'] = sanitizeInput($_GET['StudyDate']);
    }

    if (isset($_GET['Modality']) && !empty($_GET['Modality'])) {
        $filters['Modality'] = sanitizeInput($_GET['Modality']);
    }

    if (isset($_GET['AccessionNumber']) && !empty($_GET['AccessionNumber'])) {
        $filters['AccessionNumber'] = sanitizeInput($_GET['AccessionNumber']);
    }

    // Pagination
    if (isset($_GET['limit']) && is_numeric($_GET['limit'])) {
        $filters['limit'] = (int)$_GET['limit'];
    }

    if (isset($_GET['offset']) && is_numeric($_GET['offset'])) {
        $filters['offset'] = (int)$_GET['offset'];
    }

    // Query studies
    $studies = $proxy->queryStudies($filters);

    // Return results
    sendJsonResponse([
        'success' => true,
        'data' => $studies,
        'count' => count($studies)
    ], 200);

} catch (Exception $e) {
    logMessage("Query studies API error: " . $e->getMessage(), 'error', 'dicomweb.log');
    sendErrorResponse('Failed to query studies: ' . $e->getMessage(), 500);
}
