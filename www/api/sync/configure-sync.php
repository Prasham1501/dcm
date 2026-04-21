<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Configure Sync API Endpoint
 *
 * POST /api/sync/configure-sync.php
 * Updates sync configuration settings
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/classes/SyncManager.php';

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

// Check admin role
if (!isAdmin()) {
    sendErrorResponse('Forbidden - Admin access required', 403);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input)) {
        sendErrorResponse('No configuration data provided', 400);
    }

    // Initialize SyncManager
    $syncManager = new DicomViewer\SyncManager();

    // Prepare configuration data
    $configData = [];

    // Allowed configuration fields
    $allowedFields = [
        'orthanc_storage_path',
        'hospital_data_path',
        'ftp_host',
        'ftp_username',
        'ftp_password',
        'ftp_port',
        'ftp_path',
        'ftp_passive',
        'sync_enabled',
        'sync_interval',
        'monitoring_enabled',
        'monitoring_interval'
    ];

    foreach ($allowedFields as $field) {
        if (array_key_exists($field, $input)) {
            // Sanitize string fields
            if (in_array($field, ['orthanc_storage_path', 'hospital_data_path', 'ftp_host', 'ftp_username', 'ftp_path'])) {
                $configData[$field] = sanitizeInput($input[$field]);
            }
            // Handle password separately (no sanitization needed for encryption)
            elseif ($field === 'ftp_password') {
                $configData[$field] = $input[$field];
            }
            // Convert boolean fields
            elseif (in_array($field, ['ftp_passive', 'sync_enabled', 'monitoring_enabled'])) {
                $configData[$field] = filter_var($input[$field], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            }
            // Handle integer fields
            elseif (in_array($field, ['ftp_port', 'sync_interval', 'monitoring_interval'])) {
                $configData[$field] = intval($input[$field]);
            }
        }
    }

    // Validate required fields if FTP is being configured
    if (isset($configData['ftp_host']) && !empty($configData['ftp_host'])) {
        if (empty($configData['ftp_username'])) {
            sendErrorResponse('FTP username is required when FTP host is configured', 400);
        }
    }

    // Validate Orthanc storage path if provided
    if (isset($configData['orthanc_storage_path']) && !empty($configData['orthanc_storage_path'])) {
        if (!is_dir($configData['orthanc_storage_path'])) {
            sendErrorResponse('Invalid Orthanc storage path - directory does not exist', 400);
        }
    }

    // Validate sync interval
    if (isset($configData['sync_interval'])) {
        if ($configData['sync_interval'] < 1 || $configData['sync_interval'] > 1440) {
            sendErrorResponse('Sync interval must be between 1 and 1440 minutes', 400);
        }
    }

    // Update configuration
    $result = $syncManager->updateConfiguration($configData);

    if (!$result) {
        throw new Exception("Failed to update sync configuration");
    }

    // Get updated configuration (with password masked)
    $updatedConfig = $syncManager->getConfiguration(true);

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'update',
        'sync_configuration',
        '1',
        "Updated sync configuration"
    );

    // Log to file
    logMessage(
        "User {$currentUser['username']} updated sync configuration",
        'info',
        'sync.log'
    );

    // Return success response
    sendSuccessResponse(
        $updatedConfig,
        'Sync configuration updated successfully'
    );

} catch (Exception $e) {
    logMessage("Error updating sync configuration: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Failed to update sync configuration: ' . $e->getMessage(), 500);
}
