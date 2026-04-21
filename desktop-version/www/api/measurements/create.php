<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Create Measurement API Endpoint
 *
 * POST /api/measurements/create.php
 * Creates a new measurement for a DICOM instance
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
    $requiredFields = ['study_uid', 'series_uid', 'instance_uid', 'tool_type', 'measurement_data'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            sendErrorResponse("Missing required field: {$field}", 400);
        }
    }

    // Extract and sanitize inputs
    $study_uid = sanitizeInput($input['study_uid']);
    $series_uid = sanitizeInput($input['series_uid']);
    $instance_uid = sanitizeInput($input['instance_uid']);
    $tool_type = sanitizeInput($input['tool_type']);
    $value = isset($input['value']) ? floatval($input['value']) : null;
    $unit = isset($input['unit']) ? sanitizeInput($input['unit']) : null;
    $label = isset($input['label']) ? sanitizeInput($input['label']) : null;

    // Validate tool_type
    $validToolTypes = ['length', 'angle', 'rectangle_roi', 'elliptical_roi', 'freehand_roi', 'probe'];
    if (!in_array($tool_type, $validToolTypes)) {
        sendErrorResponse("Invalid tool_type. Must be one of: " . implode(', ', $validToolTypes), 400);
    }

    // Validate and encode measurement_data as JSON
    $measurement_data = $input['measurement_data'];
    if (is_array($measurement_data)) {
        $measurement_data_json = json_encode($measurement_data);
    } elseif (is_string($measurement_data)) {
        // Validate that it's valid JSON
        $decoded = json_decode($measurement_data);
        if (json_last_error() !== JSON_ERROR_NONE) {
            sendErrorResponse("Invalid measurement_data JSON: " . json_last_error_msg(), 400);
        }
        $measurement_data_json = $measurement_data;
    } else {
        sendErrorResponse("measurement_data must be a JSON string or array", 400);
    }

    // Get database connection
    $db = getDbConnection();

    // Prepare insert statement
    $stmt = $db->prepare("
        INSERT INTO measurements (
            study_uid,
            series_uid,
            instance_uid,
            tool_type,
            measurement_data,
            value,
            unit,
            label,
            created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param(
        "sssssdssi",
        $study_uid,
        $series_uid,
        $instance_uid,
        $tool_type,
        $measurement_data_json,
        $value,
        $unit,
        $label,
        $currentUser['id']
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to create measurement: " . $stmt->error);
    }

    $measurement_id = $stmt->insert_id;
    $stmt->close();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'create',
        'measurement',
        $measurement_id,
        "Created {$tool_type} measurement for instance {$instance_uid}"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} created measurement ID {$measurement_id} ({$tool_type})",
        'info',
        'measurements.log'
    );

    // Return success response with measurement ID
    sendSuccessResponse(
        [
            'id' => $measurement_id,
            'study_uid' => $study_uid,
            'series_uid' => $series_uid,
            'instance_uid' => $instance_uid,
            'tool_type' => $tool_type,
            'value' => $value,
            'unit' => $unit,
            'label' => $label
        ],
        'Measurement created successfully'
    );

} catch (Exception $e) {
    logMessage("Error creating measurement: " . $e->getMessage(), 'error', 'measurements.log');
    sendErrorResponse('Failed to create measurement: ' . $e->getMessage(), 500);
}
