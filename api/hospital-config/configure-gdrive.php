<?php
/**
 * Hospital Config API - Configure Google Drive
 */
// Ensure no output before headers
error_reporting(0);
ini_set('display_errors', 0);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

try {
    // Include session management
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

// Clear buffer and set header
ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check admin role
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $credentials = $input['credentials'] ?? null;
    $folderName = $input['folder_name'] ?? 'DICOM_Viewer_Backups';
    
    if (empty($credentials)) {
        throw new Exception("Credentials are required");
    }
    
    // Validate service account credentials
    if (!isset($credentials['type']) || $credentials['type'] !== 'service_account') {
        throw new Exception("Invalid credentials format. Must be a service account JSON file.");
    }
    
    if (!isset($credentials['client_email']) || !isset($credentials['private_key'])) {
        throw new Exception("Credentials missing required fields");
    }
    
    $db = getDbConnection();
    
    // Store credentials as JSON string
    $credentialsJson = json_encode($credentials);
    
    // Update or insert configuration
    $configs = [
        'gdrive_credentials' => $credentialsJson,
        'gdrive_folder_name' => $folderName,
        'gdrive_service_account_email' => $credentials['client_email'],
        'gdrive_configured' => 'true'
    ];
    
    $stmt = $db->prepare("
        INSERT INTO hospital_data_config (config_key, config_value) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE config_value = ?
    ");
    
    foreach ($configs as $key => $value) {
        $stmt->bind_param('sss', $key, $value, $value);
        $stmt->execute();
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'Google Drive configured successfully. Remember to share your Drive folder with: ' . $credentials['client_email']
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
