<?php
/**
 * 2FA Verification API
 * 
 * POST - Verify TOTP code during login flow
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/TotpAuth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $code = $input['code'] ?? '';
    
    if (empty($code)) {
        echo json_encode(['success' => false, 'error' => 'Verification code is required']);
        exit;
    }
    
    // Check for pending 2FA verification
    if (!isset($_SESSION['pending_2fa_user_id'])) {
        echo json_encode(['success' => false, 'error' => 'No pending 2FA verification. Please login again.']);
        exit;
    }
    
    $pendingUserId = $_SESSION['pending_2fa_user_id'];
    $pendingUserData = $_SESSION['pending_2fa_user_data'] ?? null;
    
    // Get user's TOTP secret
    $db = getDbConnection();
    $stmt = $db->prepare("SELECT totp_secret, username, full_name, email, role FROM users WHERE id = ? AND totp_enabled = 1");
    $stmt->bind_param("i", $pendingUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();
    
    if (!$user || !$user['totp_secret']) {
        // Clear pending state
        unset($_SESSION['pending_2fa_user_id']);
        unset($_SESSION['pending_2fa_user_data']);
        
        echo json_encode(['success' => false, 'error' => '2FA is not configured for this user']);
        exit;
    }
    
    // Verify the code
    if (!TotpAuth::verifyCode($user['totp_secret'], $code)) {
        echo json_encode(['success' => false, 'error' => 'Invalid verification code. Please try again.']);
        exit;
    }
    
    // 2FA verified - complete login
    $_SESSION['user_id'] = $pendingUserId;
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['last_activity'] = time();
    $_SESSION['2fa_verified'] = true;
    
    // Clear pending state
    unset($_SESSION['pending_2fa_user_id']);
    unset($_SESSION['pending_2fa_user_data']);
    
    // Update last login time
    $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $pendingUserId);
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
    $sessionStmt->bind_param("sisss", $sessionId, $pendingUserId, $ipAddress, $userAgent, $expiresAt);
    $sessionStmt->execute();
    $_SESSION['session_db_id'] = $sessionStmt->insert_id;
    $sessionStmt->close();
    
    // Log successful login with 2FA
    logAuditEvent($pendingUserId, 'login_2fa', 'user', $pendingUserId, "User {$user['username']} logged in with 2FA");
    logMessage("User {$user['username']} logged in with 2FA", 'info', 'auth.log');
    
    echo json_encode([
        'success' => true,
        'message' => '2FA verification successful',
        'user' => [
            'id' => $pendingUserId,
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
    
} catch (Exception $e) {
    logMessage("2FA verification error: " . $e->getMessage(), 'error', 'auth.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'An error occurred']);
}
