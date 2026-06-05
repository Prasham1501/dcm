<?php
/**
 * Desktop auto-login — establishes a PHP session for the local single-user
 * desktop viewer, which has no login screen. OPT-IN and product-scoped:
 * only works when DESKTOP_AUTOLOGIN is enabled in this install's config/.env.
 *
 * IMPORTANT: leave DESKTOP_AUTOLOGIN unset (off) for the networked RIS product,
 * where real per-user login + roles are required.
 *
 * POST -> { user } (session established) | 403 when disabled.
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Enabled by a per-install flag file at the app root (ships with the desktop
// viewer; absent for the networked RIS) or the DESKTOP_AUTOLOGIN env var.
$flagFile = __DIR__ . '/../../.desktop-autologin';
$enabled = is_file($flagFile) || filter_var(getenv('DESKTOP_AUTOLOGIN') ?: '', FILTER_VALIDATE_BOOLEAN);
if (!$enabled) {
    sendErrorResponse('Desktop auto-login is disabled', 403);
}

try {
    if (validateSession()) {
        sendSuccessResponse(getCurrentUser(), 'Session already active');
    }

    $db = getDbConnection();
    // Prefer a configured desktop user; else the first active admin.
    $wantUser = getenv('DESKTOP_AUTOLOGIN_USER') ?: '';
    if ($wantUser !== '') {
        $stmt = $db->prepare("SELECT id, username, full_name, email, role FROM users WHERE username = ? AND is_active = 1 LIMIT 1");
        $stmt->bind_param('s', $wantUser);
        $stmt->execute();
        $u = $stmt->get_result()->fetch_assoc();
        $stmt->close();
    } else {
        $res = $db->query("SELECT id, username, full_name, email, role FROM users
                           WHERE is_active = 1 AND role IN ('admin','super_admin') ORDER BY id LIMIT 1");
        $u = $res ? $res->fetch_assoc() : null;
    }
    if (!$u) {
        sendErrorResponse('No eligible desktop user found', 500);
    }

    $_SESSION['user_id'] = $u['id'];
    $_SESSION['username'] = $u['username'];
    $_SESSION['full_name'] = $u['full_name'];
    $_SESSION['email'] = $u['email'];
    $_SESSION['role'] = $u['role'];
    $_SESSION['is_super_admin'] = ($u['role'] === 'super_admin');
    $_SESSION['last_activity'] = time();

    if (function_exists('logAuditEvent')) {
        logAuditEvent($u['id'], 'desktop_login', 'user', $u['id'], 'Desktop auto-login session established');
    }
    sendSuccessResponse(['user' => $u], 'Desktop session established');
} catch (Throwable $e) {
    logMessage('Desktop login error: ' . $e->getMessage(), 'error', 'auth.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
