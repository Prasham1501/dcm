<?php
/**
 * Print Sync API
 * Handle offline print sync operations
 *
 * POST - Sync offline prints
 * GET  - Get sync status
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/OfflineSyncManager.php';
require_once __DIR__ . '/../../includes/PrintTracker.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet($db);
            break;

        case 'POST':
            handlePost($db);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * GET - Get sync status
 */
function handleGet($db) {
    $syncManager = new OfflineSyncManager($db);

    $status = $syncManager->getSyncQueueStatus();
    $pendingCount = $syncManager->getPendingSyncCount();
    $isOnline = $syncManager->isOnline();

    echo json_encode([
        'success' => true,
        'is_online' => $isOnline,
        'pending_count' => $pendingCount,
        'status' => $status
    ]);
}

/**
 * POST - Process sync
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    $action = $data['action'] ?? 'sync';

    $syncManager = new OfflineSyncManager($db);

    switch ($action) {
        case 'sync':
            // Process pending sync queue
            $result = $syncManager->processSyncQueue();
            echo json_encode([
                'success' => true,
                'result' => $result
            ]);
            break;

        case 'sync_local':
            // Sync offline prints to local database
            $result = $syncManager->syncOfflinePrintsLocally();
            echo json_encode([
                'success' => true,
                'result' => $result
            ]);
            break;

        case 'queue':
            // Queue a print for offline sync
            if (empty($data['print_data'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No print data provided']);
                return;
            }

            $result = $syncManager->queueOfflinePrint($data['print_data']);
            echo json_encode($result);
            break;

        case 'clear_synced':
            // Clear old synced items
            $days = $data['days'] ?? 30;
            $cleared = $syncManager->clearOldSyncedItems($days);
            echo json_encode([
                'success' => true,
                'cleared' => $cleared
            ]);
            break;

        case 'bulk_log':
            // Bulk log multiple prints (for syncing from client)
            if (empty($data['prints']) || !is_array($data['prints'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No prints array provided']);
                return;
            }

            $printTracker = new PrintTracker($db);
            $results = [
                'success' => 0,
                'failed' => 0,
                'errors' => []
            ];

            foreach ($data['prints'] as $printData) {
                $printData['is_offline'] = 1;
                $logResult = $printTracker->logPrint($printData);

                if ($logResult['success']) {
                    $results['success']++;
                } else {
                    $results['failed']++;
                    $results['errors'][] = $logResult['error'];
                }
            }

            echo json_encode([
                'success' => true,
                'result' => $results
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
}