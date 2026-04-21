<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Create Clinical Note API Endpoint
 *
 * POST /api/notes/create.php
 * Creates a new clinical note
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
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $requiredFields = ['study_uid', 'note_type', 'content'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendErrorResponse("Missing required field: {$field}", 400);
        }
    }

    // Extract and sanitize inputs
    $study_uid = sanitizeInput($input['study_uid']);
    $series_uid = isset($input['series_uid']) ? sanitizeInput($input['series_uid']) : null;
    $instance_uid = isset($input['instance_uid']) ? sanitizeInput($input['instance_uid']) : null;
    $note_type = sanitizeInput($input['note_type']);
    $content = trim($input['content']); // Don't sanitize content too much - preserve formatting

    // Validate note_type
    $validNoteTypes = ['clinical_history', 'series_note', 'image_note', 'general'];
    if (!in_array($note_type, $validNoteTypes)) {
        sendErrorResponse("Invalid note_type. Must be one of: " . implode(', ', $validNoteTypes), 400);
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

    // Prepare insert statement
    $stmt = $db->prepare("
        INSERT INTO clinical_notes (
            study_uid,
            series_uid,
            instance_uid,
            note_type,
            content,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param(
        "sssssi",
        $study_uid,
        $series_uid,
        $instance_uid,
        $note_type,
        $content,
        $currentUser['id']
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to create clinical note: " . $stmt->error);
    }

    $note_id = $stmt->insert_id;
    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'create',
        'clinical_note',
        $note_id,
        "Created {$note_type} note for study {$study_uid}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} created clinical note ID {$note_id} ({$note_type})",
        'info',
        'notes.log'
    );

    // Return success response with note ID
    sendSuccessResponse(
        [
            'id' => $note_id,
            'study_uid' => $study_uid,
            'series_uid' => $series_uid,
            'instance_uid' => $instance_uid,
            'note_type' => $note_type,
            'content' => $content,
            'created_by' => $currentUser['id'],
            'created_at' => date('Y-m-d H:i:s')
        ],
        'Clinical note created successfully'
    );

} catch (Exception $e) {
    logMessage("Error creating clinical note: " . $e->getMessage(), 'error', 'notes.log');
    sendErrorResponse('Failed to create clinical note: ' . $e->getMessage(), 500);
}
