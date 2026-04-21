<?php
/**
 * Test Google Drive Connection
 * Verifies that Google Drive API is accessible with stored credentials
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
    require_once __DIR__ . '/../../vendor/autoload.php';
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
    $db = getDbConnection();
    
    // Get stored credentials
    $stmt = $db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = 'gdrive_credentials'");
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    if (!$row || empty($row['config_value'])) {
        throw new Exception('Google Drive not configured. Please upload credentials first.');
    }
    
    $credentials = json_decode($row['config_value'], true);
    
    if (!$credentials) {
        throw new Exception('Invalid credentials stored');
    }
    
    // Create Google Client
    $client = new Google_Client();
    $client->setAuthConfig($credentials);
    $client->addScope(Google_Service_Drive::DRIVE_FILE);
    $client->setApplicationName('DICOM Viewer Pro');
    
    // Create Drive service
    $driveService = new Google_Service_Drive($client);
    
    // Try to list files (limited to 1) to test connection
    $optParams = [
        'pageSize' => 1,
        'fields' => 'files(id, name)'
    ];
    
    $results = $driveService->files->listFiles($optParams);
    
    echo json_encode([
        'success' => true,
        'message' => 'Successfully connected to Google Drive!',
        'service_account' => $credentials['client_email'] ?? 'Unknown'
    ]);
    
} catch (Google_Service_Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Google API Error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
