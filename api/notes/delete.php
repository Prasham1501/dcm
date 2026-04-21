<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Delete Clinical Note API Endpoint
 *
 * DELETE /api/notes/delete.php?id=xxx
 * Deletes a specific clinical note
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

    $note_id = intval($_GET['id']);

    if ($note_id <= 0) {
        sendErrorResponse('Invalid note ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, check if note exists and get details for audit log
    $checkStmt = $db->prepare("
        SELECT id, note_type, study_uid, created_by
        FROM clinical_notes
        WHERE id = ?
    ");

    if (!$checkStmt) {
        throw new Exception("Failed to prepare check statement: " . $db->error);
    }

    $checkStmt->bind_param("i", $note_id);
    $checkStmt->execute();
    $result = $checkStmt->get_result();

    if ($result->num_rows === 0) {
        $checkStmt->close();
        sendErrorResponse('Clinical note not found', 404);
    }

    $note = $result->fetch_assoc();
    $checkStmt->close();

    // Check if user has permission to delete (only creator or admin can delete)
    if ($note['created_by'] != $currentUser['id'] && !isAdmin()) {
        sendErrorResponse('Forbidden - You do not have permission to delete this note', 403);
    }

    // Prepare delete statement
    $stmt = $db->prepare("DELETE FROM clinical_notes WHERE id = ?");

    if (!$stmt) {
        throw new Exception("Failed to prepare delete statement: " . $db->error);
    }

    $stmt->bind_param("i", $note_id);

    if (!$stmt->execute()) {
        throw new Exception("Failed to delete clinical note: " . $stmt->error);
    }

    $affected_rows = $stmt->affected_rows;
    $stmt->close();

    if ($affected_rows === 0) {
        sendErrorResponse('Clinical note not found or already deleted', 404);
    }

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'delete',
        'clinical_note',
        $note_id,
        "Deleted {$note['note_type']} note {$note_id} for study {$note['study_uid']}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} deleted clinical note ID {$note_id}",
        'info',
        'notes.log'
    );

    // Return success response
    sendSuccessResponse(
        ['id' => $note_id],
        'Clinical note deleted successfully'
    );

} catch (Exception $e) {
    logMessage("Error deleting clinical note: " . $e->getMessage(), 'error', 'notes.log');
    sendErrorResponse('Failed to delete clinical note: ' . $e->getMessage(), 500);
}
