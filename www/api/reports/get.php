<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Medical Report API Endpoint
 *
 * GET /api/reports/get.php?id={reportId}
 * Retrieves a medical report by ID
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
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        sendErrorResponse('Missing required parameter: id', 400);
    }

    $report_id = intval($_GET['id']);

    if ($report_id <= 0) {
        sendErrorResponse('Invalid report ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // Prepare select statement with user information
    $stmt = $db->prepare("
        SELECT
            r.*,
            u1.full_name AS created_by_name,
            u1.username AS created_by_username,
            u2.full_name AS reporting_physician_name,
            u2.username AS reporting_physician_username
        FROM medical_reports r
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.reporting_physician_id = u2.id
        WHERE r.id = ?
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param("i", $report_id);

    if (!$stmt->execute()) {
        throw new Exception("Failed to retrieve medical report: " . $stmt->error);
    }

    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        sendErrorResponse('Medical report not found', 404);
    }

    $report = $result->fetch_assoc();
    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'view',
        'medical_report',
        $report_id,
        "Viewed medical report '{$report['title']}' for study {$report['study_uid']}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} retrieved medical report ID {$report_id}",
        'info',
        'reports.log'
    );

    // Return success response with report data
    sendSuccessResponse(
        $report,
        'Medical report retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving medical report: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to retrieve medical report: ' . $e->getMessage(), 500);
}
