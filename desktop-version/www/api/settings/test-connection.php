<?php
/**
 * Settings API - Test Orthanc Connection
 * Tests connection to Orthanc server with provided settings
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

try {
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    $url = rtrim($input['orthanc_url'] ?? '', '/');
    $username = $input['orthanc_username'] ?? '';
    $password = $input['orthanc_password'] ?? '';
    
    if (empty($url)) {
        throw new Exception("Orthanc URL is required");
    }
    
    // Test connection to Orthanc system info endpoint
    $ch = curl_init($url . '/system');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    if (!empty($username)) {
        curl_setopt($ch, CURLOPT_USERPWD, $username . ':' . $password);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    }
    
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $systemData = json_decode($response, true);
        
        // Build orthanc_info object with all needed fields
        $orthancInfo = [
            'version' => $systemData['Version'] ?? 'Unknown',
            'name' => $systemData['Name'] ?? 'Unknown',
            'dicom_aet' => $systemData['DicomAet'] ?? 'ORTHANC',
            'dicom_port' => $systemData['DicomPort'] ?? 4242
        ];
        
        echo json_encode([
            'success' => true,
            'message' => 'Connection successful',
            'orthanc_info' => $orthancInfo
        ]);
    } else {
        throw new Exception("Connection failed (HTTP $httpCode): " . ($error ?: 'Invalid response'));
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
