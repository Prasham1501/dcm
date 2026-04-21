<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Medical Reports by Study API Endpoint
 *
 * GET /api/reports/by-study.php?studyUID={studyUID}
 * Retrieves all medical reports for a specific study
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
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET method
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Validate required parameter
    if (!isset($_GET['studyUID']) || empty($_GET['studyUID'])) {
        sendErrorResponse('Missing required parameter: studyUID', 400);
    }

    $study_uid = sanitizeInput($_GET['studyUID']);

    // Get database connection
    $db = getDbConnection();

    // Prepare select statement with user information
    $stmt = $db->prepare("
        SELECT
            r.id,
            r.study_uid,
            r.patient_id,
            r.patient_name,
            r.template_name,
            r.title,
            r.indication,
            r.technique,
            r.findings,
            r.impression,
            r.status,
            r.created_at,
            r.updated_at,
            r.finalized_at,
            u1.id AS created_by_id,
            u1.full_name AS created_by_name,
            u1.username AS created_by_username,
            u2.id AS reporting_physician_id,
            u2.full_name AS reporting_physician_name,
            u2.username AS reporting_physician_username
        FROM medical_reports r
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.reporting_physician_id = u2.id
        WHERE r.study_uid = ?
        ORDER BY r.created_at DESC
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param("s", $study_uid);

    if (!$stmt->execute()) {
        throw new Exception("Failed to retrieve medical reports: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $reports = [];

    while ($row = $result->fetch_assoc()) {
        $reports[] = $row;
    }

    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'list',
        'medical_report',
        null,
        "Retrieved " . count($reports) . " medical report(s) for study {$study_uid}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} retrieved " . count($reports) . " medical report(s) for study {$study_uid}",
        'info',
        'reports.log'
    );

    // Return success response with reports array
    sendSuccessResponse(
        [
            'study_uid' => $study_uid,
            'count' => count($reports),
            'reports' => $reports
        ],
        'Medical reports retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving medical reports by study: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to retrieve medical reports: ' . $e->getMessage(), 500);
}
