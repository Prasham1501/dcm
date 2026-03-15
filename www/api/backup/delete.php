<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Delete Backup
 *
 * DELETE /api/backup/delete.php
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

// Only accept DELETE requests
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
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

    // Get backup info
    $stmt = $db->prepare("SELECT * FROM backup_history WHERE id = ?");
    $stmt->bind_param('i', $backupId);
    $stmt->execute();
    $result = $stmt->get_result();
    $backup = $result->fetch_assoc();
    $stmt->close();

    if (!$backup) {
        sendErrorResponse('Backup not found', 404);
    }

    // Load Google Drive Backup class
    require_once __DIR__ . '/../../includes/classes/GoogleDriveBackup.php';

    // Initialize backup service
    $backupService = new \DicomViewer\GoogleDriveBackup($db);

    // Delete from Google Drive
    if ($backup['gdrive_file_id']) {
        $backupService->deleteBackup($backup['gdrive_file_id']);
    }

    // Audit log
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (?, ?, 'delete_backup', 'backup', ?, ?, ?, ?)
    ");

    $details = json_encode([
        'backup_id' => $backupId,
        'backup_name' => $backup['backup_name'],
        'gdrive_file_id' => $backup['gdrive_file_id']
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
        "Backup deleted: {$backup['backup_name']} by user ID: {$_SESSION['user_id']}",
        'info',
        'backup.log'
    );

    sendSuccessResponse([
        'backup_id' => $backupId,
        'backup_name' => $backup['backup_name']
    ], 'Backup deleted successfully');

} catch (Exception $e) {
    logMessage("Delete backup error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Failed to delete backup: ' . $e->getMessage(), 500);
}
