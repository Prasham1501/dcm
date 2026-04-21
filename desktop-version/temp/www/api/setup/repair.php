<?php
/**
 * Setup Repair API
 * Fixes setup status for existing installations where hospital_name exists
 * but setup_complete flag was not properly set
 *
 * Usage: Visit http://localhost:8080/api/setup/repair.php?fix=1 to repair
 */
define('DICOM_VIEWER', true);

header('Content-Type: application/json');

require_once __DIR__ . '/../../includes/config.php';

$db = getDbConnection();
$shouldFix = isset($_GET['fix']) && $_GET['fix'] === '1';

try {
    $repaired = false;
    $hospitalName = null;
    $setupFlagBefore = null;
    $setupFlagAfter = null;

    // Check current setup_complete flag
    $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'setup_complete' LIMIT 1");
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $setupFlagBefore = $row['setting_value'];
    } else {
        $setupFlagBefore = 'NOT SET';
    }

    // Check if hospital_name exists
    $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'hospital_name' AND setting_value != '' AND setting_value IS NOT NULL LIMIT 1");
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $hospitalName = $row['setting_value'];

        // If hospital exists and we should fix
        if ($shouldFix) {
            // Fix in system_settings
            $db->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('setup_complete', '1') ON DUPLICATE KEY UPDATE setting_value = '1'");

            // Fix in settings table
            $db->query("INSERT INTO settings (setting_key, setting_value) VALUES ('setup_complete', '1') ON DUPLICATE KEY UPDATE setting_value = '1'");

            $repaired = true;
            $setupFlagAfter = '1';
        } else {
            $setupFlagAfter = $setupFlagBefore;
        }
    }

    // Get all relevant settings for debugging
    $settings = [];
    $result = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('hospital_name', 'setup_complete', 'hospital_department', 'hospital_city')");
    while ($row = $result->fetch_assoc()) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }

    // Also check installation_license
    $licenseKey = null;
    $result = $db->query("SELECT license_key FROM installation_license WHERE id = 1 LIMIT 1");
    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $licenseKey = $row['license_key'] ?? null;
    }

    $message = $repaired
        ? 'Setup status repaired successfully! You can now login and go directly to patients page.'
        : ($hospitalName
            ? ($setupFlagBefore === '1' ? 'No repair needed. Setup already complete.' : 'Hospital configured but flag not set. Add ?fix=1 to URL to repair.')
            : 'No hospital configured. Setup wizard is required.');

    echo json_encode([
        'success' => true,
        'repaired' => $repaired,
        'hospital_name' => $hospitalName,
        'license_key' => $licenseKey ? substr($licenseKey, 0, 10) . '...' : null,
        'setup_flag_before' => $setupFlagBefore,
        'setup_flag_after' => $setupFlagAfter,
        'all_settings' => $settings,
        'fix_url' => $repaired ? null : '/api/setup/repair.php?fix=1',
        'message' => $message
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
