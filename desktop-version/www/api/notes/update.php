<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Update Clinical Note API Endpoint
 *
 * PUT /api/notes/update.php
 * Updates an existing clinical note
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
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow PUT method
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Get PUT data
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (!isset($input['id']) || empty($input['id'])) {
        sendErrorResponse('Missing required field: id', 400);
    }

    if (!isset($input['content']) || empty($input['content'])) {
        sendErrorResponse('Missing required field: content', 400);
    }

    $note_id = intval($input['id']);
    $content = trim($input['content']); // Don't sanitize content too much - preserve formatting

    if ($note_id <= 0) {
        sendErrorResponse('Invalid note ID', 400);
    }

    // Validate content length
    if (strlen($content) < 1) {
        sendErrorResponse('Content cannot be empty', 400);
    }

    if (strlen($content) > 65535) {
        sendErrorResponse('Content exceeds maximum length (65535 characters)', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, check if note exists and get details
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

    // Check if user has permission to update (only creator or admin can update)
    if ($note['created_by'] != $currentUser['id'] && !isAdmin()) {
        sendErrorResponse('Forbidden - You do not have permission to update this note', 403);
    }

    // Prepare update statement
    $stmt = $db->prepare("
        UPDATE clinical_notes
        SET content = ?, updated_at = NOW()
        WHERE id = ?
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare update statement: " . $db->error);
    }

    $stmt->bind_param("si", $content, $note_id);

    if (!$stmt->execute()) {
        throw new Exception("Failed to update clinical note: " . $stmt->error);
    }

    $affected_rows = $stmt->affected_rows;
    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'update',
        'clinical_note',
        $note_id,
        "Updated {$note['note_type']} note {$note_id} for study {$note['study_uid']}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} updated clinical note ID {$note_id}",
        'info',
        'notes.log'
    );

    // Return success response
    sendSuccessResponse(
        [
            'id' => $note_id,
            'content' => $content,
            'updated_at' => date('Y-m-d H:i:s')
        ],
        'Clinical note updated successfully'
    );

} catch (Exception $e) {
    logMessage("Error updating clinical note: " . $e->getMessage(), 'error', 'notes.log');
    sendErrorResponse('Failed to update clinical note: ' . $e->getMessage(), 500);
}
