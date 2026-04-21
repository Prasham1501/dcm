<?php
/**
 * Verify 2FA Code for Private Settings Access
 * POST /api/auth/verify-private-settings.php
 * 
 * This endpoint verifies a TOTP code for accessing private settings.
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
require_once __DIR__ . '/../../includes/TotpAuth.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Check if logged in
    if (!validateSession()) {
        sendErrorResponse('Not authenticated', 401);
    }

    // Get POST data
    $input = json_decode(file_get_contents('php://input'), true);
    $code = $input['code'] ?? '';

    if (empty($code) || strlen($code) !== 6) {
        sendErrorResponse('Invalid code format', 400);
    }

    // Only allow digits
    if (!ctype_digit($code)) {
        sendErrorResponse('Code must contain only digits', 400);
    }

    // Get user's TOTP secret from database
    $db = getDbConnection();
    $stmt = $db->prepare("SELECT totp_secret, totp_enabled FROM users WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user || !$user['totp_enabled'] || empty($user['totp_secret'])) {
        sendErrorResponse('2FA is not enabled for this account', 400);
    }

    // Verify the code
    $totp = new TotpAuth();
    if (!$totp->verifyCode($user['totp_secret'], $code)) {
        // Log failed attempt
        logMessage("Private settings 2FA verification failed for user ID: " . $_SESSION['user_id'], 'warning', 'auth.log');
        sendErrorResponse('Invalid verification code', 401);
    }

    // Log successful access
    logMessage("Private settings unlocked via 2FA for user ID: " . $_SESSION['user_id'], 'info', 'auth.log');

    // Mark private settings as unlocked in session
    $_SESSION['private_settings_unlocked'] = true;
    $_SESSION['private_settings_unlocked_at'] = time();

    sendJsonResponse([
        'success' => true,
        'message' => 'Access granted'
    ], 200);

} catch (Exception $e) {
    logMessage("Private settings 2FA verification error: " . $e->getMessage(), 'error', 'api.log');
    sendErrorResponse('An unexpected error occurred', 500);
}
