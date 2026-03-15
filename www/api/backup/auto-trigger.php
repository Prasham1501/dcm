<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Auto-Trigger Backup Scheduler
 *
 * This endpoint should be called periodically (e.g., on every page load)
 * to check if backup is due and trigger it automatically
 *
 * GET /api/backup/auto-trigger.php
 *
 * This runs silently in the background without blocking the user
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

header('Content-Type: application/json');

// Allow CORS for internal requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

try {
    // Get database connection
    $db = getDbConnection();

    // Check if backup is enabled
    $query = "SELECT backup_enabled, backup_schedule, backup_time, last_backup_at
              FROM gdrive_backup_config
              WHERE id = 1 LIMIT 1";

    $result = $db->query($query);

    if (!$result) {
        throw new Exception("Failed to query backup config");
    }

    $config = $result->fetch_assoc();
    $result->free();

    if (!$config || !$config['backup_enabled']) {
        sendSuccessResponse([
            'triggered' => false,
            'reason' => 'Backup not enabled'
        ]);
    }

    // Check if backup is due
    $lastBackup = $config['last_backup_at'] ? strtotime($config['last_backup_at']) : 0;
    $currentTime = time();
    $backupSchedule = $config['backup_schedule']; // daily, weekly, monthly
    $backupTime = $config['backup_time']; // HH:MM:SS

    // Calculate next backup time
    $isDue = false;
    $nextBackupTime = 0;

    switch ($backupSchedule) {
        case 'hourly':
            // Check if 1 hour has passed
            if ($currentTime - $lastBackup >= 3600) { // 1 hour in seconds
                $isDue = true;
            }
            $nextBackupTime = $lastBackup + 3600;
            break;

        case 'daily':
            // Check if 24 hours have passed
            if ($currentTime - $lastBackup >= 86400) { // 24 hours in seconds
                $isDue = true;
            }
            $nextBackupTime = $lastBackup + 86400;
            break;

        case 'weekly':
            // Check if 7 days have passed
            if ($currentTime - $lastBackup >= 604800) { // 7 days in seconds
                $isDue = true;
            }
            $nextBackupTime = $lastBackup + 604800;
            break;

        case 'monthly':
            // Check if 30 days have passed
            if ($currentTime - $lastBackup >= 2592000) { // 30 days in seconds
                $isDue = true;
            }
            $nextBackupTime = $lastBackup + 2592000;
            break;
    }

    if (!$isDue) {
        sendSuccessResponse([
            'triggered' => false,
            'reason' => 'Backup not due yet',
            'last_backup' => $config['last_backup_at'],
            'next_backup' => date('Y-m-d H:i:s', $nextBackupTime),
            'schedule' => $backupSchedule
        ]);
    }

    // Backup is due - trigger it in the background
    // We'll use a background PHP process to avoid blocking the user

    $scriptPath = __DIR__ . '/../../backup-scheduler.php';
    $logFile = __DIR__ . '/../../logs/auto-backup.log';

    // Windows command to run PHP in background
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        // Windows: Use 'start' command to run in background
        $command = sprintf(
            'start /B php "%s" > "%s" 2>&1',
            $scriptPath,
            $logFile
        );
        pclose(popen($command, 'r'));
    } else {
        // Linux/Unix: Use & to run in background
        $command = sprintf(
            'php "%s" > "%s" 2>&1 &',
            $scriptPath,
            $logFile
        );
        exec($command);
    }

    logMessage("Auto-triggered backup scheduler (due: {$backupSchedule})", 'info', 'backup.log');

    sendSuccessResponse([
        'triggered' => true,
        'reason' => 'Backup was due',
        'schedule' => $backupSchedule,
        'last_backup' => $config['last_backup_at'],
        'message' => 'Backup process started in background'
    ]);

} catch (Exception $e) {
    logMessage("Auto-trigger error: " . $e->getMessage(), 'error', 'backup.log');

    sendSuccessResponse([
        'triggered' => false,
        'reason' => 'Error: ' . $e->getMessage()
    ]);
}