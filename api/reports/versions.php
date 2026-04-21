<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Report Version History API Endpoint
 *
 * GET /api/reports/versions.php?reportId={reportId}
 * Retrieves version history for a specific medical report
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
    if (!isset($_GET['reportId']) || empty($_GET['reportId'])) {
        sendErrorResponse('Missing required parameter: reportId', 400);
    }

    $report_id = intval($_GET['reportId']);

    if ($report_id <= 0) {
        sendErrorResponse('Invalid report ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, verify that the report exists
    $checkStmt = $db->prepare("SELECT id, study_uid, title FROM medical_reports WHERE id = ?");
    $checkStmt->bind_param("i", $report_id);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();

    if ($checkResult->num_rows === 0) {
        $checkStmt->close();
        sendErrorResponse('Medical report not found', 404);
    }

    $report = $checkResult->fetch_assoc();
    $checkStmt->close();

    // Retrieve version history with user information
    $stmt = $db->prepare("
        SELECT
            v.id,
            v.report_id,
            v.version_number,
            v.indication,
            v.technique,
            v.findings,
            v.impression,
            v.change_reason,
            v.created_at,
            u.id AS changed_by_id,
            u.full_name AS changed_by_name,
            u.username AS changed_by_username
        FROM report_versions v
        LEFT JOIN users u ON v.changed_by = u.id
        WHERE v.report_id = ?
        ORDER BY v.version_number DESC
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param("i", $report_id);

    if (!$stmt->execute()) {
        throw new Exception("Failed to retrieve version history: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $versions = [];

    while ($row = $result->fetch_assoc()) {
        $versions[] = $row;
    }

    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'view_versions',
        'medical_report',
        $report_id,
        "Viewed version history for medical report ID {$report_id}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} retrieved version history for medical report ID {$report_id} (" . count($versions) . " version(s))",
        'info',
        'reports.log'
    );

    // Return success response with version history
    sendSuccessResponse(
        [
            'report_id' => $report_id,
            'study_uid' => $report['study_uid'],
            'report_title' => $report['title'],
            'version_count' => count($versions),
            'versions' => $versions
        ],
        'Version history retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving version history: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to retrieve version history: ' . $e->getMessage(), 500);
}
