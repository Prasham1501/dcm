<?php
/**
 * Private Settings 2FA API
 * 
 * Handles 2FA setup and verification for protecting private settings.
 * Only super admin can setup/manage this 2FA.
 * Any admin can verify the code to access private settings.
 * 
 * GET  - Check if 2FA is enabled, get status
 * POST action=setup - Generate new 2FA secret and return QR code (super admin only)
 * POST action=enable - Enable 2FA after verifying initial code (super admin only)
 * POST action=disable - Disable 2FA (super admin only, requires code)
 * POST action=verify - Verify 2FA code to access private settings
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/TotpAuth.php';

// Require authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();
$userId = $_SESSION['user_id'];

// Check if super admin (query DB as session var might not be set)
$stmt = $db->prepare("SELECT is_super_admin FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();
$isSuperAdmin = ($row && $row['is_super_admin'] == 1);
$stmt->close();

// Settings key for private settings 2FA
define('PRIVATE_SETTINGS_2FA_SECRET', 'private_settings_2fa_secret');
define('PRIVATE_SETTINGS_2FA_ENABLED', 'private_settings_2fa_enabled');

/**
 * Get a setting value from the database
 */
function getSetting($db, $key, $default = null) {
    $stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1");
    $stmt->bind_param("s", $key);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    return $row ? $row['setting_value'] : $default;
}

/**
 * Set a setting value in the database
 */
function setSetting($db, $key, $value, $description = '') {
    // Ensure category column exists
    $result = $db->query("SHOW COLUMNS FROM system_settings LIKE 'category'");
    if ($result && $result->num_rows === 0) {
        $db->query("ALTER TABLE system_settings ADD COLUMN category VARCHAR(50) DEFAULT 'general'");
    }

    // We use category='security' for these settings
    $category = 'security';
    $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value, category, updated_at) 
                          VALUES (?, ?, ?, NOW()) 
                          ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()");
    $stmt->bind_param("ssss", $key, $value, $category, $value);
    $stmt->execute();
    $stmt->close();
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Check if 2FA is enabled for private settings
        $enabled = getSetting($db, PRIVATE_SETTINGS_2FA_ENABLED, '0') === '1';
        $hasSecret = getSetting($db, PRIVATE_SETTINGS_2FA_SECRET, null) !== null;
        
        // Check if current session has verified 2FA
        $verified = isset($_SESSION['private_settings_2fa_verified']) && 
                    $_SESSION['private_settings_2fa_verified'] === true &&
                    isset($_SESSION['private_settings_2fa_time']) &&
                    (time() - $_SESSION['private_settings_2fa_time']) < 900; // 15 min timeout
        
        echo json_encode([
            'success' => true,
            'data' => [
                'enabled' => $enabled,
                'hasSecret' => $hasSecret,
                'verified' => $verified,
                'isSuperAdmin' => $isSuperAdmin
            ]
        ]);
        exit;
    }
    
    // POST requests
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'setup':
            // Only super admin can setup
            if (!$isSuperAdmin) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Only super admin can setup 2FA for private settings']);
                exit;
            }
            
            // Generate new TOTP secret
            $secret = TotpAuth::generateSecret();
            
            // Get current user email for QR code
            $stmt = $db->prepare("SELECT email, username FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            $stmt->close();
            
            $accountName = 'Private Settings';
            $qrData = TotpAuth::getQRCodeData($secret, $accountName, 'DICOM Viewer Admin');
            
            // Store secret temporarily in session until verified
            $_SESSION['pending_private_settings_2fa_secret'] = $secret;
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'secret' => $secret,
                    'secret_formatted' => TotpAuth::formatSecret($secret),
                    'qr_url' => $qrData['qr_url'],
                    'otpauth_url' => $qrData['otpauth_url'],
                    'issuer' => $qrData['issuer'],
                    'account_name' => $qrData['account_name']
                ]
            ]);
            break;
            
        case 'enable':
            // Only super admin can enable
            if (!$isSuperAdmin) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Only super admin can enable 2FA for private settings']);
                exit;
            }
            
            $code = $input['code'] ?? '';
            if (empty($code)) {
                echo json_encode(['success' => false, 'error' => 'Verification code is required']);
                exit;
            }
            
            // Get pending secret from session
            $secret = $_SESSION['pending_private_settings_2fa_secret'] ?? null;
            if (!$secret) {
                echo json_encode(['success' => false, 'error' => 'No pending 2FA setup. Please generate a new QR code first.']);
                exit;
            }
            
            // Verify the code
            if (!TotpAuth::verifyCode($secret, $code)) {
                echo json_encode(['success' => false, 'error' => 'Invalid verification code. Please try again.']);
                exit;
            }
            
            // Save to settings
            setSetting($db, PRIVATE_SETTINGS_2FA_SECRET, $secret, '2FA secret for private settings protection');
            setSetting($db, PRIVATE_SETTINGS_2FA_ENABLED, '1', '2FA enabled for private settings');
            
            // Clear pending secret
            unset($_SESSION['pending_private_settings_2fa_secret']);
            
            // Mark as verified for this session
            $_SESSION['private_settings_2fa_verified'] = true;
            $_SESSION['private_settings_2fa_time'] = time();
            
            echo json_encode([
                'success' => true,
                'message' => '2FA has been enabled for private settings'
            ]);
            break;
            
        case 'disable':
            // Only super admin can disable
            if (!$isSuperAdmin) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Only super admin can disable 2FA for private settings']);
                exit;
            }
            
            $code = $input['code'] ?? '';
            if (empty($code)) {
                echo json_encode(['success' => false, 'error' => 'Verification code is required to disable 2FA']);
                exit;
            }
            
            // Get current secret
            $secret = getSetting($db, PRIVATE_SETTINGS_2FA_SECRET);
            if (!$secret) {
                echo json_encode(['success' => false, 'error' => '2FA is not enabled for private settings']);
                exit;
            }
            
            // Verify the code
            if (!TotpAuth::verifyCode($secret, $code)) {
                echo json_encode(['success' => false, 'error' => 'Invalid verification code']);
                exit;
            }
            
            // Disable 2FA
            setSetting($db, PRIVATE_SETTINGS_2FA_SECRET, '');
            setSetting($db, PRIVATE_SETTINGS_2FA_ENABLED, '0', '2FA disabled for private settings');
            
            // Clear session verification
            unset($_SESSION['private_settings_2fa_verified']);
            unset($_SESSION['private_settings_2fa_time']);
            
            echo json_encode([
                'success' => true,
                'message' => '2FA has been disabled for private settings'
            ]);
            break;
            
        case 'verify':
            // Any admin can verify to access private settings
            $code = $input['code'] ?? '';
            if (empty($code)) {
                echo json_encode(['success' => false, 'error' => 'Verification code is required']);
                exit;
            }
            
            // Check if 2FA is enabled
            $enabled = getSetting($db, PRIVATE_SETTINGS_2FA_ENABLED, '0') === '1';
            if (!$enabled) {
                echo json_encode(['success' => false, 'error' => '2FA is not enabled for private settings']);
                exit;
            }
            
            // Get secret
            $secret = getSetting($db, PRIVATE_SETTINGS_2FA_SECRET);
            if (!$secret) {
                echo json_encode(['success' => false, 'error' => '2FA secret not configured']);
                exit;
            }
            
            // Verify the code
            if (!TotpAuth::verifyCode($secret, $code)) {
                echo json_encode(['success' => false, 'error' => 'Invalid verification code. Please try again.']);
                exit;
            }
            
            // Mark session as verified
            $_SESSION['private_settings_2fa_verified'] = true;
            $_SESSION['private_settings_2fa_time'] = time();
            
            echo json_encode([
                'success' => true,
                'message' => 'Access granted'
            ]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
    
} catch (Exception $e) {
    error_log("Private Settings 2FA error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
