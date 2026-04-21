<?php
/**
 * Session Check API
 * Returns JSON response with session status
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/session.php';

try {
    // Check if user is logged in
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'authenticated' => false,
            'message' => 'Not authenticated'
        ]);
        exit;
    }

    // Get user info from session
    $userId = $_SESSION['user_id'] ?? null;
    $username = $_SESSION['username'] ?? null;
    $role = $_SESSION['role'] ?? null;

    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'user' => [
            'id' => $userId,
            'username' => $username,
            'role' => $role
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'error' => APP_ENV === 'development' ? $e->getMessage() : 'Session check failed'
    ]);
}
