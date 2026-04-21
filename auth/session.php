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
 * @return bool True if logged in
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && $_SESSION['user_id'] > 0;
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
 *
 * @return bool True if expired
 */
function isSessionExpired() {
    if (!isset($_SESSION['last_activity'])) {
        return true;
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
            SELECT id, username, password_hash, full_name, email, role, is_active
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
                // Password is correct - create session
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['email'] = $user['email'];
                $_SESSION['role'] = $user['role'];
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
 * User Logout
 */
function logoutUser() {
    if (isLoggedIn()) {
        $userId = $_SESSION['user_id'];
        $username = $_SESSION['username'];

        // Delete session from database
        if (isset($_SESSION['session_db_id'])) {
            try {
                $db = getDbConnection();
                $stmt = $db->prepare("DELETE FROM sessions WHERE id = ?");
                $stmt->bind_param("i", $_SESSION['session_db_id']);
                $stmt->execute();
                $stmt->close();
            } catch (Exception $e) {
                logMessage("Failed to delete session from database: " . $e->getMessage(), 'error', 'auth.log');
            }
        }

        // Log logout
        logAuditEvent($userId, 'logout', 'user', $userId, "User {$username} logged out");
        logMessage("User {$username} logged out", 'info', 'auth.log');
    }

    // Destroy session
    $_SESSION = [];
    session_destroy();

    // Delete session cookie
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
 * @return bool True if admin
 */
function isAdmin() {
    return hasRole('admin');
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
