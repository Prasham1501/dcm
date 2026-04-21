<?php
/**
 * Backup Scheduler - Run via cron/task scheduler every hour
 * Checks if backup is due and executes backup to all active accounts
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/vendor/autoload.php';

echo "[" . date('Y-m-d H:i:s') . "] Backup scheduler started\n";

$db = getDbConnection();

// Check if backups are enabled and due
$configResult = $db->query("SELECT * FROM backup_schedule_config LIMIT 1");
$config = $configResult->fetch_assoc();

if (!$config || !$config['schedule_enabled']) {
    echo "Automatic backups are disabled\n";
    exit(0);
}

$now = new DateTime();
$nextBackupTime = new DateTime($config['next_backup_time']);

if ($now < $nextBackupTime) {
    echo "Next backup scheduled for: " . $nextBackupTime->format('Y-m-d H:i:s') . "\n";
    echo "Current time: " . $now->format('Y-m-d H:i:s') . "\n";
    exit(0);
}

echo "Backup is due! Starting backup process...\n";

// Get all active backup accounts
$accountsResult = $db->query("
    SELECT id, account_name, credentials_json, folder_name 
    FROM backup_accounts 
    WHERE is_active = 1
");

$successCount = 0;
$errorCount = 0;

while ($account = $accountsResult->fetch_assoc()) {
    echo "\nBacking up to account: {$account['account_name']}\n";
    
    try {
        // Create backup using this account's credentials
        $credentials = json_decode($account['credentials_json'], true);
        
        // Temporarily store credentials for BackupManager
        $tempConfigStmt = $db->prepare("
            INSERT INTO hospital_data_config (config_key, config_value)
            VALUES ('temp_gdrive_credentials', ?)
            ON DUPLICATE KEY UPDATE config_value = ?
        ");
        $credsJson = json_encode($credentials);
        $tempConfigStmt->bind_param('ss', $credsJson, $credsJson);
        $tempConfigStmt->execute();
        $tempConfigStmt->close();
        
        // Set folder name
        $tempFolderStmt = $db->prepare("
            INSERT INTO hospital_data_config (config_key, config_value)
            VALUES ('temp_gdrive_folder', ?)
            ON DUPLICATE KEY UPDATE config_value = ?
        ");
        $tempFolderStmt->bind_param('ss', $account['folder_name'], $account['folder_name']);
        $tempFolderStmt->execute();
        $tempFolderStmt->close();
        
        // Create backup
        require_once __DIR__ . '/includes/classes/BackupManager.php';
        $backupManager = new BackupManager();
        $result = $backupManager->createBackup('scheduled');
        
        // Update account status
        $updateStmt = $db->prepare("
            UPDATE backup_accounts 
            SET last_backup_date = NOW(), last_backup_status = 'success'
            WHERE id = ?
        ");
        $updateStmt->bind_param('i', $account['id']);
        $updateStmt->execute();
        $updateStmt->close();
        
        echo "✓ Backup successful: {$result['filename']}\n";
        $successCount++;
        
    } catch (Exception $e) {
        echo "✗ Backup failed: " . $e->getMessage() . "\n";
        
        // Update account with error
        $errorMsg = $e->getMessage();
        $updateStmt = $db->prepare("
            UPDATE backup_accounts 
            SET last_backup_date = NOW(), last_backup_status = ?
            WHERE id = ?
        ");
        $updateStmt->bind_param('si', $errorMsg, $account['id']);
        $updateStmt->execute();
        $updateStmt->close();
        
        $errorCount++;
    }
}

// Clean up temp credentials
$db->query("DELETE FROM hospital_data_config WHERE config_key LIKE 'temp_gdrive%'");

// Update next backup time
$nextBackup = new DateTime();
$nextBackup->modify("+{$config['interval_hours']} hours");

$updateScheduleStmt = $db->prepare("
    UPDATE backup_schedule_config 
    SET last_run_time = NOW(), next_backup_time = ?
    WHERE id = ?
");
$nextBackupStr = $nextBackup->format('Y-m-d H:i:s');
$updateScheduleStmt->bind_param('si', $nextBackupStr, $config['id']);
$updateScheduleStmt->execute();
$updateScheduleStmt->close();

echo "\n=== Backup Summary ===\n";
echo "Successful: $successCount\n";
echo "Failed: $errorCount\n";
echo "Next backup: " . $nextBackup->format('Y-m-d H:i:s') . "\n";
echo "[" . date('Y-m-d H:i:s') . "] Backup scheduler completed\n";

$db->close();
?>
