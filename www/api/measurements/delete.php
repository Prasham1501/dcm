<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Delete Measurement API Endpoint
 *
 * DELETE /api/measurements/delete.php?id=xxx
 * Deletes a specific measurement
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

    // Get id from query parameter
    if (!isset($_GET['id']) || empty($_GET['id'])) {
        sendErrorResponse('Missing required parameter: id', 400);
    }

    $measurement_id = intval($_GET['id']);

    if ($measurement_id <= 0) {
        sendErrorResponse('Invalid measurement ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, check if measurement exists and get details for audit log
    $checkStmt = $db->prepare("
        SELECT id, tool_type, instance_uid, created_by
        FROM measurements
        WHERE id = ?
    ");

    if (!$checkStmt) {
        throw new Exception("Failed to prepare check statement: " . $db->error);
    }

    $checkStmt->bind_param("i", $measurement_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();

    if ($result->num_rows === 0) {
        $checkStmt->close();
        sendErrorResponse('Measurement not found', 404);
    }

    $measurement = $result->fetch_assoc();
    $checkStmt->close();

    // Check if user has permission to delete (only creator or admin can delete)
    if ($measurement['created_by'] != $currentUser['id'] && !isAdmin()) {
        sendErrorResponse('Forbidden - You do not have permission to delete this measurement', 403);
    }

    // Prepare delete statement
    $stmt = $db->prepare("DELETE FROM measurements WHERE id = ?");

    if (!$stmt) {
        throw new Exception("Failed to prepare delete statement: " . $db->error);
    }

    $stmt->bind_param("i", $measurement_id);

    if (!$stmt->execute()) {
        throw new Exception("Failed to delete measurement: " . $stmt->error);
    }

    $affected_rows = $stmt->affected_rows;
    $stmt->close();

    if ($affected_rows === 0) {
        sendErrorResponse('Measurement not found or already deleted', 404);
    }

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'delete',
        'measurement',
        $measurement_id,
        "Deleted {$measurement['tool_type']} measurement {$measurement_id} for instance {$measurement['instance_uid']}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} deleted measurement ID {$measurement_id}",
        'info',
        'measurements.log'
    );

    // Return success response
    sendSuccessResponse(
        ['id' => $measurement_id],
        'Measurement deleted successfully'
    );

} catch (Exception $e) {
    logMessage("Error deleting measurement: " . $e->getMessage(), 'error', 'measurements.log');
    sendErrorResponse('Failed to delete measurement: ' . $e->getMessage(), 500);
}
