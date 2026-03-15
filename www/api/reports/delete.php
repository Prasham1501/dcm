<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Delete Medical Report API Endpoint
 *
 * DELETE /api/reports/delete.php?id={reportId}
 * Deletes a medical report and its version history (cascade)
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
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow DELETE method
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Get report ID from query parameter
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        sendErrorResponse('Missing required parameter: id', 400);
    }

    $report_id = intval($_GET['id']);

    if ($report_id <= 0) {
        sendErrorResponse('Invalid report ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, check if report exists and get its details for logging
    $selectStmt = $db->prepare("
        SELECT
            id,
            study_uid,
            title,
            created_by
        FROM medical_reports
        WHERE id = ?
    ");

    $selectStmt->bind_param("i", $report_id);
    $selectStmt->execute();
    $result = $selectStmt->get_result();

    if ($result->num_rows === 0) {
        $selectStmt->close();
        sendErrorResponse('Medical report not found', 404);
    }

    $report = $result->fetch_assoc();
    $selectStmt->close();

    // Optional: Check if user has permission to delete (e.g., only admin or report creator)
    // Uncomment the following lines if you want to restrict deletion
    /*
    if ($currentUser['role'] !== 'admin' && $report['created_by'] !== $currentUser['id']) {
        sendErrorResponse('Forbidden - You do not have permission to delete this report', 403);
    }
    */

    // Delete the report (versions will be cascade deleted due to foreign key)
    $deleteStmt = $db->prepare("DELETE FROM medical_reports WHERE id = ?");

    if (!$deleteStmt) {
        throw new Exception("Failed to prepare delete statement: " . $db->error);
    }

    $deleteStmt->bind_param("i", $report_id);

    if (!$deleteStmt->execute()) {
        throw new Exception("Failed to delete medical report: " . $deleteStmt->error);
    }

    $affected_rows = $deleteStmt->affected_rows;
    $deleteStmt->close();

    if ($affected_rows === 0) {
        sendErrorResponse('Medical report not found or already deleted', 404);
    }

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'delete',
        'medical_report',
        $report_id,
        "Deleted medical report '{$report['title']}' for study {$report['study_uid']}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} deleted medical report ID {$report_id}",
        'info',
        'reports.log'
    );

    // Return success response
    sendSuccessResponse(
        [
            'deleted_report_id' => $report_id,
            'study_uid' => $report['study_uid'],
            'title' => $report['title']
        ],
        'Medical report deleted successfully'
    );

} catch (Exception $e) {
    logMessage("Error deleting medical report: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to delete medical report: ' . $e->getMessage(), 500);
}
