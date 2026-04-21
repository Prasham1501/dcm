<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Get Last Backup Status
 *
 * GET /api/backup/status.php
 *
 * Returns last backup status and configuration
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

    // Get backup configuration
    $configQuery = "SELECT * FROM gdrive_backup_config LIMIT 1";
    $configResult = $db->query($configQuery);
    $config = $configResult->fetch_assoc();
    $configResult->free();

    // Get last backup
    $backupQuery = "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 1";
    $backupResult = $db->query($backupQuery);
    $lastBackup = $backupResult->fetch_assoc();
    $backupResult->free();

    // Get backup statistics
    $statsQuery = "
        SELECT
            COUNT(*) as total_backups,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_backups,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_backups,
            SUM(CASE WHEN status = 'success' THEN file_size_bytes ELSE 0 END) as total_size_bytes
        FROM backup_history
    ";
    $statsResult = $db->query($statsQuery);
    $stats = $statsResult->fetch_assoc();
    $statsResult->free();

    // Calculate next scheduled backup time
    $nextBackup = null;
    if ($config['backup_enabled']) {
        $backupTime = $config['backup_time'];
        $schedule = $config['backup_schedule'];

        $now = new DateTime();
        $scheduledTime = new DateTime($backupTime);

        switch ($schedule) {
            case 'daily':
                if ($scheduledTime < $now) {
                    $scheduledTime->modify('+1 day');
                }
                $nextBackup = $scheduledTime->format('Y-m-d H:i:s');
                break;

            case 'weekly':
                $scheduledTime->modify('next monday');
                $nextBackup = $scheduledTime->format('Y-m-d H:i:s');
                break;

            case 'monthly':
                $scheduledTime->modify('first day of next month');
                $nextBackup = $scheduledTime->format('Y-m-d H:i:s');
                break;
        }
    }

    // Format file sizes
    $formatBytes = function($bytes) {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));
        return round($bytes, 2) . ' ' . $units[$pow];
    };

    $response = [
        'configuration' => [
            'backup_enabled' => (bool)$config['backup_enabled'],
            'backup_schedule' => $config['backup_schedule'],
            'backup_time' => $config['backup_time'],
            'retention_days' => (int)$config['retention_days'],
            'folder_name' => $config['folder_name'],
            'has_credentials' => !empty($config['client_id']) && !empty($config['client_secret']),
            'is_authenticated' => !empty($config['refresh_token']),
            'last_backup_at' => $config['last_backup_at'],
            'next_backup_at' => $nextBackup,
            'backup_database' => (bool)$config['backup_database'],
            'backup_php_files' => (bool)$config['backup_php_files'],
            'backup_js_files' => (bool)$config['backup_js_files'],
            'backup_config_files' => (bool)$config['backup_config_files']
        ],
        'last_backup' => $lastBackup ? [
            'id' => $lastBackup['id'],
            'backup_name' => $lastBackup['backup_name'],
            'backup_type' => $lastBackup['backup_type'],
            'status' => $lastBackup['status'],
            'size_bytes' => (int)$lastBackup['file_size_bytes'],
            'size_formatted' => $formatBytes($lastBackup['file_size_bytes']),
            'created_at' => $lastBackup['created_at'],
            'error_message' => $lastBackup['error_message']
        ] : null,
        'statistics' => [
            'total_backups' => (int)$stats['total_backups'],
            'successful_backups' => (int)$stats['successful_backups'],
            'failed_backups' => (int)$stats['failed_backups'],
            'total_size_bytes' => (int)$stats['total_size_bytes'],
            'total_size_formatted' => $formatBytes($stats['total_size_bytes'])
        ]
    ];

    sendSuccessResponse($response, 'Backup status retrieved successfully');

} catch (Exception $e) {
    logMessage("Get backup status error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Failed to get backup status: ' . $e->getMessage(), 500);
}
