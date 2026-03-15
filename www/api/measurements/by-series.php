<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Measurements by Series API Endpoint
 *
 * GET /api/measurements/by-series.php?seriesUID=xxx
 * Retrieves all measurements for a specific series
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

    // Get seriesUID from query parameter
    if (!isset($_GET['seriesUID']) || empty($_GET['seriesUID'])) {
        sendErrorResponse('Missing required parameter: seriesUID', 400);
    }

    $series_uid = sanitizeInput($_GET['seriesUID']);

    // Get database connection
    $db = getDbConnection();

    // Prepare select statement
    $stmt = $db->prepare("
        SELECT
            m.id,
            m.study_uid,
            m.series_uid,
            m.instance_uid,
            m.tool_type,
            m.measurement_data,
            m.value,
            m.unit,
            m.label,
            m.created_by,
            m.created_at,
            m.updated_at,
            u.username as created_by_username,
            u.full_name as created_by_name
        FROM measurements m
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.series_uid = ?
        ORDER BY m.created_at DESC
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    $stmt->bind_param("s", $series_uid);

    if (!$stmt->execute()) {
        throw new Exception("Failed to retrieve measurements: " . $stmt->error);
    }

    $result = $stmt->get_result();
    $measurements = [];

    while ($row = $result->fetch_assoc()) {
        // Decode measurement_data JSON
        $measurement_data = json_decode($row['measurement_data'], true);

        $measurements[] = [
            'id' => (int)$row['id'],
            'study_uid' => $row['study_uid'],
            'series_uid' => $row['series_uid'],
            'instance_uid' => $row['instance_uid'],
            'tool_type' => $row['tool_type'],
            'measurement_data' => $measurement_data,
            'value' => $row['value'] ? (float)$row['value'] : null,
            'unit' => $row['unit'],
            'label' => $row['label'],
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
        'measurements',
        $series_uid,
        "Retrieved " . count($measurements) . " measurement(s) for series {$series_uid}"
    );

    // Return success response with measurements
    sendSuccessResponse(
        [
            'series_uid' => $series_uid,
            'count' => count($measurements),
            'measurements' => $measurements
        ],
        'Measurements retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving measurements: " . $e->getMessage(), 'error', 'measurements.log');
    sendErrorResponse('Failed to retrieve measurements: ' . $e->getMessage(), 500);
}
