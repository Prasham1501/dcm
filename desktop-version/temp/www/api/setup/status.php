<?php
/**
 * Setup Status Check API
 * Returns whether the setup wizard has been completed
 * Used by Electron to decide where to navigate:
 * 1. No license → /setup.php (license activation)
 * 2. License OK, no setup → /install/setup-hospital-server.php
 * 3. License OK, setup done → /login.php
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

header('Content-Type: application/json');

$db = getDbConnection();

$setupComplete = false;
$hasAdminUsers = false;  // Non-super-admin users (hospital admins)
$hasLicense = false;

try {
    // Check if license is activated (installation_license table)
    $result = $db->query("SELECT license_key FROM installation_license WHERE id = 1 AND license_key IS NOT NULL AND license_key != ''");
    if ($result && $row = $result->fetch_assoc()) {
        $hasLicense = !empty($row['license_key']);
    }
    
    // Check if system_settings has setup_complete flag - THIS IS THE PRIMARY CHECK
    // NOTE: The key is 'setup_complete' (without 'd') - this is what complete.php saves
    $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'setup_complete'");
    if ($result && $row = $result->fetch_assoc()) {
        $setupComplete = ($row['setting_value'] === '1');
    }

    // Fallback: check settings table for setup_complete
    if (!$setupComplete) {
        $result = $db->query("SELECT setting_value FROM settings WHERE setting_key = 'setup_complete'");
        if ($result && $row = $result->fetch_assoc()) {
            $setupComplete = ($row['setting_value'] === '1');
        }
    }
    
    // Check if at least one non-super-admin user exists (hospital admin)
    $result = $db->query("SELECT COUNT(*) as count FROM users WHERE is_super_admin = 0 OR is_super_admin IS NULL");
    if ($result && $row = $result->fetch_assoc()) {
        $hasAdminUsers = ($row['count'] > 0);
    }
    
} catch (Exception $e) {
    // Tables may not exist yet - needs license first
    $hasLicense = false;
    $setupComplete = false;
}

// Determine navigation
// Key change: Setup is complete ONLY if setup_completed flag is set to '1'
$needsLicense = !$hasLicense;
$needsSetup = $hasLicense && !$setupComplete;
$readyForLogin = $hasLicense && $setupComplete;

echo json_encode([
    'success' => true,
    'has_license' => $hasLicense,
    'setup_complete' => $setupComplete,
    'has_admin_users' => $hasAdminUsers,
    'needs_license' => $needsLicense,
    'needs_setup' => $needsSetup,
    'ready_for_login' => $readyForLogin,
    'license_url' => '/activate-license.php',
    'setup_url' => '/install/setup-hospital-server.php',
    'login_url' => '/login.php'
]);
