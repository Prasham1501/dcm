<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Current User API Endpoint
 *
 * GET /api/auth/me.php
 * Returns: { "success": true, "user": {...} }
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');

// Enable CORS
header('Access-Control-Allow-Origin: ' . ($_ENV['CORS_ALLOWED_ORIGINS'] ?? '*'));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../auth/session.php';

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Check if logged in
    if (!validateSession()) {
        sendErrorResponse('Not authenticated', 401);
    }

    $user = getCurrentUser();

    sendJsonResponse([
        'success' => true,
        'user' => $user
    ], 200);

} catch (Exception $e) {
    logMessage("Get current user API error: " . $e->getMessage(), 'error', 'api.log');
    sendErrorResponse('An unexpected error occurred', 500);
}
