<?php
/**
 * Private Settings Security API
 * Handles PIN setup, verification, and QR code generation for secure settings access
 */
error_reporting(0);
ini_set('display_errors', 0);

ob_start();
define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Only admin can manage security settings
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

/**
 * Generate a secure random secret for QR codes
 */
function generateSecret($length = 32) {
    return bin2hex(random_bytes($length / 2));
}

/**
 * Generate a time-based OTP (TOTP-like but simpler)
 * Valid for 5 minutes
 */
function generateOTP($secret, $pin) {
    $timeSlot = floor(time() / 300); // 5-minute windows
    return substr(hash('sha256', $secret . $pin . $timeSlot), 0, 6);
}

/**
 * Verify OTP
 */
function verifyOTP($secret, $pin, $providedOTP) {
    // Check current and previous time slots
    for ($i = 0; $i <= 1; $i++) {
        $timeSlot = floor(time() / 300) - $i;
        $expectedOTP = substr(hash('sha256', $secret . $pin . $timeSlot), 0, 6);
        if (hash_equals($expectedOTP, $providedOTP)) {
            return true;
        }
    }
    return false;
}

try {
    switch ($method) {
        case 'GET':
            // Check if PIN is configured
            $action = $_GET['action'] ?? 'status';

            if ($action === 'status') {
                // Check if PIN exists
                $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_pin'");
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                $stmt->close();

                $pinConfigured = !empty($row['setting_value']);

                echo json_encode([
                    'success' => true,
                    'pin_configured' => $pinConfigured
                ]);
            }
            elseif ($action === 'generate_qr') {
                // Generate QR code data for current session
                // First verify PIN is set
                $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key IN ('private_settings_pin', 'private_settings_secret')");
                $stmt->execute();
                $result = $stmt->get_result();

                $pin = '';
                $secret = '';
                while ($row = $result->fetch_assoc()) {
                    if ($row['setting_value']) {
                        // Get based on order
                    }
                }
                $stmt->close();

                // Get PIN and secret
                $pinStmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_pin'");
                $pinStmt->execute();
                $pinResult = $pinStmt->get_result()->fetch_assoc();
                $pin = $pinResult['setting_value'] ?? '';
                $pinStmt->close();

                $secretStmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_secret'");
                $secretStmt->execute();
                $secretResult = $secretStmt->get_result()->fetch_assoc();
                $secret = $secretResult['setting_value'] ?? '';
                $secretStmt->close();

                if (empty($pin)) {
                    echo json_encode(['success' => false, 'error' => 'PIN not configured']);
                    exit;
                }

                if (empty($secret)) {
                    // Generate a new secret
                    $secret = generateSecret();
                    $insertStmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value)
                                                VALUES ('private_settings_secret', ?)
                                                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                    $insertStmt->bind_param('s', $secret);
                    $insertStmt->execute();
                    $insertStmt->close();
                }

                // Generate time-limited access code
                $accessCode = generateOTP($secret, $pin);

                // Create QR data - this will be the access code
                // The user scans this QR with any QR scanner app and enters the code
                $qrData = json_encode([
                    'app' => 'DICOM_Viewer_Settings',
                    'code' => $accessCode,
                    'expires' => date('Y-m-d H:i:s', time() + 300),
                    'action' => 'unlock_private_settings'
                ]);

                echo json_encode([
                    'success' => true,
                    'qr_data' => $qrData,
                    'access_code' => $accessCode,
                    'expires_in' => 300, // 5 minutes
                    'expires_at' => date('Y-m-d H:i:s', time() + 300)
                ]);
            }
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $action = $input['action'] ?? 'verify';

            if ($action === 'setup_pin') {
                // Setup or change PIN
                $newPin = $input['pin'] ?? '';

                if (strlen($newPin) < 4 || strlen($newPin) > 8) {
                    echo json_encode(['success' => false, 'error' => 'PIN must be 4-8 digits']);
                    exit;
                }

                if (!ctype_digit($newPin)) {
                    echo json_encode(['success' => false, 'error' => 'PIN must contain only digits']);
                    exit;
                }

                // Hash the PIN for security
                $hashedPin = password_hash($newPin, PASSWORD_DEFAULT);

                // Generate new secret
                $secret = generateSecret();

                // Save both - use only columns that exist in system_settings
                $db->begin_transaction();

                $stmt1 = $db->prepare("INSERT INTO system_settings (setting_key, setting_value)
                                       VALUES ('private_settings_pin', ?)
                                       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt1->bind_param('s', $hashedPin);
                $stmt1->execute();
                $stmt1->close();

                $stmt2 = $db->prepare("INSERT INTO system_settings (setting_key, setting_value)
                                       VALUES ('private_settings_secret', ?)
                                       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt2->bind_param('s', $secret);
                $stmt2->execute();
                $stmt2->close();

                $db->commit();

                // Clear any existing session unlock
                unset($_SESSION['private_settings_unlocked']);

                echo json_encode([
                    'success' => true,
                    'message' => 'PIN configured successfully'
                ]);
            }
            elseif ($action === 'verify_pin') {
                // Verify PIN
                $providedPin = $input['pin'] ?? '';

                $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_pin'");
                $stmt->execute();
                $result = $stmt->get_result()->fetch_assoc();
                $storedHash = $result['setting_value'] ?? '';
                $stmt->close();

                if (empty($storedHash)) {
                    echo json_encode(['success' => false, 'error' => 'PIN not configured']);
                    exit;
                }

                if (password_verify($providedPin, $storedHash)) {
                    // Set session flag
                    $_SESSION['private_settings_unlocked'] = true;
                    $_SESSION['private_settings_unlock_time'] = time();

                    echo json_encode([
                        'success' => true,
                        'message' => 'Access granted',
                        'session_valid_for' => 1800 // 30 minutes
                    ]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Invalid PIN']);
                }
            }
            elseif ($action === 'verify_qr_code') {
                // Verify access code from QR
                $providedCode = $input['code'] ?? '';

                $pinStmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_pin'");
                $pinStmt->execute();
                $pinResult = $pinStmt->get_result()->fetch_assoc();
                $storedHash = $pinResult['setting_value'] ?? '';
                $pinStmt->close();

                $secretStmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_secret'");
                $secretStmt->execute();
                $secretResult = $secretStmt->get_result()->fetch_assoc();
                $secret = $secretResult['setting_value'] ?? '';
                $secretStmt->close();

                if (empty($storedHash) || empty($secret)) {
                    echo json_encode(['success' => false, 'error' => 'Security not configured']);
                    exit;
                }

                // We need to verify the OTP without knowing the original PIN
                // The QR code contains the access code which was generated from PIN + secret + time
                // For QR verification, we'll check if the provided code matches any recent OTP

                // Actually, for QR codes, we generate the code from the admin side
                // and the user just needs to enter that code
                // So we need to regenerate the expected codes for current time windows

                // Get all possible valid OTPs for current time windows
                // We iterate through possible PINs... but that's not secure

                // Better approach: Store the current valid access code temporarily
                $validCodeStmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'current_access_code'");
                $validCodeStmt->execute();
                $validCodeResult = $validCodeStmt->get_result()->fetch_assoc();
                $storedCode = $validCodeResult['setting_value'] ?? '';
                $validCodeStmt->close();

                // Parse stored code (format: code:timestamp)
                $parts = explode(':', $storedCode);
                if (count($parts) === 2) {
                    $expectedCode = $parts[0];
                    $codeTime = (int)$parts[1];

                    // Check if code is still valid (5 minutes)
                    if (time() - $codeTime <= 300 && hash_equals($expectedCode, $providedCode)) {
                        $_SESSION['private_settings_unlocked'] = true;
                        $_SESSION['private_settings_unlock_time'] = time();

                        // Invalidate the code
                        $clearStmt = $db->prepare("DELETE FROM system_settings WHERE setting_key = 'current_access_code'");
                        $clearStmt->execute();
                        $clearStmt->close();

                        echo json_encode([
                            'success' => true,
                            'message' => 'Access granted via QR code',
                            'session_valid_for' => 1800
                        ]);
                        exit;
                    }
                }

                echo json_encode(['success' => false, 'error' => 'Invalid or expired access code']);
            }
            elseif ($action === 'generate_access_code') {
                // Generate a new access code and store it
                $accessCode = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
                $codeData = $accessCode . ':' . time();

                $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value)
                                      VALUES ('current_access_code', ?)
                                      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $stmt->bind_param('s', $codeData);
                $stmt->execute();
                $stmt->close();

                echo json_encode([
                    'success' => true,
                    'access_code' => $accessCode,
                    'expires_in' => 300,
                    'expires_at' => date('Y-m-d H:i:s', time() + 300)
                ]);
            }
            elseif ($action === 'check_session') {
                // Check if private settings are unlocked
                $unlocked = isset($_SESSION['private_settings_unlocked']) && $_SESSION['private_settings_unlocked'] === true;
                $unlockTime = $_SESSION['private_settings_unlock_time'] ?? 0;

                // Session expires after 30 minutes
                if ($unlocked && (time() - $unlockTime > 1800)) {
                    unset($_SESSION['private_settings_unlocked']);
                    unset($_SESSION['private_settings_unlock_time']);
                    $unlocked = false;
                }

                echo json_encode([
                    'success' => true,
                    'unlocked' => $unlocked,
                    'remaining_time' => $unlocked ? max(0, 1800 - (time() - $unlockTime)) : 0
                ]);
            }
            elseif ($action === 'lock') {
                // Lock private settings
                unset($_SESSION['private_settings_unlocked']);
                unset($_SESSION['private_settings_unlock_time']);

                echo json_encode([
                    'success' => true,
                    'message' => 'Private settings locked'
                ]);
            }
            break;

        case 'DELETE':
            // Reset PIN (requires current PIN verification first)
            $input = json_decode(file_get_contents('php://input'), true);
            $currentPin = $input['current_pin'] ?? '';

            $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_pin'");
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            $storedHash = $result['setting_value'] ?? '';
            $stmt->close();

            if (!empty($storedHash) && !password_verify($currentPin, $storedHash)) {
                echo json_encode(['success' => false, 'error' => 'Current PIN is incorrect']);
                exit;
            }

            // Clear PIN and secret
            $db->query("DELETE FROM system_settings WHERE setting_key IN ('private_settings_pin', 'private_settings_secret', 'current_access_code')");

            unset($_SESSION['private_settings_unlocked']);
            unset($_SESSION['private_settings_unlock_time']);

            echo json_encode([
                'success' => true,
                'message' => 'Security settings reset'
            ]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}