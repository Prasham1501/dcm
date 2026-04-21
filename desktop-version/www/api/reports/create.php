<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Create Medical Report API Endpoint
 *
 * POST /api/reports/create.php
 * Creates a new medical report
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
    $requiredFields = ['study_uid', 'patient_id', 'patient_name', 'template_name', 'title'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendErrorResponse("Missing required field: {$field}", 400);
        }
    }

    // Extract and sanitize inputs
    $study_uid = sanitizeInput($input['study_uid']);
    $patient_id = sanitizeInput($input['patient_id']);
    $patient_name = sanitizeInput($input['patient_name']);
    $template_name = sanitizeInput($input['template_name']);
    $title = sanitizeInput($input['title']);
    // Handle both string and array inputs (arrays get JSON encoded)
    $indication = isset($input['indication']) ? (is_array($input['indication']) ? json_encode($input['indication']) : trim($input['indication'])) : null;
    $technique = isset($input['technique']) ? (is_array($input['technique']) ? json_encode($input['technique']) : trim($input['technique'])) : null;
    $findings = isset($input['findings']) ? (is_array($input['findings']) ? json_encode($input['findings']) : trim($input['findings'])) : null;
    $impression = isset($input['impression']) ? (is_array($input['impression']) ? json_encode($input['impression']) : trim($input['impression'])) : null;
    $reporting_physician_id = isset($input['reporting_physician_id']) ? intval($input['reporting_physician_id']) : null;
    $reporting_physician_name = isset($input['reporting_physician_name']) ? sanitizeInput($input['reporting_physician_name']) : null;

    // Validate template_name length
    if (strlen($template_name) > 100) {
        sendErrorResponse('Template name exceeds maximum length (100 characters)', 400);
    }

    // Validate title length
    if (strlen($title) > 255) {
        sendErrorResponse('Title exceeds maximum length (255 characters)', 400);
    }

    // Validate reporting_physician_id exists if provided
    if ($reporting_physician_id !== null) {
        $db = getDbConnection();
        $checkStmt = $db->prepare("SELECT id FROM users WHERE id = ? AND is_active = 1");
        $checkStmt->bind_param("i", $reporting_physician_id);
        $checkStmt->execute();
        $result = $checkStmt->get_result();

        if ($result->num_rows === 0) {
            $checkStmt->close();
            sendErrorResponse('Invalid reporting_physician_id - user does not exist or is inactive', 400);
        }
        $checkStmt->close();
    }

    // Get database connection
    $db = getDbConnection();

    // Prepare insert statement
    $stmt = $db->prepare("
        INSERT INTO medical_reports (
            study_uid,
            patient_id,
            patient_name,
            template_name,
            title,
            indication,
            technique,
            findings,
            impression,
            reporting_physician_id,
            reporting_physician_name,
            created_by,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param(
        "sssssssssssi",
        $study_uid,
        $patient_id,
        $patient_name,
        $template_name,
        $title,
        $indication,
        $technique,
        $findings,
        $impression,
        $reporting_physician_id,
        $reporting_physician_name,
        $currentUser['id']
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to create medical report: " . $stmt->error);
    }

    $report_id = $stmt->insert_id;
    $stmt->close();

    // Get the created report with full details
    $selectStmt = $db->prepare("
        SELECT
            r.*,
            u1.full_name AS created_by_name,
            u2.full_name AS reporting_physician_name
        FROM medical_reports r
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.reporting_physician_id = u2.id
        WHERE r.id = ?
    ");

    $selectStmt->bind_param("i", $report_id);
    $selectStmt->execute();
    $result = $selectStmt->get_result();
    $report = $result->fetch_assoc();
    $selectStmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'create',
        'medical_report',
        $report_id,
        "Created medical report '{$title}' for study {$study_uid}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} created medical report ID {$report_id} for study {$study_uid}",
        'info',
        'reports.log'
    );

    // Return success response with report data
    sendSuccessResponse(
        $report,
        'Medical report created successfully'
    );

} catch (Exception $e) {
    logMessage("Error creating medical report: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to create medical report: ' . $e->getMessage(), 500);
}
