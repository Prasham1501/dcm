<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Enable Auto-Sync API Endpoint
 *
 * POST /api/sync/enable-auto.php
 * Enables automatic sync
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
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
    // Get current user
    $currentUser = getCurrentUser();

    // Initialize SyncManager
    $syncManager = new DicomViewer\SyncManager();

    // Get configuration
    $config = $syncManager->getConfiguration(false);

    // Validate FTP configuration exists
    if (empty($config['ftp_host']) || empty($config['ftp_username'])) {
        sendErrorResponse('Cannot enable auto-sync - FTP not configured. Please configure FTP settings first', 400);
    }

    // Enable auto-sync
    $result = $syncManager->enableAutoSync();

    if (!$result) {
        throw new Exception("Failed to enable auto-sync");
    }

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'enable_auto_sync',
        'sync_configuration',
        '1',
        "Enabled automatic sync"
    );

    logMessage("User {$currentUser['username']} enabled auto-sync", 'info', 'sync.log');

    // Return success response
    sendSuccessResponse(
        [
            'sync_enabled' => true,
            'sync_interval' => (int)$config['sync_interval']
        ],
        'Auto-sync enabled successfully'
    );

} catch (Exception $e) {
    logMessage("Error enabling auto-sync: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Failed to enable auto-sync: ' . $e->getMessage(), 500);
}
