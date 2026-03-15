<?php
/**
 * Backup All Accounts API
 * Creates backups to all active Google Drive accounts
 */

// Disable all error output - CRITICAL for JSON responses
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering to catch any stray output
ob_start();

define('DICOM_VIEWER', true);

// Custom error handler to prevent any HTML error output
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    error_log("Backup API Error: $errstr in $errfile on line $errline");
    return true; // Suppress error output
});

try {
    require_once __DIR__ . '/../../auth/session.php';
    require_once __DIR__ . '/../../vendor/autoload.php';
    require_once __DIR__ . '/../../includes/classes/BackupManager.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System initialization failed: ' . $e->getMessage()], JSON_UNESCAPED_SLASHES);
    exit;
} catch (Error $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Fatal error: ' . $e->getMessage()], JSON_UNESCAPED_SLASHES);
    exit;
}

// Clean output buffer and set JSON header
ob_end_clean();
header('Content-Type: application/json; charset=utf-8');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check admin
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

try {
    $db = getDbConnection();

    // Get all active accounts
    $accountsResult = $db->query("
        SELECT id, account_name, backup_provider, credentials_json, dropbox_access_token, folder_name
        FROM backup_accounts
        WHERE is_active = 1
    ");

    if (!$accountsResult) {
        throw new Exception('Database query failed: ' . $db->error);
    }

    if ($accountsResult->num_rows == 0) {
        throw new Exception('No active backup accounts configured');
    }
    
    $successCount = 0;
    $failCount = 0;
    $results = [];
    
    // Load multi-provider backup manager
    require_once __DIR__ . '/../../includes/classes/MultiProviderBackupManager.php';
    
    while ($account = $accountsResult->fetch_assoc()) {
        try {
            $provider = $account['backup_provider'] ?? 'google_drive';
            
            if ($provider === 'dropbox') {
                // Dropbox backup
                if (empty($account['dropbox_access_token'])) {
                    throw new Exception('Dropbox access token not configured');
               }
                
                // Set temp config for Dropbox
                $tempTokenStmt = $db->prepare("
                    INSERT INTO hospital_data_config (config_key, config_value)
                    VALUES ('temp_dropbox_token', ?)
                    ON DUPLICATE KEY UPDATE config_value = ?
                ");
                $token = $account['dropbox_access_token'];
                $tempTokenStmt->bind_param('ss', $token, $token);
                $tempTokenStmt->execute();
                $tempTokenStmt->close();
                
                $tempFolderStmt = $db->prepare("
                    INSERT INTO hospital_data_config (config_key, config_value)
                    VALUES ('temp_dropbox_folder', ?)
                    ON DUPLICATE KEY UPDATE config_value = ?
                ");
                $tempFolderStmt->bind_param('ss', $account['folder_name'], $account['folder_name']);
                $tempFolderStmt->execute();
                $tempFolderStmt->close();
                
            } else {
                // Google Drive backup
                $credentials = json_decode($account['credentials_json'], true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('Invalid credentials JSON: ' . json_last_error_msg());
                }

                // Temporarily set credentials for this account
                $tempConfigStmt = $db->prepare("
                    INSERT INTO hospital_data_config (config_key, config_value)
                    VALUES ('temp_gdrive_credentials', ?)
                    ON DUPLICATE KEY UPDATE config_value = ?
                ");
                $credsJson = $account['credentials_json'];
                $tempConfigStmt->bind_param('ss', $credsJson, $credsJson);
                if (!$tempConfigStmt->execute()) {
                    throw new Exception('Failed to set temp credentials: ' . $tempConfigStmt->error);
                }
                $tempConfigStmt->close();
                
                $tempFolderStmt = $db->prepare("
                    INSERT INTO hospital_data_config (config_key, config_value)
                    VALUES ('temp_gdrive_folder', ?)
                    ON DUPLICATE KEY UPDATE config_value = ?
                ");
                $tempFolderStmt->bind_param('ss', $account['folder_name'], $account['folder_name']);
                $tempFolderStmt->execute();
                $tempFolderStmt->close();
            }
            
            // Create backup using multi-provider manager
            $backupManager = new MultiProviderBackupManager();
            $result = $backupManager->createBackup($provider, 'manual');
            
            // Update account
            $updateStmt = $db->prepare("
                UPDATE backup_accounts 
                SET last_backup_date = NOW(), last_backup_status = 'success'
                WHERE id = ?
            ");
            $updateStmt->bind_param('i', $account['id']);
            $updateStmt->execute();
            $updateStmt->close();
            
            $successCount++;
            $results[] = [
                'account' => $account['account_name'],
                'status' => 'success',
                'filename' => $result['filename']
            ];
            
        } catch (Exception $e) {
            $errorMsg = $e->getMessage();
            $updateStmt = $db->prepare("
                UPDATE backup_accounts
                SET last_backup_date = NOW(), last_backup_status = ?
                WHERE id = ?
            ");
            $updateStmt->bind_param('si', $errorMsg, $account['id']);
            $updateStmt->execute();
            $updateStmt->close();

            $failCount++;
            $results[] = [
                'account' => $account['account_name'],
                'status' => 'failed',
                'error' => $errorMsg
            ];
        } catch (Error $e) {
            $errorMsg = 'PHP Error: ' . $e->getMessage();
            $updateStmt = $db->prepare("
                UPDATE backup_accounts
                SET last_backup_date = NOW(), last_backup_status = ?
                WHERE id = ?
            ");
            $updateStmt->bind_param('si', $errorMsg, $account['id']);
            $updateStmt->execute();
            $updateStmt->close();

            $failCount++;
            $results[] = [
                'account' => $account['account_name'],
                'status' => 'failed',
                'error' => $errorMsg
            ];
        }
    }

    // Clean up temp credentials
    $db->query("DELETE FROM hospital_data_config WHERE config_key LIKE 'temp_gdrive%'");

    echo json_encode([
        'success' => true,
        'successful' => $successCount,
        'failed' => $failCount,
        'results' => $results
    ], JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_SLASHES);
} catch (Error $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Fatal error: ' . $e->getMessage()], JSON_UNESCAPED_SLASHES);
}
?>
