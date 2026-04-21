<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Session Management System
 *
 * Provides session-based authentication using MySQLi
 * NO JWT - using traditional PHP sessions as specified
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load configuration
require_once __DIR__ . '/../includes/config.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path' => '/',
        'domain' => '',
        'secure' => SESSION_SECURE,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

/**
 * Check if user is logged in
 *
 * @return bool True if logged in and session not expired
 */
function isLoggedIn() {
    // First check if basic session data exists
    if (!isset($_SESSION['user_id']) || $_SESSION['user_id'] <= 0) {
        return false;
    }
    
    // Check if session has expired (based on last_activity)
    if (isSessionExpired()) {
        // Session expired - log out the user (pass true to avoid recursion)
        logoutUser(true);
        return false;
    }
    
    return true;
}

/**
 * Require login - redirect if not logged in
 *
 * @param string $redirect_url URL to redirect to if not logged in
 */
function requireLogin($redirect_url = null) {
    if (!isLoggedIn()) {
        // Use BASE_PATH if defined, otherwise fallback to root
        $loginUrl = $redirect_url ?? (defined('BASE_PATH') ? BASE_PATH . '/login.php' : '/login.php');
        header('Location: ' . $loginUrl);
        exit;
    }

    // Update session activity
    updateSessionActivity();
}

/**
 * Check if session has expired
 * Note: Admin sessions are infinite (until logout)
 *
 * @return bool True if expired
 */
function isSessionExpired() {
    if (!isset($_SESSION['last_activity'])) {
        return true;
    }

    // Admin sessions are infinite - they only end on explicit logout
    if (isset($_SESSION['role']) && in_array($_SESSION['role'], ['admin', 'super_admin'])) {
        return false;  // Never expire admin sessions
    }

    $inactive_time = time() - $_SESSION['last_activity'];
    return $inactive_time > SESSION_LIFETIME;
}

/**
 * Update session activity timestamp
 */
function updateSessionActivity() {
    $_SESSION['last_activity'] = time();

    // Update database session record
    if (isset($_SESSION['session_db_id'])) {
        try {
            $db = getDbConnection();
            $stmt = $db->prepare("UPDATE sessions SET last_activity = NOW() WHERE id = ?");
            $stmt->bind_param("i", $_SESSION['session_db_id']);
            $stmt->execute();
            $stmt->close();
        } catch (Exception $e) {
            logMessage("Failed to update session activity: " . $e->getMessage(), 'error', 'auth.log');
        }
    }
}

/**
 * User Login
 *
 * @param string $username Username
 * @param string $password Password
 * @return array Result array with success status and user data or error
 */
function loginUser($username, $password) {
    try {
        $db = getDbConnection();

        // Prepare statement to prevent SQL injection
        // Check both username and email for flexibility
        $stmt = $db->prepare("
            SELECT id, username, password_hash, full_name, email, role, is_active, is_super_admin
            FROM users
            WHERE (username = ? OR email = ?) AND is_active = 1
        ");

        $stmt->bind_param("ss", $username, $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();

            // DEBUG: Log what we got from database
            error_log("LOGIN: Found user in database");
            error_log("LOGIN: User ID = " . $user['id']);
            error_log("LOGIN: Username = " . $user['username']);
            error_log("LOGIN: Role from DB = " . ($user['role'] ?? 'NULL'));
            error_log("LOGIN: Full name = " . ($user['full_name'] ?? 'NULL'));

            // Verify password
            if (password_verify($password, $user['password_hash'])) {
                // Password is correct - create session
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['email'] = $user['email'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['is_super_admin'] = (bool)($user['is_super_admin'] ?? false);
                $_SESSION['last_activity'] = time();

                // DEBUG: Verify session was set
                error_log("LOGIN: Session created");
                error_log("LOGIN: Session user_id = " . $_SESSION['user_id']);
                error_log("LOGIN: Session username = " . $_SESSION['username']);
                error_log("LOGIN: Session role = " . ($_SESSION['role'] ?? 'NOT SET'));

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

                // Log successful login
                logAuditEvent($user['id'], 'login', 'user', $user['id'], "User {$user['username']} logged in successfully");
                logMessage("User {$user['username']} logged in successfully", 'info', 'auth.log');

                $stmt->close();

                return [
                    'success' => true,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'full_name' => $user['full_name'],
                        'email' => $user['email'],
                        'role' => $user['role']
                    ]
                ];
            } else {
                // Invalid password
                logMessage("Failed login attempt for username: {$username} - Invalid password", 'warning', 'auth.log');
                $stmt->close();

                return [
                    'success' => false,
                    'error' => 'Invalid username or password'
                ];
            }
        } else {
            // User not found
            logMessage("Failed login attempt for username: {$username} - User not found", 'warning', 'auth.log');
            $stmt->close();

            return [
                'success' => false,
                'error' => 'Invalid username or password'
            ];
        }
    } catch (Exception $e) {
        logMessage("Login error: " . $e->getMessage(), 'error', 'auth.log');

        return [
            'success' => false,
            'error' => 'An error occurred during login. Please try again.'
        ];
    }
}

/**
 * User Login with 2FA Check
 *
 * @param string $username Username
 * @param string $password Password
 * @return array Result array with success status, user data, or 2FA requirement
 */
function loginUserWith2FA($username, $password) {
    try {
        $db = getDbConnection();

        // Prepare statement to prevent SQL injection
        // Check both username and email for flexibility
        // Also fetch 2FA columns
        $stmt = $db->prepare("
            SELECT id, username, password_hash, full_name, email, role, is_active, is_super_admin, totp_enabled, totp_secret
            FROM users
            WHERE (username = ? OR email = ?) AND is_active = 1
        ");

        $stmt->bind_param("ss", $username, $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $user = $result->fetch_assoc();

            // Verify password
            if (password_verify($password, $user['password_hash'])) {
                $stmt->close();
                
                // Check if 2FA is enabled
                if ($user['totp_enabled'] && !empty($user['totp_secret'])) {
                    // 2FA is enabled - store pending state and require 2FA verification
                    $_SESSION['pending_2fa_user_id'] = $user['id'];
                    $_SESSION['pending_2fa_user_data'] = [
                        'username' => $user['username'],
                        'full_name' => $user['full_name'],
                        'email' => $user['email'],
                        'role' => $user['role'],
                        'is_super_admin' => (bool)($user['is_super_admin'] ?? false)
                    ];
                    
                    logMessage("User {$user['username']} entered credentials, awaiting 2FA", 'info', 'auth.log');
                    
                    return [
                        'success' => true,
                        'requires_2fa' => true
                    ];
                }
                
                // No 2FA - proceed with normal login
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['email'] = $user['email'];
                $_SESSION['role'] = $user['role'];
                $_SESSION['is_super_admin'] = (bool)($user['is_super_admin'] ?? false);
                $_SESSION['last_activity'] = time();

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

                // Log successful login
                logAuditEvent($user['id'], 'login', 'user', $user['id'], "User {$user['username']} logged in successfully");
                logMessage("User {$user['username']} logged in successfully", 'info', 'auth.log');

                return [
                    'success' => true,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'full_name' => $user['full_name'],
                        'email' => $user['email'],
                        'role' => $user['role']
                    ]
                ];
            } else {
                // Invalid password
                logMessage("Failed login attempt for username: {$username} - Invalid password", 'warning', 'auth.log');
                $stmt->close();

                return [
                    'success' => false,
                    'error' => 'Invalid username or password'
                ];
            }
        } else {
            // User not found
            logMessage("Failed login attempt for username: {$username} - User not found", 'warning', 'auth.log');
            $stmt->close();

            return [
                'success' => false,
                'error' => 'Invalid username or password'
            ];
        }
    } catch (Exception $e) {
        logMessage("Login error: " . $e->getMessage(), 'error', 'auth.log');

        return [
            'success' => false,
            'error' => 'An error occurred during login. Please try again.'
        ];
    }
}

/**
 * User Logout
 * @param bool $fromExpiry If true, this logout was triggered by session expiry (avoid recursion)
 */
function logoutUser($fromExpiry = false) {
    // Check if we have a user session (without calling isLoggedIn to avoid recursion)
    $hasSession = isset($_SESSION['user_id']) && $_SESSION['user_id'] > 0;
    
    if ($hasSession) {
        $userId = $_SESSION['user_id'];
        $username = $_SESSION['username'] ?? 'unknown';

        // Delete ALL sessions for this user from database (complete logout)
        try {
            $db = getDbConnection();
            $stmt = $db->prepare("DELETE FROM sessions WHERE user_id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $stmt->close();
        } catch (Exception $e) {
            logMessage("Failed to delete sessions from database: " . $e->getMessage(), 'error', 'auth.log');
        }

        // Log logout (only if not from expiry to avoid duplicate logs)
        if (!$fromExpiry) {
            logAuditEvent($userId, 'logout', 'user', $userId, "User {$username} logged out");
            logMessage("User {$username} logged out", 'info', 'auth.log');
        } else {
            logMessage("User {$username} session expired", 'info', 'auth.log');
        }
    }

    // Clear all session data
    $_SESSION = [];
    
    // Delete the session cookie by setting expiry in the past
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params["path"],
            $params["domain"],
            $params["secure"],
            $params["httponly"]
        );
    }
    
    // Destroy the session
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    
    // Also delete any custom session cookie
    if (isset($_COOKIE[SESSION_NAME])) {
        setcookie(SESSION_NAME, '', time() - 3600, '/');
    }
}

/**
 * Get current logged-in user data
 *
 * @return array|null User data or null if not logged in
 */
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }

    return [
        'id' => $_SESSION['user_id'],
        'username' => $_SESSION['username'],
        'full_name' => $_SESSION['full_name'],
        'email' => $_SESSION['email'],
        'role' => $_SESSION['role']
    ];
}

/**
 * Check if user has specific role
 *
 * @param string|array $roles Role(s) to check
 * @return bool True if user has role
 */
function hasRole($roles) {
    if (!isLoggedIn()) {
        return false;
    }

    if (is_string($roles)) {
        $roles = [$roles];
    }

    return in_array($_SESSION['role'], $roles);
}

/**
 * Require specific role
 *
 * @param string|array $roles Required role(s)
 * @param string $redirect_url URL to redirect to if unauthorized
 */
function requireRole($roles, $redirect_url = '/403.php') {
    if (!hasRole($roles)) {
        header('Location: ' . $redirect_url);
        exit;
    }
}

/**
 * Check if user is admin
 *
 * @return bool True if admin or super_admin
 */
function isAdmin() {
    return hasRole(['admin', 'super_admin']);
}

/**
 * Log audit event
 *
 * @param int $userId User ID
 * @param string $action Action performed
 * @param string $resourceType Resource type
 * @param string $resourceId Resource ID
 * @param string $details Additional details
 */
function logAuditEvent($userId, $action, $resourceType = null, $resourceId = null, $details = null) {
    try {
        $db = getDbConnection();

        $username = $_SESSION['username'] ?? null;
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

        $stmt = $db->prepare("
            INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->bind_param(
            "isssssss",
            $userId,
            $username,
            $action,
            $resourceType,
            $resourceId,
            $details,
            $ipAddress,
            $userAgent
        );

        $stmt->execute();
        $stmt->close();
    } catch (Exception $e) {
        logMessage("Failed to log audit event: " . $e->getMessage(), 'error', 'audit.log');
    }
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions() {
    try {
        $db = getDbConnection();
        $stmt = $db->prepare("DELETE FROM sessions WHERE expires_at < NOW()");
        $stmt->execute();
        $deleted = $stmt->affected_rows;
        $stmt->close();

        if ($deleted > 0) {
            logMessage("Cleaned up {$deleted} expired session(s)", 'info', 'session.log');
        }
    } catch (Exception $e) {
        logMessage("Failed to cleanup expired sessions: " . $e->getMessage(), 'error', 'session.log');
    }
}

/**
 * Validate session token (for AJAX requests)
 *
 * @return bool True if valid
 */
function validateSession() {
    if (!isLoggedIn()) {
        return false;
    }

    if (isSessionExpired()) {
        logoutUser();
        return false;
    }

    updateSessionActivity();
    return true;
}

// Clean up expired sessions periodically (1 in 100 requests)
if (mt_rand(1, 100) === 1) {
    cleanupExpiredSessions();
}
