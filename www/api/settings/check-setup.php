<?php
/**
 * Check Setup Status API
 * Returns whether first-time setup is required
 */
define('DICOM_VIEWER', true);

header('Content-Type: application/json');

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!isLoggedIn()) {
    echo json_encode(['setupRequired' => false, 'isAdmin' => false]);
    exit;
}

$db = getDbConnection();

try {
    // Check if setup is complete
    $setupComplete = false;
    $hospitalConfigured = false;

    // Check system_settings table first (main app table)
    $systemTableExists = false;
    $result = $db->query("SHOW TABLES LIKE 'system_settings'");
    if ($result && $result->num_rows > 0) {
        $systemTableExists = true;
    }

    // Also check settings table (backup)
    $settingsTableExists = false;
    $result = $db->query("SHOW TABLES LIKE 'settings'");
    if ($result && $result->num_rows > 0) {
        $settingsTableExists = true;
    }

    // Check system_settings first (primary source - where app reads from)
    if ($systemTableExists) {
        // Check for hospital_name in system_settings
        $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'hospital_name' AND setting_value != '' LIMIT 1");
        if ($result && $result->num_rows > 0) {
            $hospitalConfigured = true;
        }

        // Check for setup_complete flag in system_settings
        $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'setup_complete' AND setting_value = '1' LIMIT 1");
        if ($result && $result->num_rows > 0 && $hospitalConfigured) {
            $setupComplete = true;
        }
    }

    // Fallback: Also check settings table if not found in system_settings
    if (!$hospitalConfigured && $settingsTableExists) {
        $result = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'hospital_name' AND setting_value != '' LIMIT 1");
        if ($result && $result->num_rows > 0) {
            $hospitalConfigured = true;
        }

        $result = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'setup_complete' AND setting_value = '1' LIMIT 1");
        if ($result && $result->num_rows > 0 && $hospitalConfigured) {
            $setupComplete = true;
        }
    }

    // If no tables or no hospital config, setup is definitely required
    if ((!$systemTableExists && !$settingsTableExists) || !$hospitalConfigured) {
        $setupComplete = false;
    }

    // Check if current user is admin
    $userRole = $_SESSION['role'] ?? 'viewer';
    $isAdmin = in_array($userRole, ['admin', 'super_admin']);

    echo json_encode([
        'success' => true,
        'setupRequired' => !$setupComplete,
        'setupComplete' => $setupComplete,
        'isAdmin' => $isAdmin,
        'userId' => $_SESSION['user_id'] ?? null
    ]);

} catch (Exception $e) {
    // If there's an error (like table doesn't exist), setup IS required
    $userRole = $_SESSION['role'] ?? 'viewer';
    $isAdmin = in_array($userRole, ['admin', 'super_admin']);

    echo json_encode([
        'success' => true,
        'setupRequired' => true,
        'setupComplete' => false,
        'isAdmin' => $isAdmin,
        'userId' => $_SESSION['user_id'] ?? null
    ]);
}
