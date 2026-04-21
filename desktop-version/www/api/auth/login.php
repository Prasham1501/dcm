<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Login API Endpoint
 *
 * POST /api/auth/login.php
 * Body: { "username": "...", "password": "..." }
 * Returns: { "success": true, "user": {...} }
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

    // Attempt login
    $result = loginUser($username, $password);

    if ($result['success']) {
        sendJsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => $result['user']
        ], 200);
    } else {
        sendErrorResponse($result['error'], 401);
    }

} catch (Exception $e) {
    logMessage("Login API error: " . $e->getMessage(), 'error', 'api.log');
    sendErrorResponse('An unexpected error occurred', 500);
}
