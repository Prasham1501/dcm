<?php
/**
 * License Activation API
 * 
 * POST - Activate a license key on this machine and create user session
 * DELETE - Deactivate license from this machine
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/LicenseManager.php';

$licenseManager = new LicenseManager();

try {
    // Ensure installation_license table exists
    $db = getDbConnection();
    $db->query("
        CREATE TABLE IF NOT EXISTS installation_license (
            id INT PRIMARY KEY DEFAULT 1,
            license_key VARCHAR(32),
            machine_id VARCHAR(64),
            license_type VARCHAR(20),
            activated_at DATETIME,
            last_online_check DATETIME,
            cached_valid_until DATE,
            cached_is_active TINYINT(1) DEFAULT 1,
            grace_period_start DATETIME
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    // Ensure a row exists
    $db->query("INSERT IGNORE INTO installation_license (id, cached_is_active) VALUES (1, 1)");

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $startTrial = $input['start_trial'] ?? false;
            $licenseKey = $input['license_key'] ?? '';
            $machineId = $input['machine_id'] ?? LicenseManager::generateMachineId();

            // Handle trial activation
            if ($startTrial) {
                // Check if trial was already used on this machine
                $existingLicense = $licenseManager->getLocalLicense();
                if ($existingLicense && !empty($existingLicense['license_key'])) {
                    // Allow re-trial if previous expired
                    if ($existingLicense['cached_valid_until'] && strtotime($existingLicense['cached_valid_until']) > time()) {
                        echo json_encode(['success' => false, 'error' => 'A license is already active on this machine']);
                        exit;
                    }
                }

                // Create local trial license (15 days)
                $trialKey = 'TRIAL' . date('Ymd') . substr(md5($machineId . time()), 0, 8);
                $validUntil = date('Y-m-d', strtotime('+15 days'));

                $stmt = $db->prepare("
                    UPDATE installation_license SET
                        license_key = ?,
                        machine_id = ?,
                        license_type = 'trial_15',
                        activated_at = NOW(),
                        last_online_check = NOW(),
                        cached_valid_until = ?,
                        cached_is_active = 1,
                        grace_period_start = NULL
                    WHERE id = 1
                ");
                $stmt->bind_param('sss', $trialKey, $machineId, $validUntil);
                $stmt->execute();
                $stmt->close();

                $result = [
                    'success' => true,
                    'message' => '15-day trial activated',
                    'license' => [
                        'type' => 'trial_15',
                        'valid_until' => $validUntil,
                        'days_remaining' => 15
                    ]
                ];
            } else {
                // Normal license activation
                if (empty($licenseKey)) {
                    echo json_encode(['success' => false, 'error' => 'License key is required']);
                    exit;
                }

                // IMPORTANT: Check if this is the SAME license BEFORE activateLicense() updates the DB
                // Also check if setup is already complete (as a fallback to preserve it)
                $isSameLicense = false;
                $setupAlreadyComplete = false;

                try {
                    // Normalize license keys by removing non-alphanumeric characters for comparison
                    $normalizedInputKey = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $licenseKey));

                    $existingLicenseCheck = $db->query("SELECT license_key FROM installation_license WHERE id = 1 LIMIT 1");
                    if ($existingLicenseCheck && $row = $existingLicenseCheck->fetch_assoc()) {
                        $existingKey = $row['license_key'] ?? '';
                        $normalizedExistingKey = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $existingKey));

                        if (!empty($normalizedExistingKey) && $normalizedExistingKey === $normalizedInputKey) {
                            $isSameLicense = true;
                            logMessage("Same license key detected - will preserve setup status", 'info', 'license.log');
                        }
                    }

                    // Also check if setup is already complete (fallback protection)
                    $setupCheck = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'setup_complete' LIMIT 1");
                    if ($setupCheck && $row = $setupCheck->fetch_assoc()) {
                        if ($row['setting_value'] === '1') {
                            $setupAlreadyComplete = true;
                            logMessage("Setup already complete - will preserve status", 'info', 'license.log');
                        }
                    }
                } catch (Exception $e) {
                    $isSameLicense = false;
                    $setupAlreadyComplete = false;
                }

                $machineInfo = [
                    'machine_name' => $input['machine_name'] ?? gethostname(),
                    'os_info' => $input['os_info'] ?? php_uname('s') . ' ' . php_uname('r'),
                    'ip_address' => $_SERVER['REMOTE_ADDR'] ?? ''
                ];

                $result = $licenseManager->activateLicense($licenseKey, $machineId, $machineInfo);

                // Normalize response - LicenseManager returns 'valid' but we expect 'success'
                if (isset($result['valid']) && !isset($result['success'])) {
                    $result['success'] = $result['valid'];
                }

                // Pass the flags to later code
                $result['_isSameLicense'] = $isSameLicense;
                $result['_setupAlreadyComplete'] = $setupAlreadyComplete;
            }

            // Check if activation was successful
            if (!empty($result['success'])) {
                // Get license details for session
                $license = null;
                if (!$startTrial && !empty($licenseKey)) {
                    $license = $licenseManager->getLicenseByKey($licenseKey);
                }

                // Create or get default admin user for this installation
                $db = getDbConnection();

                // Use the flags we set BEFORE activateLicense() was called
                $isSameLicense = $result['_isSameLicense'] ?? false;
                $setupAlreadyComplete = $result['_setupAlreadyComplete'] ?? false;

                // Only reset setup status for NEW license activation (different license)
                // If setup is already complete, preserve it ONLY if it's the SAME license
                $shouldReset = !$isSameLicense && !$startTrial;

                if ($shouldReset) {
                    try {
                        // 1. Reset setup_complete flag
                        $db->query("UPDATE system_settings SET setting_value = '0' WHERE setting_key = 'setup_complete'");
                        $db->query("UPDATE settings SET setting_value = '0' WHERE setting_key = 'setup_complete'");
                        
                        // 2. Clear Hospital Information to prevent data leak
                        $keysToClear = [
                            // Hospital Details
                            'hospital_name', 'hospital_department', 'hospital_phone', 'hospital_email',
                            // Address Details
                            'hospital_address', 'hospital_address1', 'hospital_address2', 
                            'hospital_city', 'hospital_state', 'hospital_pincode', 'hospital_country'
                        ];
                        
                        $placeholders = str_repeat('?,', count($keysToClear) - 1) . '?';
                        $types = str_repeat('s', count($keysToClear));
                        
                        // Clear from system_settings
                        $stmt = $db->prepare("DELETE FROM system_settings WHERE setting_key IN ($placeholders)");
                        $stmt->bind_param($types, ...$keysToClear);
                        $stmt->execute();
                        $stmt->close();
                        
                        // Clear from settings
                        $stmt = $db->prepare("DELETE FROM settings WHERE setting_key IN ($placeholders)");
                        $stmt->bind_param($types, ...$keysToClear);
                        $stmt->execute();
                        $stmt->close();

                        // 3. Reset Onboarding Progress
                        $db->query("UPDATE onboarding_progress SET current_step = 1, completed_steps = '[]' WHERE id = 1");

                        // 4. Reset setup_completed for all users to force them through any necessary checks if needed
                        // But mainly we need the Wizard to pop up for the admin
                        $db->query("UPDATE users SET setup_completed = 0 WHERE role = 'admin'");

                        logMessage("Reset setup status and cleared hospital data for new license activation", 'info', 'license.log');
                    } catch (Exception $e) {
                        logMessage("Could not reset setup status: " . $e->getMessage(), 'debug', 'license.log');
                    }
                } else {
                    logMessage("Preserving setup status (same license: " . ($isSameLicense ? 'yes' : 'no') . ", trial: " . ($startTrial ? 'yes' : 'no') . ")", 'info', 'license.log');
                }
                
                // Look for REGULAR admin user (exclude super admin)
                $stmt = $db->prepare("SELECT * FROM users WHERE role = 'admin' AND is_active = 1 AND (is_super_admin = 0 OR is_super_admin IS NULL) ORDER BY id LIMIT 1");
                $stmt->execute();
                $user = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                
                if (!$user) {
                    // Create default admin user if none exists
                    $passwordHash = password_hash('admin123', PASSWORD_DEFAULT);
                    $username = 'admin';
                    $email = ($license && !empty($license['customer_email'])) ? $license['customer_email'] : 'admin@local';
                    $fullName = ($license && !empty($license['customer_name'])) ? $license['customer_name'] : 'Administrator';

                    // Check if setup_completed column exists
                    $hasSetupCol = false;
                    $colCheck = $db->query("SHOW COLUMNS FROM users LIKE 'setup_completed'");
                    if ($colCheck && $colCheck->num_rows > 0) {
                        $hasSetupCol = true;
                    }

                    if ($hasSetupCol) {
                        $stmt = $db->prepare("INSERT INTO users (username, email, password_hash, full_name, role, is_active, setup_completed) VALUES (?, ?, ?, ?, 'admin', 1, 0)");
                    } else {
                        $stmt = $db->prepare("INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 'admin', 1)");
                    }
                    $stmt->bind_param("ssss", $username, $email, $passwordHash, $fullName);
                    $stmt->execute();
                    $userId = $db->insert_id;
                    $stmt->close();

                    $user = [
                        'id' => $userId,
                        'username' => $username,
                        'full_name' => $fullName,
                        'email' => $email,
                        'role' => 'admin',
                        'setup_completed' => 0
                    ];
                }
                
                // Create session for this user
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['email'] = $user['email'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['last_activity'] = time();
                $_SESSION['license_activated'] = true; // Flag for tour
                
                // Update last login time
                $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
                $updateStmt->bind_param("i", $user['id']);
                $updateStmt->execute();
                $updateStmt->close();
                
                // Create session record in database
                $sessionId = session_id();
                $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
                $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
                $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
                
                $sessionStmt = $db->prepare("
                    INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at)
                    VALUES (?, ?, ?, ?, ?)
                ");
                $sessionStmt->bind_param("sisss", $sessionId, $user['id'], $ipAddress, $userAgent, $expiresAt);
                $sessionStmt->execute();
                $_SESSION['session_db_id'] = $sessionStmt->insert_id;
                $sessionStmt->close();
                
                logMessage("License activated and user {$user['username']} logged in via license key", 'info', 'auth.log');
                
                $result['user'] = [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'full_name' => $user['full_name'],
                    'role' => $user['role']
                ];
            } else {
                // Activation failed - ensure proper error response
                if (!isset($result['success'])) {
                    $result['success'] = false;
                }
                if (!isset($result['error'])) {
                    $result['error'] = 'License activation failed';
                }
                logMessage("License activation failed: " . ($result['error'] ?? 'Unknown error'), 'warning', 'license.log');
            }

            echo json_encode($result);
            break;
            
        case 'DELETE':
            // Deactivate license from this machine
            $result = $licenseManager->deactivateInstallation();
            echo json_encode([
                'success' => $result,
                'message' => $result ? 'License deactivated' : 'Failed to deactivate'
            ]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    logMessage("License activation error: " . $e->getMessage(), 'error', 'license.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
