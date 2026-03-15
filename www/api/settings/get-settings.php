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

    // Get all settings from system_settings table (simple key-value structure)
    $query = "SELECT setting_key, setting_value FROM system_settings ORDER BY setting_key";
    $result = $db->query($query);

    if (!$result) {
        throw new Exception("Failed to fetch settings: " . $db->error);
    }

    // Organize settings - put all in 'general' category for simplicity
    $settings = ['general' => []];

    // Define sensitive keys that should be masked
    $sensitiveKeys = ['private_settings_pin', 'private_settings_secret', 'current_access_code', 'orthanc_password'];

    while ($row = $result->fetch_assoc()) {
        $settingKey = $row['setting_key'];
        $settingValue = $row['setting_value'];

        // Mask sensitive values
        $isSensitive = in_array($settingKey, $sensitiveKeys);
        if ($isSensitive && !empty($settingValue)) {
            $settingValue = str_repeat('*', 8);
        }

        // Convert boolean strings to actual booleans
        if (in_array(strtolower($settingValue), ['true', 'false'])) {
            $settingValue = strtolower($settingValue) === 'true';
        }

        $settings['general'][] = [
            'setting_key' => $settingKey,
            'setting_value' => $settingValue,
            'is_masked' => $isSensitive && !empty($row['setting_value'])
        ];
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
