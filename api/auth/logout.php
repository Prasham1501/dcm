<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Logout API Endpoint
 *
 * POST /api/auth/logout.php
 * Returns: { "success": true, "message": "Logged out successfully" }
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
    // Logout user
    logoutUser();

    sendJsonResponse([
        'success' => true,
        'message' => 'Logged out successfully'
    ], 200);

} catch (Exception $e) {
    logMessage("Logout API error: " . $e->getMessage(), 'error', 'api.log');
    sendErrorResponse('An unexpected error occurred', 500);
}
