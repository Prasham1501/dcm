<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Login API Endpoint
 *
 * POST /api/auth/login.php
 * Body: { "username": "...", "password": "..." }
 * Returns: { "success": true, "user": {...} } or { "requires_2fa": true }
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');

// Enable CORS
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../auth/session.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input', 400);
    }

    // Validate input
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    if (empty($username) || empty($password)) {
        sendErrorResponse('Username and password are required', 400);
    }

    // Sanitize username
    $username = sanitizeInput($username);

    // Attempt login (no 2FA at login - 2FA only for private settings)
    $result = loginUser($username, $password);

    if ($result['success']) {
        // Generate auto-login token for Electron desktop app
        $autoLoginToken = null;
        try {
            $autoLoginToken = bin2hex(random_bytes(32)); // 64-char hex token
            $db = getDbConnection();
            $updateStmt = $db->prepare("UPDATE users SET auto_login_token = ? WHERE id = ?");
            $updateStmt->bind_param("si", $autoLoginToken, $result['user']['id']);
            $updateStmt->execute();
            $updateStmt->close();
        } catch (Exception $e) {
            logMessage("Failed to generate auto-login token: " . $e->getMessage(), 'warning', 'auth.log');
        }

        // Normal login successful
        sendJsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => $result['user'],
            'auto_login_token' => $autoLoginToken // For Electron auto-login
        ], 200);
    } else {
        sendErrorResponse($result['error'], 401);
    }

} catch (Exception $e) {
    logMessage("Login API error: " . $e->getMessage(), 'error', 'api.log');
    sendErrorResponse('An unexpected error occurred', 500);
}

