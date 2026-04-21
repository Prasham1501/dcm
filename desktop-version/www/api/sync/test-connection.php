<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Test FTP Connection API Endpoint
 *
 * POST /api/sync/test-connection.php
 * Tests FTP connectivity
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
        sendErrorResponse('FTP not configured - Please configure FTP settings first', 400);
    }

    logMessage("Testing FTP connection to {$config['ftp_host']} initiated by {$currentUser['username']}", 'info', 'sync.log');

    // Test FTP connection
    $testResult = $syncManager->testFTPConnection();

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'test_ftp_connection',
        'sync_configuration',
        '1',
        "FTP connection test: " . ($testResult['success'] ? 'Success' : 'Failed')
    );

    if ($testResult['success']) {
        logMessage("FTP connection test successful", 'info', 'sync.log');

        sendSuccessResponse(
            [
                'connection_status' => 'success',
                'ftp_host' => $config['ftp_host'],
                'ftp_port' => $config['ftp_port'],
                'ftp_path' => $config['ftp_path'],
                'files_in_directory' => $testResult['files_in_directory'] ?? 0,
                'message' => $testResult['message']
            ],
            'FTP connection successful'
        );
    } else {
        logMessage("FTP connection test failed: {$testResult['message']}", 'error', 'sync.log');

        sendErrorResponse(
            $testResult['message'],
            400
        );
    }

} catch (Exception $e) {
    logMessage("Error testing FTP connection: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Failed to test FTP connection: ' . $e->getMessage(), 500);
}
