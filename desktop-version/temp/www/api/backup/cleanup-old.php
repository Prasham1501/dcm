<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Cleanup Old Backups
 *
 * POST /api/backup/cleanup-old.php
 *
 * Deletes backups older than retention period
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

    // Clean up old backups
    logMessage("Cleanup old backups initiated by user ID: " . $_SESSION['user_id'], 'info', 'backup.log');

    $result = $backupService->cleanupOldBackups();

    // Audit log
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (user_id, username, action, resource_type, details, ip_address, user_agent)
        VALUES (?, ?, 'cleanup_backups', 'backup', ?, ?, ?)
    ");

    $details = json_encode([
        'deleted_count' => $result['deleted_count'],
        'errors_count' => count($result['errors'])
    ]);
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

    $auditStmt->bind_param(
        'issss',
        $_SESSION['user_id'],
        $_SESSION['username'],
        $details,
        $ipAddress,
        $userAgent
    );
    $auditStmt->execute();
    $auditStmt->close();

    logMessage("Cleanup completed: {$result['deleted_count']} backups deleted", 'info', 'backup.log');

    sendSuccessResponse($result, 'Cleanup completed successfully');

} catch (Exception $e) {
    logMessage("Cleanup error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Cleanup failed: ' . $e->getMessage(), 500);
}
