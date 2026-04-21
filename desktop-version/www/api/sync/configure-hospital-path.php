<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Configure Hospital Data Path
 *
 * Saves hospital data path and monitoring configuration
 * Requires admin authentication
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Set content type
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    sendErrorResponse('Authentication required', 401);
}

// Check admin role
if (!isAdmin()) {
    sendErrorResponse('Admin access required', 403);
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input');
    }

    // Get database connection
    $db = getDbConnection();

    // Get current configuration
    $stmt = $db->prepare("SELECT id FROM sync_configuration LIMIT 1");
    $stmt->execute();
    $result = $stmt->get_result();
    $config = $result->fetch_assoc();
    $stmt->close();

    $hospitalDataPath = isset($input['hospital_data_path']) ? trim($input['hospital_data_path']) : null;
    $monitoringEnabled = isset($input['monitoring_enabled']) ? (bool)$input['monitoring_enabled'] : false;
    $monitoringInterval = isset($input['monitoring_interval']) ? intval($input['monitoring_interval']) : 30;

    // Validate hospital data path if provided
    if ($hospitalDataPath && !is_dir($hospitalDataPath)) {
        sendErrorResponse('Invalid hospital data path - directory does not exist');
    }

    // Update or insert configuration
    if ($config) {
        // Update existing configuration
        $stmt = $db->prepare("
            UPDATE sync_configuration
            SET hospital_data_path = ?,
                monitoring_enabled = ?,
                monitoring_interval = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");

        $stmt->bind_param("siii", $hospitalDataPath, $monitoringEnabled, $monitoringInterval, $config['id']);

    } else {
        // Insert new configuration
        $stmt = $db->prepare("
            INSERT INTO sync_configuration (
                hospital_data_path,
                monitoring_enabled,
                monitoring_interval,
                orthanc_storage_path
            ) VALUES (?, ?, ?, ?)
        ");

        $orthancStoragePath = ORTHANC_STORAGE_PATH;
        $stmt->bind_param("siis", $hospitalDataPath, $monitoringEnabled, $monitoringInterval, $orthancStoragePath);
    }

    $stmt->execute();
    $stmt->close();

    // Log audit event
    logAuditEvent(
        $_SESSION['user_id'],
        'configure_hospital_path',
        'sync_configuration',
        $config['id'] ?? $db->insert_id,
        "Updated hospital data path configuration: {$hospitalDataPath}, Monitoring: " . ($monitoringEnabled ? 'enabled' : 'disabled')
    );

    logMessage("User {$_SESSION['username']} updated hospital data path configuration", 'info', 'import.log');

    $response = [
        'success' => true,
        'message' => 'Hospital data path configuration saved successfully',
        'data' => [
            'hospital_data_path' => $hospitalDataPath,
            'monitoring_enabled' => $monitoringEnabled,
            'monitoring_interval' => $monitoringInterval
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in configure-hospital-path.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while saving configuration', 500);
}
