<?php
/**
 * 2FA Setup API
 * 
 * GET  - Generate new TOTP secret and return QR code data
 * POST - Verify TOTP code and enable 2FA for user
 * DELETE - Disable 2FA (requires valid TOTP code)
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            // Generate new TOTP secret and return QR code data
            $secret = TotpAuth::generateSecret();
            
            // Get user email for QR code
            $stmt = $db->prepare("SELECT email, username FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            $stmt->close();
            
            $accountName = $user['email'] ?: $user['username'];
            $qrData = TotpAuth::getQRCodeData($secret, $accountName, 'DICOM Viewer');
            
            // Store secret temporarily in session until verified
            $_SESSION['pending_totp_secret'] = $secret;
            
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
            
        case 'POST':
            // Verify TOTP code and enable 2FA
            $input = json_decode(file_get_contents('php://input'), true);
            $code = $input['code'] ?? '';
            
            if (empty($code)) {
                echo json_encode(['success' => false, 'error' => 'Verification code is required']);
                exit;
            }
            
            // Get pending secret from session or existing secret if already enabled
            $secret = $_SESSION['pending_totp_secret'] ?? null;
            
            if (!$secret) {
                // Check if user already has 2FA enabled (re-verification)
                $stmt = $db->prepare("SELECT totp_secret FROM users WHERE id = ? AND totp_enabled = 1");
                $stmt->bind_param("i", $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                $row = $result->fetch_assoc();
                $stmt->close();
                
                if ($row && $row['totp_secret']) {
                    $secret = $row['totp_secret'];
                } else {
                    echo json_encode(['success' => false, 'error' => 'No pending 2FA setup. Please generate a new QR code first.']);
                    exit;
                }
            }
            
            // Verify the code
            if (!TotpAuth::verifyCode($secret, $code)) {
                echo json_encode(['success' => false, 'error' => 'Invalid verification code. Please try again.']);
                exit;
            }
            
            // Enable 2FA for user
            $stmt = $db->prepare("UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_verified_at = NOW() WHERE id = ?");
            $stmt->bind_param("si", $secret, $userId);
            $stmt->execute();
            $stmt->close();
            
            // Clear pending secret
            unset($_SESSION['pending_totp_secret']);
            
            // Log the action
            logAuditEvent($userId, '2fa_enabled', 'user', $userId, "User enabled 2FA");
            logMessage("User {$_SESSION['username']} enabled 2FA", 'info', 'auth.log');
            
            echo json_encode([
                'success' => true,
                'message' => 'Two-factor authentication has been enabled successfully'
            ]);
            break;
            
        case 'DELETE':
            // Disable 2FA (requires valid TOTP code)
            $input = json_decode(file_get_contents('php://input'), true);
            $code = $input['code'] ?? '';
            
            if (empty($code)) {
                echo json_encode(['success' => false, 'error' => 'Verification code is required to disable 2FA']);
                exit;
            }
            
            // Get current secret
            $stmt = $db->prepare("SELECT totp_secret FROM users WHERE id = ? AND totp_enabled = 1");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
            
            if (!$row || !$row['totp_secret']) {
                echo json_encode(['success' => false, 'error' => '2FA is not enabled for this account']);
                exit;
            }
            
            // Verify the code
            if (!TotpAuth::verifyCode($row['totp_secret'], $code)) {
                echo json_encode(['success' => false, 'error' => 'Invalid verification code']);
                exit;
            }
            
            // Disable 2FA
            $stmt = $db->prepare("UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_verified_at = NULL WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $stmt->close();
            
            // Log the action
            logAuditEvent($userId, '2fa_disabled', 'user', $userId, "User disabled 2FA");
            logMessage("User {$_SESSION['username']} disabled 2FA", 'info', 'auth.log');
            
            echo json_encode([
                'success' => true,
                'message' => 'Two-factor authentication has been disabled'
            ]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    logMessage("2FA setup error: " . $e->getMessage(), 'error', 'auth.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An error occurred']);
}
