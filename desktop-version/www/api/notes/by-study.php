<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Clinical Notes by Study API Endpoint
 *
 * GET /api/notes/by-study.php?studyUID=xxx
 * Retrieves all clinical notes for a specific study
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

    // Get studyUID from query parameter
    if (!isset($_GET['studyUID']) || empty($_GET['studyUID'])) {
        sendErrorResponse('Missing required parameter: studyUID', 400);
    }

    $study_uid = sanitizeInput($_GET['studyUID']);

    // Get database connection
    $db = getDbConnection();

    // Prepare select statement
    $stmt = $db->prepare("
        SELECT
            n.id,
            n.study_uid,
            n.series_uid,
            n.instance_uid,
            n.note_type,
            n.content,
            n.created_by,
            n.created_at,
            n.updated_at,
            u.username as created_by_username,
            u.full_name as created_by_name
        FROM clinical_notes n
        LEFT JOIN users u ON n.created_by = u.id
        WHERE n.study_uid = ?
        ORDER BY n.created_at DESC
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param("s", $study_uid);

    if (!$stmt->execute()) {
        throw new Exception("Failed to retrieve clinical notes: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $notes = [];

    while ($row = $result->fetch_assoc()) {
        $notes[] = [
            'id' => (int)$row['id'],
            'study_uid' => $row['study_uid'],
            'series_uid' => $row['series_uid'],
            'instance_uid' => $row['instance_uid'],
            'note_type' => $row['note_type'],
            'content' => $row['content'],
            'created_by' => [
                'id' => (int)$row['created_by'],
                'username' => $row['created_by_username'],
                'full_name' => $row['created_by_name']
            ],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at']
        ];
    }

    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'view',
        'clinical_notes',
        $study_uid,
        "Retrieved " . count($notes) . " clinical note(s) for study {$study_uid}"
    );

    // Return success response with notes
    sendSuccessResponse(
        [
            'study_uid' => $study_uid,
            'count' => count($notes),
            'notes' => $notes
        ],
        'Clinical notes retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving clinical notes: " . $e->getMessage(), 'error', 'notes.log');
    sendErrorResponse('Failed to retrieve clinical notes: ' . $e->getMessage(), 500);
}
