<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Sync Now API Endpoint
 *
 * POST /api/sync/sync-now.php
 * Triggers immediate sync operation
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

    // Validate FTP configuration
    if (empty($config['ftp_host']) || empty($config['ftp_username'])) {
        sendErrorResponse('FTP not configured - Please configure FTP settings first', 400);
    }

    logMessage("Starting manual sync initiated by {$currentUser['username']}", 'info', 'sync.log');

    $startTime = microtime(true);

    // Step 1: Scan Orthanc storage
    logMessage("Scanning Orthanc storage directory", 'info', 'sync.log');
    $allFiles = $syncManager->scanOrthancStorage();

    // Step 2: Detect new files
    logMessage("Detecting new files", 'info', 'sync.log');
    $newFiles = $syncManager->detectNewFiles($allFiles);

    if (empty($newFiles)) {
        logMessage("No new files to sync", 'info', 'sync.log');

        // Create history record
        $syncManager->createSyncHistory(
            'manual',
            'godaddy',
            0,
            0,
            'success',
            null
        );

        sendSuccessResponse(
            [
                'files_synced' => 0,
                'total_size_mb' => 0,
                'duration_seconds' => round(microtime(true) - $startTime, 2),
                'message' => 'No new files to sync'
            ],
            'Sync completed - No new files found'
        );
    }

    // Step 3: Sync to FTP with retry logic
    logMessage("Syncing " . count($newFiles) . " files to FTP", 'info', 'sync.log');

    $maxRetries = 3;
    $retryCount = 0;
    $syncResult = null;
    $lastError = null;

    while ($retryCount < $maxRetries) {
        try {
            $syncResult = $syncManager->syncToFTP($newFiles);

            if ($syncResult['success']) {
                break; // Success - exit retry loop
            } else {
                $lastError = implode('; ', $syncResult['errors']);
                $retryCount++;

                if ($retryCount < $maxRetries) {
                    logMessage("Sync attempt {$retryCount} failed, retrying...", 'warning', 'sync.log');
                    sleep(2); // Wait 2 seconds before retry
                }
            }
        } catch (Exception $e) {
            $lastError = $e->getMessage();
            $retryCount++;

            if ($retryCount < $maxRetries) {
                logMessage("Sync attempt {$retryCount} failed: {$lastError}, retrying...", 'warning', 'sync.log');
                sleep(2);
            }
        }
    }

    // Determine final status
    $status = 'failed';
    $errorMessage = null;

    if ($syncResult && $syncResult['success']) {
        $status = 'success';
    } elseif ($syncResult && $syncResult['files_synced'] > 0) {
        $status = 'partial';
        $errorMessage = $lastError;
    } else {
        $errorMessage = $lastError ?? 'Sync failed after ' . $maxRetries . ' attempts';
    }

    // Calculate total size in MB
    $totalSizeMB = round(($syncResult['total_size'] ?? 0) / (1024 * 1024), 2);
    $duration = round(microtime(true) - $startTime, 2);

    // Create sync history record
    $historyId = $syncManager->createSyncHistory(
        'manual',
        'godaddy',
        $syncResult['files_synced'] ?? 0,
        $syncResult['total_size'] ?? 0,
        $status,
        $errorMessage
    );

    // Log audit event
    logAuditEvent(
        $currentUser['id'],
        'sync',
        'sync_operation',
        $historyId,
        "Manual sync: {$syncResult['files_synced']} files, {$totalSizeMB} MB, Status: {$status}"
    );

    logMessage(
        "Sync completed: {$syncResult['files_synced']} files synced, {$totalSizeMB} MB, Status: {$status}",
        $status === 'success' ? 'info' : 'warning',
        'sync.log'
    );

    // Return response based on status
    if ($status === 'success') {
        sendSuccessResponse(
            [
                'files_synced' => $syncResult['files_synced'],
                'total_size_mb' => $totalSizeMB,
                'duration_seconds' => $duration,
                'status' => $status
            ],
            'Sync completed successfully'
        );
    } elseif ($status === 'partial') {
        sendSuccessResponse(
            [
                'files_synced' => $syncResult['files_synced'],
                'total_size_mb' => $totalSizeMB,
                'duration_seconds' => $duration,
                'status' => $status,
                'errors' => $syncResult['errors']
            ],
            'Sync partially completed with errors'
        );
    } else {
        sendErrorResponse(
            "Sync failed: {$errorMessage}",
            500
        );
    }

} catch (Exception $e) {
    logMessage("Error during sync: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Sync failed: ' . $e->getMessage(), 500);
}
