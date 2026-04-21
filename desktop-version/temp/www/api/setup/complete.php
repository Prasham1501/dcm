<?php
/**
 * Complete Setup API
 * Saves hospital info, address, users, and folder monitoring from setup wizard
 */
define('DICOM_VIEWER', true);

header('Content-Type: application/json');

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ActivityLogger.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$db = getDbConnection();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $db->begin_transaction();

    // Ensure system_settings table exists (the main settings table the app uses)
    $db->query("
        CREATE TABLE IF NOT EXISTS `system_settings` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `setting_key` varchar(100) NOT NULL,
            `setting_value` text,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `setting_key` (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Ensure settings table exists (for setup_complete flag)
    $db->query("
        CREATE TABLE IF NOT EXISTS `settings` (
            `id` int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            `setting_key` varchar(100) NOT NULL,
            `setting_value` text DEFAULT NULL,
            `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `setting_key` (`setting_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // 1. Save Hospital Info to system_settings (where the app reads from)
    if (!empty($input['hospital'])) {
        $hospital = $input['hospital'];

        $settings = [
            'hospital_name' => $hospital['name'] ?? '',
            'hospital_department' => $hospital['department'] ?? '',
            'hospital_phone' => $hospital['phone'] ?? '',
            'hospital_email' => $hospital['email'] ?? ''
        ];

        foreach ($settings as $key => $value) {
            // Write to system_settings (main app table)
            $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();

            // Also write to settings table for consistency
            $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();
        }
    }

    // 2. Save Address to system_settings
    if (!empty($input['address'])) {
        $address = $input['address'];

        // Use keys that match what the app expects
        $addressSettings = [
            'hospital_address' => trim(($address['line1'] ?? '') . ', ' . ($address['line2'] ?? '')),
            'hospital_address1' => $address['line1'] ?? '',
            'hospital_address2' => $address['line2'] ?? '',
            'hospital_city' => $address['city'] ?? '',
            'hospital_state' => $address['state'] ?? '',
            'hospital_pincode' => $address['pinCode'] ?? '',
            'hospital_country' => $address['country'] ?? 'India'
        ];

        foreach ($addressSettings as $key => $value) {
            // Write to system_settings (main app table)
            $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();

            // Also write to settings table
            $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();
        }
    }

    // 3. Create Primary Admin User (MANDATORY)
    if (!empty($input['adminUser'])) {
        $admin = $input['adminUser'];
        if (!empty($admin['username']) && !empty($admin['password'])) {
            // Check if setup_completed column exists
            $hasSetupCol = false;
            $colCheck = $db->query("SHOW COLUMNS FROM users LIKE 'setup_completed'");
            if ($colCheck && $colCheck->num_rows > 0) {
                $hasSetupCol = true;
            }

            // Check if user already exists
            $checkStmt = $db->prepare("SELECT id FROM users WHERE username = ?");
            $checkStmt->bind_param("s", $admin['username']);
            $checkStmt->execute();
            $result = $checkStmt->get_result();

            if ($result->num_rows === 0) {
                // Create new admin user
                $hashedPassword = password_hash($admin['password'], PASSWORD_DEFAULT);
                $fullName = $admin['fullName'] ?? 'Administrator';
                $email = $admin['email'] ?? null;

                if ($hasSetupCol) {
                    $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, email, role, is_active, setup_completed)
                                          VALUES (?, ?, ?, ?, 'admin', 1, 1)");
                } else {
                    $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, email, role, is_active)
                                          VALUES (?, ?, ?, ?, 'admin', 1)");
                }
                $stmt->bind_param("ssss", $admin['username'], $hashedPassword, $fullName, $email);
                $stmt->execute();
                $stmt->close();
            } else {
                // Update existing admin user's password if they were created by license activation
                $hashedPassword = password_hash($admin['password'], PASSWORD_DEFAULT);
                $fullName = $admin['fullName'];
                $email = $admin['email'];

                if ($hasSetupCol) {
                    $stmt = $db->prepare("UPDATE users SET password_hash = ?, full_name = COALESCE(?, full_name),
                                          email = COALESCE(?, email), setup_completed = 1 WHERE username = ?");
                } else {
                    $stmt = $db->prepare("UPDATE users SET password_hash = ?, full_name = COALESCE(?, full_name),
                                          email = COALESCE(?, email) WHERE username = ?");
                }
                $stmt->bind_param("ssss", $hashedPassword, $fullName, $email, $admin['username']);
                $stmt->execute();
                $stmt->close();
            }
            $checkStmt->close();
        }
    }

    // 4. Create Additional Users (Optional)
    if (!empty($input['users']) && is_array($input['users'])) {
        foreach ($input['users'] as $user) {
            if (empty($user['username']) || empty($user['password'])) continue;
            
            // Check if user already exists
            $checkStmt = $db->prepare("SELECT id FROM users WHERE username = ?");
            $checkStmt->bind_param("s", $user['username']);
            $checkStmt->execute();
            $result = $checkStmt->get_result();
            
            if ($result->num_rows === 0) {
                $hashedPassword = password_hash($user['password'], PASSWORD_DEFAULT);
                $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, email, role, is_active) 
                                      VALUES (?, ?, ?, ?, ?, 1)");
                $stmt->bind_param("sssss", 
                    $user['username'], 
                    $hashedPassword, 
                    $user['fullName'] ?? $user['username'],
                    $user['email'] ?? null,
                    $user['role'] ?? 'viewer'
                );
                $stmt->execute();
                $stmt->close();
            }
            $checkStmt->close();
        }
    }

    // 5. Save Folder Monitoring Settings to both tables
    if (!empty($input['folderMonitoring'])) {
        $monitoring = $input['folderMonitoring'];

        $monitoringSettings = [
            'auto_import_paths' => json_encode($monitoring['paths'] ?? []),
            'auto_import_interval' => $monitoring['interval'] ?? '60',
            'auto_import_action' => $monitoring['afterImport'] ?? 'move'
        ];

        foreach ($monitoringSettings as $key => $value) {
            // Write to system_settings
            $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();

            // Write to settings table
            $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("ss", $key, $value);
            $stmt->execute();
            $stmt->close();
        }

        // IMPORTANT: Also save to monitored_paths table (used by folder-config.php and sync API)
        // First ensure the table exists
        $db->query("
            CREATE TABLE IF NOT EXISTS monitored_paths (
                id INT AUTO_INCREMENT PRIMARY KEY,
                path VARCHAR(1000) NOT NULL,
                name VARCHAR(255) DEFAULT NULL,
                is_active TINYINT(1) DEFAULT 1,
                last_checked DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_path (path(255))
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // Add each path to monitored_paths table
        if (!empty($monitoring['paths']) && is_array($monitoring['paths'])) {
            foreach ($monitoring['paths'] as $path) {
                $pathName = basename($path);
                $stmt = $db->prepare("INSERT INTO monitored_paths (path, name, is_active) VALUES (?, ?, 1)
                                      ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1");
                $stmt->bind_param("ss", $path, $pathName);
                $stmt->execute();
                $stmt->close();
            }
        }
    }

    // 6. Mark setup as complete in both tables
    $stmt = $db->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('setup_complete', '1')
                          ON DUPLICATE KEY UPDATE setting_value = '1'");
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('setup_complete', '1')
                          ON DUPLICATE KEY UPDATE setting_value = '1'");
    $stmt->execute();
    $stmt->close();

    // 6. Update user's setup completed flag (if column exists)
    $hasSetupCol = false;
    $colCheck = $db->query("SHOW COLUMNS FROM users LIKE 'setup_completed'");
    if ($colCheck && $colCheck->num_rows > 0) {
        $hasSetupCol = true;
    }

    if ($hasSetupCol) {
        $stmt = $db->prepare("UPDATE users SET setup_completed = 1 WHERE id = ?");
        $userId = $_SESSION['user_id'] ?? 0;
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $stmt->close();
    }
    
    // Log the event
    ActivityLogger::log('setup_completed', 'system', [
        'user_id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'hospital_name' => $input['hospital']['name'] ?? '',
        'users_created' => count($input['users'] ?? []),
        'folders_added' => count($input['folderMonitoring']['paths'] ?? [])
    ]);
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Setup completed successfully'
    ]);
    
} catch (Exception $e) {
    $db->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
