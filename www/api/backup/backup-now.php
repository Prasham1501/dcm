<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Trigger Immediate Backup
 *
 * POST /api/backup/backup-now.php
 *
 * Creates immediate backup and uploads to Google Drive
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

    // Create backup
    logMessage("Manual backup initiated by user ID: " . $_SESSION['user_id'], 'info', 'backup.log');

    $result = $backupService->createBackup('manual');

    // Audit log
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (?, ?, 'create_backup', 'backup', ?, ?, ?, ?)
    ");

    $details = json_encode([
        'backup_name' => $result['backup_name'],
        'size_bytes' => $result['size_bytes'],
        'gdrive_file_id' => $result['gdrive_file_id']
    ]);
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

    $auditStmt->bind_param(
        'isssss',
        $_SESSION['user_id'],
        $_SESSION['username'],
        $result['backup_name'],
        $details,
        $ipAddress,
        $userAgent
    );
    $auditStmt->execute();
    $auditStmt->close();

    logMessage(
        "Manual backup completed: {$result['backup_name']} ({$result['size_formatted']})",
        'info',
        'backup.log'
    );

    sendSuccessResponse($result, 'Backup created successfully');

} catch (Exception $e) {
    logMessage("Backup creation failed: " . $e->getMessage(), 'error', 'backup.log');

    // Log failed backup to history
    try {
        $db = getDbConnection();
        $stmt = $db->prepare("
            INSERT INTO backup_history (backup_type, backup_name, status, error_message)
            VALUES ('manual', ?, 'failed', ?)
        ");
        $backupName = 'failed_backup_' . date('Y-m-d_H-i-s');
        $errorMsg = $e->getMessage();
        $stmt->bind_param('ss', $backupName, $errorMsg);
        $stmt->execute();
        $stmt->close();
    } catch (Exception $logError) {
        // Ignore logging error
    }

    sendErrorResponse('Backup failed: ' . $e->getMessage(), 500);
}
