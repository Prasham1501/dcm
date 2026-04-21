<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Test Google Drive Connection
 *
 * POST /api/backup/test-connection.php
 *
 * Tests Google Drive API connection
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

// Check if user is authenticated and is admin
if (!isLoggedIn() || !isAdmin()) {
    sendErrorResponse('Unauthorized access', 403);
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get database connection
    $db = getDbConnection();

    // Load Google Drive Backup class
    require_once __DIR__ . '/../../includes/classes/GoogleDriveBackup.php';

    // Initialize backup service
    $backupService = new \DicomViewer\GoogleDriveBackup($db);

    // Test connection
    $result = $backupService->testConnection();

    if ($result['success']) {
        logMessage("Google Drive connection test successful", 'info', 'backup.log');
        sendSuccessResponse($result, 'Connection test successful');
    } else {
        logMessage("Google Drive connection test failed: " . $result['message'], 'warning', 'backup.log');
        sendErrorResponse($result['message'], 400);
    }

} catch (Exception $e) {
    logMessage("Connection test error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Connection test failed: ' . $e->getMessage(), 500);
}
