<?php
/**
 * Auto-Login API
 * 
 * Allows auto-login using a stored auth token (for Electron desktop app)
 * This bypasses password verification but requires a valid token previously generated
 * 
 * POST - Auto-login with token
 *   { "userId": 1, "token": "abc123..." }
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

// Only POST requests allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['userId']) || empty($data['token'])) {
        echo json_encode(['success' => false, 'error' => 'User ID and token are required']);
        exit;
    }
    
    $userId = (int)$data['userId'];
    $token = $data['token'];
    
    $db = getDbConnection();
    
    // Verify the auto-login token
    $stmt = $db->prepare("
        SELECT u.id, u.username, u.full_name, u.email, u.role, u.is_active, u.is_super_admin, u.auto_login_token
        FROM users u
        WHERE u.id = ? AND u.is_active = 1
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows !== 1) {
        echo json_encode(['success' => false, 'error' => 'User not found or inactive']);
        $stmt->close();
        exit;
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Verify the token matches
    if (empty($user['auto_login_token']) || !hash_equals($user['auto_login_token'], $token)) {
        echo json_encode(['success' => false, 'error' => 'Invalid auto-login token']);
        exit;
    }
    
    // Token is valid - create session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['full_name'] = $user['full_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['is_super_admin'] = (bool)($user['is_super_admin'] ?? false);
    $_SESSION['last_activity'] = time();
    $_SESSION['auto_login'] = true; // Mark as auto-logged in
    
    // Update last login time
    $updateStmt = $db->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $user['id']);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Create session record in database (infinite expiry for admin)
    $sessionId = session_id();
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
    
    // For admin/super_admin, set expiry to far future (10 years)
    if (in_array($user['role'], ['admin', 'super_admin'])) {
        $expiresAt = date('Y-m-d H:i:s', strtotime('+10 years'));
    } else {
        $expiresAt = date('Y-m-d H:i:s', time() + SESSION_LIFETIME);
    }
    
    $sessionStmt = $db->prepare("
        INSERT INTO sessions (session_id, user_id, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ");
    $sessionStmt->bind_param("sisss", $sessionId, $user['id'], $ipAddress, $userAgent, $expiresAt);
    $sessionStmt->execute();
    $_SESSION['session_db_id'] = $sessionStmt->insert_id;
    $sessionStmt->close();
    
    // Log auto-login
    logAuditEvent($user['id'], 'auto_login', 'user', $user['id'], "User {$user['username']} auto-logged in (Electron)");
    logMessage("User {$user['username']} auto-logged in successfully", 'info', 'auth.log');
    
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
    
} catch (Exception $e) {
    logMessage("Auto-login error: " . $e->getMessage(), 'error', 'auth.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Auto-login failed']);
}
