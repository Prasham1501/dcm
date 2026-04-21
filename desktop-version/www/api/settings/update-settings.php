<?php
/**
 * Settings API - Update Settings
 * Updates one or more system settings
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
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin rights required.']);
    exit;
}

try {
    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['settings']) || !is_array($input['settings'])) {
        throw new Exception("Invalid input format");
    }
    
    $db = getDbConnection();
    
    // Start transaction
    $db->begin_transaction();
    
    $stmt = $db->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?");
    
    foreach ($input['settings'] as $key => $value) {
        // Handle boolean values
        if (is_bool($value)) {
            $value = $value ? 'true' : 'false';
        }
        
        // Handle sensitive values (don't update if it's the mask)
        if ($value === '********') {
            continue;
        }
        
        $stmt->bind_param('ss', $value, $key);
        $stmt->execute();
    }
    
    $db->commit();
    $stmt->close();
    
    echo json_encode(['success' => true, 'message' => 'Settings updated successfully']);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollback();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
