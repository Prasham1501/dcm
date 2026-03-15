<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Restore from Backup
 *
 * POST /api/backup/restore.php
 *
 * Request Body:
 * {
 *   "backup_id": integer
 * }
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
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['backup_id'])) {
        sendErrorResponse('Missing backup_id parameter');
    }

    $backupId = (int)$input['backup_id'];

    // Get database connection
    $db = getDbConnection();

    // Load Google Drive Backup class
    require_once __DIR__ . '/../../includes/classes/GoogleDriveBackup.php';

    // Initialize backup service
    $backupService = new \DicomViewer\GoogleDriveBackup($db);

    // Log restore attempt
    logMessage(
        "Restore initiated by user ID: {$_SESSION['user_id']} for backup ID: {$backupId}",
        'info',
        'backup.log'
    );

    // Perform restore
    $result = $backupService->restoreBackup($backupId);

    // Audit log
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (?, ?, 'restore_backup', 'backup', ?, ?, ?, ?)
    ");

    $details = json_encode([
        'backup_id' => $backupId,
        'backup_name' => $result['backup_name']
    ]);
    $backupIdStr = (string)$backupId;
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

    $auditStmt->bind_param(
        'isssss',
        $_SESSION['user_id'],
        $_SESSION['username'],
        $backupIdStr,
        $details,
        $ipAddress,
        $userAgent
    );
    $auditStmt->execute();
    $auditStmt->close();

    logMessage(
        "Restore completed successfully for backup: {$result['backup_name']}",
        'info',
        'backup.log'
    );

    sendSuccessResponse($result, 'Backup restored successfully');

} catch (Exception $e) {
    logMessage("Restore failed: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Restore failed: ' . $e->getMessage(), 500);
}
