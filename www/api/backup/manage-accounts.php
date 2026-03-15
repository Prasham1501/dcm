<?php
/**
 * Backup Accounts Management API
 * Add, edit, remove, and list Google Drive backup accounts
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

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

$method = $_SERVER['REQUEST_METHOD'];
$db = getDbConnection();

try {
    switch ($method) {
        case 'GET':
            // List all accounts
            $result = $db->query("
                SELECT id, account_name, service_account_email, folder_name, 
                       is_active, last_backup_date, last_backup_status
                FROM backup_accounts 
                ORDER BY created_at DESC
            ");
            
            $accounts = [];
            while ($row = $result->fetch_assoc()) {
                $accounts[] = $row;
            }
            
            echo json_encode(['success' => true, 'accounts' => $accounts]);
            break;
            
        case 'POST':
            // Add new account
            $input = json_decode(file_get_contents('php://input'), true);
            
            $accountName = $input['account_name'] ?? '';
            $provider = $input['backup_provider'] ?? 'google_drive';
            $folderName = $input['folder_name'] ?? 'DICOM_Viewer_Backups';
            
            if (empty($accountName)) {
                throw new Exception('Account name is required');
            }
            
            $credentialsJson = null;
            $serviceEmail = null;
            $dropboxToken = null;
            
            if ($provider === 'dropbox') {
                // Dropbox provider - requires access token
                $dropboxToken = $input['dropbox_access_token'] ?? '';
                if (empty($dropboxToken)) {
                    throw new Exception('Dropbox access token is required');
                }
                $serviceEmail = 'dropbox-' . substr($dropboxToken, 0, 10); // Identifier
                
            } else {
                // Google Drive provider - requires credentials JSON
                $credentials = $input['credentials'] ?? null;
                if (empty($credentials)) {
                    throw new Exception('Google Drive credentials are required');
                }
                
                // Accept both OAuth 2.0 and Service Account credentials
                $isServiceAccount = isset($credentials['type']) && $credentials['type'] === 'service_account' && isset($credentials['client_email']);
                $isOAuth = isset($credentials['installed']) || isset($credentials['web']);
                
                if (!$isServiceAccount && !$isOAuth) {
                    throw new Exception('Invalid credentials format. Must be OAuth 2.0 or Service Account JSON');
                }
                
                $credentialsJson = json_encode($credentials);
                
                // For Service Account, use client_email. For OAuth, use client_id
                if ($isServiceAccount) {
                    $serviceEmail = $credentials['client_email'];
                } else {
                    $serviceEmail = isset($credentials['installed']['client_id']) 
                        ? $credentials['installed']['client_id'] 
                        : (isset($credentials['web']['client_id']) ? $credentials['web']['client_id'] : 'oauth-account');
                }
            }
            
            $stmt = $db->prepare("
                INSERT INTO backup_accounts 
                (account_name, backup_provider, credentials_json, dropbox_access_token, service_account_email, folder_name, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->bind_param('ssssss', $accountName, $provider, $credentialsJson, $dropboxToken, $serviceEmail, $folderName);
            $stmt->execute();
            $accountId = $stmt->insert_id;
            $stmt->close();
            
            echo json_encode([
                'success' => true,
                'message' => 'Backup account added successfully',
                'account_id' => $accountId
            ]);
            break;
            
        case 'PUT':
            // Update account
            $input = json_decode(file_get_contents('php://input'), true);
            
            $accountId = $input['id'] ?? 0;
            $accountName = $input['account_name'] ?? '';
            $folderName = $input['folder_name'] ?? '';
            $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 1;
            
            if (empty($accountId) || empty($accountName)) {
                throw new Exception('Account ID and name are required');
            }
            
            $stmt = $db->prepare("
                UPDATE backup_accounts 
                SET account_name = ?, folder_name = ?, is_active = ?
                WHERE id = ?
            ");
            $stmt->bind_param('ssii', $accountName, $folderName, $isActive, $accountId);
            $stmt->execute();
            $stmt->close();
            
            echo json_encode(['success' => true, 'message' => 'Account updated successfully']);
            break;
            
        case 'DELETE':
            // Remove account
            $input = json_decode(file_get_contents('php://input'), true);
            $accountId = $input['id'] ?? 0;
            
            if (empty($accountId)) {
                throw new Exception('Account ID is required');
            }
            
            $stmt = $db->prepare("DELETE FROM backup_accounts WHERE id = ?");
            $stmt->bind_param('i', $accountId);
            $stmt->execute();
            $stmt->close();
            
            echo json_encode(['success' => true, 'message' => 'Account removed successfully']);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
