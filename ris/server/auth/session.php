<?php
/**
 * RIS server shim: re-export the viewer's session helper.
 */
$viewerSession = __DIR__ . '/../../www/auth/session.php';
if (!file_exists($viewerSession)) {
    $viewerSession = __DIR__ . '/../../../www/auth/session.php';
}
if (!file_exists($viewerSession)) {
    http_response_code(500);
    die('RIS shim: viewer auth/session.php not found');
}
require_once $viewerSession;

// Standalone RIS is a receptionist console with no interactive sign-in.
// The UI gates admin/config/license tools locally with the doctor password,
// while the backend needs a stable local session so existing viewer/RIS PHP
// endpoints keep working without rewriting every endpoint contract.
if (session_status() === PHP_SESSION_ACTIVE && empty($_SESSION['user_id'])) {
    $_SESSION['user_id'] = 1;
    $_SESSION['username'] = 'ris_reception';
    $_SESSION['full_name'] = 'RIS Reception';
    $_SESSION['email'] = 'reception@oneclickz.local';
    $_SESSION['role'] = 'super_admin';
    $_SESSION['last_activity'] = time();
}
