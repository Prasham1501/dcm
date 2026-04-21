<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Sync Configuration API Endpoint
 *
 * GET /api/sync/get-config.php
 * Returns current sync configuration (password masked)
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/classes/SyncManager.php';

// Set JSON response header
header('Content-Type: application/json');

// Handle CORS
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET method
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

// Check admin role
if (!isAdmin()) {
    sendErrorResponse('Forbidden - Admin access required', 403);
}

try {
    // Initialize SyncManager
    $syncManager = new DicomViewer\SyncManager();

    // Get configuration with password masked
    $config = $syncManager->getConfiguration(true);

    // Get sync statistics
    $stats = $syncManager->getSyncStatistics();

    // Return success response
    sendSuccessResponse(
        [
            'configuration' => $config,
            'statistics' => $stats
        ],
        'Sync configuration retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving sync configuration: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Failed to retrieve sync configuration: ' . $e->getMessage(), 500);
}
