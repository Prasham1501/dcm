<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Sync Status API Endpoint
 *
 * GET /api/sync/status.php
 * Returns sync status and history
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
    // Get database connection
    $db = getDbConnection();

    // Get last sync info
    $lastSyncStmt = $db->prepare("
        SELECT
            id,
            sync_type,
            destination,
            files_synced,
            total_size_bytes,
            status,
            error_message,
            started_at,
            completed_at,
            TIMESTAMPDIFF(SECOND, started_at, completed_at) as duration_seconds
        FROM sync_history
        ORDER BY started_at DESC
        LIMIT 1
    ");

    $lastSyncStmt->execute();
    $lastSyncResult = $lastSyncStmt->get_result();
    $lastSync = $lastSyncResult->fetch_assoc();
    $lastSyncStmt->close();

    // Format last sync data
    if ($lastSync) {
        $lastSync['total_size_mb'] = round($lastSync['total_size_bytes'] / (1024 * 1024), 2);
    }

    // Get recent sync history (last 10)
    $historyStmt = $db->prepare("
        SELECT
            id,
            sync_type,
            destination,
            files_synced,
            total_size_bytes,
            status,
            error_message,
            started_at,
            completed_at,
            TIMESTAMPDIFF(SECOND, started_at, completed_at) as duration_seconds
        FROM sync_history
        ORDER BY started_at DESC
        LIMIT 10
    ");

    $historyStmt->execute();
    $historyResult = $historyStmt->get_result();
    $syncHistory = [];

    while ($row = $historyResult->fetch_assoc()) {
        $row['total_size_mb'] = round($row['total_size_bytes'] / (1024 * 1024), 2);
        $syncHistory[] = $row;
    }

    $historyStmt->close();

    // Get sync configuration
    $configStmt = $db->prepare("
        SELECT
            sync_enabled,
            sync_interval,
            last_sync_at
        FROM sync_configuration
        LIMIT 1
    ");

    $configStmt->execute();
    $configResult = $configStmt->get_result();
    $config = $configResult->fetch_assoc();
    $configStmt->close();

    // Calculate next sync time if auto-sync is enabled
    $nextSyncTime = null;
    if ($config['sync_enabled'] && $config['last_sync_at']) {
        $lastSyncTimestamp = strtotime($config['last_sync_at']);
        $intervalSeconds = $config['sync_interval'] * 60;
        $nextSyncTimestamp = $lastSyncTimestamp + $intervalSeconds;
        $nextSyncTime = date('Y-m-d H:i:s', $nextSyncTimestamp);
    }

    // Get sync statistics
    $statsStmt = $db->prepare("
        SELECT
            COUNT(*) as total_syncs,
            SUM(files_synced) as total_files_synced,
            SUM(total_size_bytes) as total_size_synced,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
            SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_syncs
        FROM sync_history
    ");

    $statsStmt->execute();
    $statsResult = $statsStmt->get_result();
    $stats = $statsResult->fetch_assoc();
    $statsStmt->close();

    // Format statistics
    if ($stats) {
        $stats['total_size_synced_mb'] = round(($stats['total_size_synced'] ?? 0) / (1024 * 1024), 2);
        $stats['total_size_synced_gb'] = round(($stats['total_size_synced'] ?? 0) / (1024 * 1024 * 1024), 2);
    }

    // Return success response
    sendSuccessResponse(
        [
            'last_sync' => $lastSync,
            'sync_history' => $syncHistory,
            'configuration' => [
                'sync_enabled' => (bool)$config['sync_enabled'],
                'sync_interval' => (int)$config['sync_interval'],
                'last_sync_at' => $config['last_sync_at'],
                'next_sync_at' => $nextSyncTime
            ],
            'statistics' => $stats
        ],
        'Sync status retrieved successfully'
    );

} catch (Exception $e) {
    logMessage("Error retrieving sync status: " . $e->getMessage(), 'error', 'sync.log');
    sendErrorResponse('Failed to retrieve sync status: ' . $e->getMessage(), 500);
}
