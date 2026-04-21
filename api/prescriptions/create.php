<?php
/**
 * Create Prescription
 * POST /api/prescriptions/create.php
 * Body: { study_uid, patient_id, patient_name, medication_name, dosage, frequency, duration, instructions }
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (CORS_ALLOWED_ORIGINS ?? '*'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . (CORS_ALLOWED_HEADERS ?? 'Content-Type, Authorization'));

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    $currentUser = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input', 400);
    }

    // Validate required fields
    $requiredFields = ['study_uid', 'patient_id', 'patient_name', 'medication_name', 'dosage', 'frequency', 'duration'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendErrorResponse("Missing required field: {$field}", 400);
        }
    }

    // Extract and sanitize inputs
    $study_uid = sanitizeInput($input['study_uid']);
    $patient_id = sanitizeInput($input['patient_id']);
    $patient_name = sanitizeInput($input['patient_name']);
    $medication_name = sanitizeInput($input['medication_name']);
    $dosage = sanitizeInput($input['dosage']);
    $frequency = sanitizeInput($input['frequency']);
    $duration = sanitizeInput($input['duration']);
    $instructions = isset($input['instructions']) ? trim($input['instructions']) : null;

    $db = getDbConnection();

    $stmt = $db->prepare("
        INSERT INTO prescriptions (
            study_uid,
            patient_id,
            patient_name,
            medication_name,
            dosage,
            frequency,
            duration,
            instructions,
            prescribed_by,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ");

    $stmt->bind_param(
        "ssssssssi",
        $study_uid,
        $patient_id,
        $patient_name,
        $medication_name,
        $dosage,
        $frequency,
        $duration,
        $instructions,
        $currentUser['id']
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to create prescription: " . $stmt->error);
    }

    $prescription_id = $stmt->insert_id;
    $stmt->close();

    // Get the created prescription with full details
    $selectStmt = $db->prepare("
        SELECT
            p.*,
            u.full_name AS prescribed_by_name,
            u.username AS prescribed_by_username
        FROM prescriptions p
        LEFT JOIN users u ON p.prescribed_by = u.id
        WHERE p.id = ?
    ");

    $selectStmt->bind_param("i", $prescription_id);
    $selectStmt->execute();
    $result = $selectStmt->get_result();
    $prescription = $result->fetch_assoc();
    $selectStmt->close();

    logAuditEvent(
        $currentUser['id'],
        'create',
        'prescription',
        $prescription_id,
        "Created prescription for {$medication_name} for study {$study_uid}"
    );

    logMessage(
        "User {$currentUser['username']} created prescription ID {$prescription_id} for study {$study_uid}",
        'info',
        'prescriptions.log'
    );

    sendSuccessResponse(
        $prescription,
        'Prescription created successfully'
    );

} catch (Exception $e) {
    logMessage("Error creating prescription: " . $e->getMessage(), 'error', 'prescriptions.log');
    sendErrorResponse('Failed to create prescription: ' . $e->getMessage(), 500);
}
