<?php
/**
 * Settings API - Get Settings
 * Returns all system settings organized by category
 */
// Ensure no output before headers
error_reporting(0);
ini_set('display_errors', 0);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

try {
    // Include session management (handles config and session start correctly)
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

// Check authentication using centralized function
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check admin role
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin rights required.']);
    exit;
}

try {
    $db = getDbConnection();
    
    // Get all settings
    $query = "SELECT * FROM system_settings ORDER BY category, setting_key";
    $result = $db->query($query);
    
    if (!$result) {
        throw new Exception("Failed to fetch settings: " . $db->error);
    }
    
    // Organize settings by category
    $settings = [];
    while ($row = $result->fetch_assoc()) {
        $category = $row['category'] ?? 'general';
        
        if (!isset($settings[$category])) {
            $settings[$category] = [];
        }
        
        // Mask sensitive values
        if ($row['is_sensitive'] && !empty($row['setting_value'])) {
            $row['setting_value'] = str_repeat('*', 8);
            $row['is_masked'] = true;
        } else {
            $row['is_masked'] = false;
        }
        
        // Convert boolean strings to actual booleans for easier JS handling
        if ($row['setting_type'] === 'boolean') {
            $row['setting_value'] = filter_var($row['setting_value'], FILTER_VALIDATE_BOOLEAN);
        }
        
        // Convert integers
        if ($row['setting_type'] === 'integer' && $row['setting_value'] !== '') {
            $row['setting_value'] = (int)$row['setting_value'];
        }
        
        $settings[$category][] = $row;
    }
    
    $result->free();
    
    echo json_encode([
        'success' => true,
        'settings' => $settings
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
