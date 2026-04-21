<?php
/**
 * Update Orthanc Configuration
 * Automatically updates Orthanc's Configuration.json with settings from the database
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Only admin can modify settings
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Get settings from input
    $orthancUrl = $input['orthanc_url'] ?? ORTHANC_URL;
    $orthancUsername = $input['orthanc_username'] ?? ORTHANC_USERNAME;
    $orthancPassword = $input['orthanc_password'] ?? ORTHANC_PASSWORD;
    $dicomAet = $input['dicom_aet'] ?? 'ORTHANC';
    $dicomPort = (int)($input['dicom_port'] ?? 4242);
    $httpPort = (int)($input['http_port'] ?? 8042);
    
    // Try to find Orthanc configuration file
    $possiblePaths = [
        'C:/Orthanc/Configuration.json',
        'C:/Program Files/Orthanc/Configuration.json',
        'C:/Program Files (x86)/Orthanc/Configuration.json',
        __DIR__ . '/../../orthanc-config/orthanc.json',
        __DIR__ . '/../../orthanc-config/Configuration.json',
        ORTHANC_STORAGE_PATH . '/../Configuration.json'
    ];
    
    $configPath = null;
    foreach ($possiblePaths as $path) {
        if (file_exists($path)) {
            $configPath = $path;
            break;
        }
    }
    
    // Build configuration object
    $config = [
        'Name' => 'DICOM Viewer Orthanc',
        'DicomAet' => $dicomAet,
        'DicomPort' => $dicomPort,
        'HttpPort' => $httpPort,
        'RegisteredUsers' => [
            $orthancUsername => $orthancPassword
        ],
        'RemoteAccessAllowed' => true,
        'AuthenticationEnabled' => true,
        'SslEnabled' => false,
        'DicomServerEnabled' => true,
        'DicomTlsEnabled' => false,
        'DicomAlwaysAllowEcho' => true,
        'DicomAlwaysAllowStore' => true,
        'DicomCheckCalledAet' => false,
        'DicomCheckModalityHost' => false,
    ];
    
    $response = ['success' => true];
    
    // If config file found, update it
    if ($configPath && is_writable($configPath)) {
        // Read existing config
        $existingConfig = json_decode(file_get_contents($configPath), true);
        
        // Merge with new settings (preserve other settings)
        if ($existingConfig) {
            $config = array_merge($existingConfig, $config);
        }
        
        // Write updated config
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($configPath, $json)) {
            $response['config_updated'] = true;
            $response['config_path'] = $configPath;
            $response['message'] = 'Orthanc configuration updated successfully';
            $response['restart_required'] = true;
        } else {
            $response['config_updated'] = false;
            $response['warning'] = 'Failed to write configuration file';
        }
    } else {
        $response['config_updated'] = false;
        $response['warning'] = 'Orthanc configuration file not found or not writable';
        $response['suggestion'] = 'Please manually update Configuration.json';
        $response['generated_config'] = $config;
    }
    
    // Save settings to database
    $mysqli = getDbConnection();
    $settings = [
        'orthanc_url' => $orthancUrl,
        'orthanc_username' => $orthancUsername,
        'orthanc_password' => $orthancPassword,
        'orthanc_dicom_aet' => $dicomAet,
        'orthanc_dicom_port' => $dicomPort,
        'orthanc_http_port' => $httpPort
    ];
    
    foreach ($settings as $key => $value) {
        $stmt = $mysqli->prepare("
            INSERT INTO system_settings (setting_key, setting_value, category, updated_at)
            VALUES (?, ?, 'orthanc', NOW())
            ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()
        ");
        $stmt->bind_param("sss", $key, $value, $value);
        $stmt->execute();
        $stmt->close();
    }
    
    $response['database_saved'] = true;
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
