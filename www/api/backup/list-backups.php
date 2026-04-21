<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: List All Backups
 *
 * GET /api/backup/list-backups.php
 *
 * Returns list of all backups from database
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

// Check if user is authenticated and is admin
if (!isLoggedIn() || !isAdmin()) {
    sendErrorResponse('Unauthorized access', 403);
}

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get database connection
    $db = getDbConnection();

    // Load Google Drive Backup class
    require_once __DIR__ . '/../../includes/classes/GoogleDriveBackup.php';

    // Initialize backup service
    $backupService = new \DicomViewer\GoogleDriveBackup($db);

    // Get list of backups
    $result = $backupService->listBackups();

    // Get statistics
    $stats = $backupService->getStatistics();

    sendSuccessResponse([
        'backups' => $result['backups'],
        'total' => $result['total'],
        'statistics' => $stats
    ], 'Backups retrieved successfully');

} catch (Exception $e) {
    logMessage("List backups error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Failed to retrieve backups: ' . $e->getMessage(), 500);
}
