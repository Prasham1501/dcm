<?php
/**
 * Test Backup Account Configuration
 * Tests if the backup account credentials are valid
 */

// Disable error output for clean JSON response
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

// Custom error handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    error_log("Test Backup Error: $errstr in $errfile on line $errline");
    return true;
});

try {
    require_once __DIR__ . '/../../includes/config.php';
    require_once __DIR__ . '/../../auth/session.php';
    require_once __DIR__ . '/../../vendor/autoload.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Initialization failed: ' . $e->getMessage()]);
    exit;
}

ob_end_clean();
header('Content-Type: application/json; charset=utf-8');

// Check authentication
if (!isLoggedIn() || !isAdmin()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

try {
    $db = getDbConnection();

    // Get the first active account
    $result = $db->query("
        SELECT id, account_name, credentials_json, folder_name, service_account_email
        FROM backup_accounts
        WHERE is_active = 1
        LIMIT 1
    ");

    if (!$result || $result->num_rows == 0) {
        throw new Exception('No active backup accounts found');
    }

    $account = $result->fetch_assoc();

    // Parse credentials
    $credentials = json_decode($account['credentials_json'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON in credentials: ' . json_last_error_msg());
    }

    // Validate required fields
    $required = ['type', 'project_id', 'private_key', 'client_email'];
    foreach ($required as $field) {
        if (empty($credentials[$field])) {
            throw new Exception("Missing required field: {$field}");
        }
    }

    // Try to initialize Google Drive client
    $client = new Google_Client();
    $client->setAuthConfig($credentials);
    $client->addScope(Google_Service_Drive::DRIVE_FILE);

    // Get Drive service
    $driveService = new Google_Service_Drive($client);

    // Test by listing files (or creating a folder)
    $fileList = $driveService->files->listFiles([
        'pageSize' => 1,
        'fields' => 'files(id, name)'
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Google Drive connection successful!',
        'account_name' => $account['account_name'],
        'service_account_email' => $account['service_account_email'],
        'folder_name' => $account['folder_name'],
        'credentials_valid' => true
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
