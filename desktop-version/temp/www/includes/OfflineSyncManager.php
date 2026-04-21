<?php
/**
 * Offline Sync Manager
 * Handles offline data queueing and synchronization
 *
 * Features:
 * - Queue data when offline
 * - Process sync queue when online
 * - Track sync status and attempts
 * - Handle conflicts and retries
 */

if (!defined('DICOM_VIEWER')) {
    die('Direct access not allowed');
}

class OfflineSyncManager {

    private $db;
    private $machineId;
    private $maxRetries = 5;
    private $syncBatchSize = 50;

    // Data types that can be synced
    const DATA_TYPE_PRINT_LOG = 'print_log';
    const DATA_TYPE_ACTIVITY = 'activity';
    const DATA_TYPE_USAGE_STATS = 'usage_stats';

    public function __construct($db = null) {
        $this->db = $db ?: getDbConnection();
        $this->loadMachineId();
    }

    /**
     * Load machine ID from installation
     */
    private function loadMachineId(): void {
        $result = $this->db->query("SELECT machine_id FROM installation_license WHERE id = 1");
        if ($result && $row = $result->fetch_assoc()) {
            $this->machineId = $row['machine_id'];
        }
    }

    /**
     * Queue data for sync when offline
     *
     * @param string $dataType Type of data (print_log, activity, etc.)
     * @param array $payload Data to sync
     * @return array Result with queue_id
     */
    public function queueForSync(string $dataType, array $payload): array {
        $payloadJson = json_encode($payload);

        $stmt = $this->db->prepare("
            INSERT INTO offline_sync_queue (machine_id, data_type, payload, sync_status)
            VALUES (?, ?, ?, 'pending')
        ");

        $stmt->bind_param("sss", $this->machineId, $dataType, $payloadJson);

        if ($stmt->execute()) {
            $queueId = $this->db->insert_id;
            $stmt->close();

            return [
                'success' => true,
                'queue_id' => $queueId,
                'message' => 'Data queued for sync'
            ];
        }

        $error = $stmt->error;
        $stmt->close();

        return ['success' => false, 'error' => $error];
    }

    /**
     * Process sync queue - call this when connection is restored
     *
     * @param callable|null $syncCallback Optional callback for custom sync logic
     * @return array Results of sync operation
     */
    public function processSyncQueue(?callable $syncCallback = null): array {
        $results = [
            'processed' => 0,
            'synced' => 0,
            'failed' => 0,
            'errors' => []
        ];

        // Get pending items
        $stmt = $this->db->prepare("
            SELECT id, data_type, payload, sync_attempts
            FROM offline_sync_queue
            WHERE machine_id = ?
            AND sync_status IN ('pending', 'failed')
            AND sync_attempts < ?
            ORDER BY created_at ASC
            LIMIT ?
        ");

        $stmt->bind_param("sii", $this->machineId, $this->maxRetries, $this->syncBatchSize);
        $stmt->execute();
        $result = $stmt->get_result();

        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = $row;
        }
        $stmt->close();

        foreach ($items as $item) {
            $results['processed']++;

            // Mark as syncing
            $this->updateSyncStatus($item['id'], 'syncing');

            try {
                $payload = json_decode($item['payload'], true);

                // Process based on data type
                $syncResult = false;

                if ($syncCallback) {
                    // Use custom callback
                    $syncResult = $syncCallback($item['data_type'], $payload);
                } else {
                    // Use default sync logic
                    $syncResult = $this->syncDataItem($item['data_type'], $payload);
                }

                if ($syncResult) {
                    $this->markAsSynced($item['id']);
                    $results['synced']++;
                } else {
                    $this->markAsFailed($item['id'], 'Sync returned false');
                    $results['failed']++;
                }
            } catch (Exception $e) {
                $this->markAsFailed($item['id'], $e->getMessage());
                $results['failed']++;
                $results['errors'][] = [
                    'id' => $item['id'],
                    'error' => $e->getMessage()
                ];
            }
        }

        return $results;
    }

    /**
     * Default sync logic for different data types
     */
    private function syncDataItem(string $dataType, array $payload): bool {
        switch ($dataType) {
            case self::DATA_TYPE_PRINT_LOG:
                return $this->syncPrintLog($payload);

            case self::DATA_TYPE_ACTIVITY:
                return $this->syncActivity($payload);

            case self::DATA_TYPE_USAGE_STATS:
                return $this->syncUsageStats($payload);

            default:
                return false;
        }
    }

    /**
     * Sync print log to main table
     */
    private function syncPrintLog(array $payload): bool {
        // The print log should already be in the database (logged while offline)
        // This is for syncing to a central server if needed

        // For now, just mark the offline print as synced
        if (isset($payload['print_job_id'])) {
            $stmt = $this->db->prepare("
                UPDATE print_logs SET synced_at = NOW(), is_offline_print = 1
                WHERE print_job_id = ?
            ");
            $stmt->bind_param("s", $payload['print_job_id']);
            $result = $stmt->execute();
            $stmt->close();
            return $result;
        }

        return true;
    }

    /**
     * Sync activity log
     */
    private function syncActivity(array $payload): bool {
        // Activity is already logged locally
        // This would sync to central server
        return true;
    }

    /**
     * Sync usage stats
     */
    private function syncUsageStats(array $payload): bool {
        // Usage stats are already aggregated locally
        // This would sync to central server
        return true;
    }

    /**
     * Update sync status
     */
    private function updateSyncStatus(int $id, string $status): void {
        $stmt = $this->db->prepare("
            UPDATE offline_sync_queue
            SET sync_status = ?, last_sync_attempt = NOW(), sync_attempts = sync_attempts + 1
            WHERE id = ?
        ");
        $stmt->bind_param("si", $status, $id);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Mark item as synced
     */
    private function markAsSynced(int $id): void {
        $stmt = $this->db->prepare("
            UPDATE offline_sync_queue
            SET sync_status = 'synced', synced_at = NOW()
            WHERE id = ?
        ");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Mark item as failed
     */
    private function markAsFailed(int $id, string $error): void {
        $stmt = $this->db->prepare("
            UPDATE offline_sync_queue
            SET sync_status = 'failed', sync_error = ?
            WHERE id = ?
        ");
        $stmt->bind_param("si", $error, $id);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Get pending sync count
     */
    public function getPendingSyncCount(): int {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count
            FROM offline_sync_queue
            WHERE machine_id = ?
            AND sync_status IN ('pending', 'failed')
            AND sync_attempts < ?
        ");
        $stmt->bind_param("si", $this->machineId, $this->maxRetries);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        return $row['count'] ?? 0;
    }

    /**
     * Get sync queue status
     */
    public function getSyncQueueStatus(): array {
        $stmt = $this->db->prepare("
            SELECT
                sync_status,
                COUNT(*) as count,
                MAX(created_at) as latest
            FROM offline_sync_queue
            WHERE machine_id = ?
            GROUP BY sync_status
        ");
        $stmt->bind_param("s", $this->machineId);
        $stmt->execute();
        $result = $stmt->get_result();

        $status = [
            'pending' => 0,
            'syncing' => 0,
            'synced' => 0,
            'failed' => 0
        ];

        while ($row = $result->fetch_assoc()) {
            $status[$row['sync_status']] = $row['count'];
        }
        $stmt->close();

        return $status;
    }

    /**
     * Clear synced items older than X days
     */
    public function clearOldSyncedItems(int $days = 30): int {
        $stmt = $this->db->prepare("
            DELETE FROM offline_sync_queue
            WHERE sync_status = 'synced'
            AND synced_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        ");
        $stmt->bind_param("i", $days);
        $stmt->execute();
        $affected = $stmt->affected_rows;
        $stmt->close();

        return $affected;
    }

    /**
     * Check if system is online (has server connectivity)
     * Override this method for custom connectivity check
     */
    public function isOnline(): bool {
        // Simple check - try to connect to a known endpoint
        // In a real implementation, this would check the central server

        // For local-only installations, always return true
        $result = $this->db->query("
            SELECT setting_value FROM system_settings
            WHERE setting_key = 'central_server_url'
        ");

        if (!$result || !$row = $result->fetch_assoc()) {
            return true; // No central server, always online
        }

        $serverUrl = $row['setting_value'];
        if (empty($serverUrl)) {
            return true;
        }

        // Try to reach the server
        $ch = curl_init($serverUrl . '/api/ping');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode >= 200 && $httpCode < 400;
    }

    /**
     * Queue print for offline processing
     * Convenience method specifically for print logs
     */
    public function queueOfflinePrint(array $printData): array {
        // Add metadata
        $printData['queued_at'] = date('Y-m-d H:i:s');
        $printData['machine_id'] = $this->machineId;

        return $this->queueForSync(self::DATA_TYPE_PRINT_LOG, $printData);
    }

    /**
     * Get all pending offline prints
     */
    public function getPendingOfflinePrints(): array {
        $stmt = $this->db->prepare("
            SELECT id, payload, created_at
            FROM offline_sync_queue
            WHERE machine_id = ?
            AND data_type = ?
            AND sync_status = 'pending'
            ORDER BY created_at ASC
        ");

        $dataType = self::DATA_TYPE_PRINT_LOG;
        $stmt->bind_param("ss", $this->machineId, $dataType);
        $stmt->execute();
        $result = $stmt->get_result();

        $prints = [];
        while ($row = $result->fetch_assoc()) {
            $row['payload'] = json_decode($row['payload'], true);
            $prints[] = $row;
        }
        $stmt->close();

        return $prints;
    }

    /**
     * Sync offline prints to main print_logs table
     * Used when operating without central server
     */
    public function syncOfflinePrintsLocally(): array {
        require_once __DIR__ . '/PrintTracker.php';

        $printTracker = new PrintTracker($this->db);
        $pendingPrints = $this->getPendingOfflinePrints();

        $results = [
            'processed' => 0,
            'synced' => 0,
            'failed' => 0
        ];

        foreach ($pendingPrints as $item) {
            $results['processed']++;

            try {
                $printData = $item['payload'];
                $printData['is_offline'] = 1;
                $printData['offline_queue_id'] = $item['id'];

                $logResult = $printTracker->logPrint($printData);

                if ($logResult['success']) {
                    $this->markAsSynced($item['id']);
                    $results['synced']++;
                } else {
                    $this->markAsFailed($item['id'], $logResult['error'] ?? 'Unknown error');
                    $results['failed']++;
                }
            } catch (Exception $e) {
                $this->markAsFailed($item['id'], $e->getMessage());
                $results['failed']++;
            }
        }

        return $results;
    }
}