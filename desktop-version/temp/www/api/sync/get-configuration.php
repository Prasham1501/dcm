<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Get Sync Configuration
 *
 * Returns current sync configuration including hospital data path
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

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get database connection
    $db = getDbConnection();

    // Get configuration
    $stmt = $db->prepare("SELECT * FROM sync_configuration LIMIT 1");
    $stmt->execute();
    $result = $stmt->get_result();
    $config = $result->fetch_assoc();
    $stmt->close();

    if (!$config) {
        // No configuration exists, return defaults
        $response = [
            'success' => true,
            'data' => [
                'hospital_data_path' => HOSPITAL_DATA_PATH,
                'orthanc_storage_path' => ORTHANC_STORAGE_PATH,
                'monitoring_enabled' => MONITORING_ENABLED,
                'monitoring_interval' => 30,
                'sync_enabled' => SYNC_ENABLED,
                'sync_interval' => SYNC_INTERVAL,
                'last_sync_at' => null,
                'ftp_configured' => !empty(FTP_HOST),
                'has_configuration' => false
            ]
        ];
    } else {
        $response = [
            'success' => true,
            'data' => [
                'hospital_data_path' => $config['hospital_data_path'],
                'orthanc_storage_path' => $config['orthanc_storage_path'],
                'monitoring_enabled' => (bool)$config['monitoring_enabled'],
                'monitoring_interval' => $config['monitoring_interval'],
                'sync_enabled' => (bool)$config['sync_enabled'],
                'sync_interval' => $config['sync_interval'],
                'last_sync_at' => $config['last_sync_at'],
                'ftp_configured' => !empty($config['ftp_host']),
                'ftp_host' => $config['ftp_host'],
                'ftp_port' => $config['ftp_port'],
                'ftp_path' => $config['ftp_path'],
                'ftp_passive' => (bool)$config['ftp_passive'],
                'has_configuration' => true,
                'updated_at' => $config['updated_at']
            ]
        ];
    }

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in get-configuration.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while retrieving configuration', 500);
}
