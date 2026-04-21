<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Sync Manager Class
 *
 * Manages automated directory synchronization from Orthanc storage to GoDaddy FTP
 * Handles file scanning, change detection, and FTP upload operations
 */

namespace DicomViewer;

class SyncManager {
    private $db;
    private $config;
    private $encryptionKey;

    public function __construct($db = null) {
        $this->db = $db ?? \getDbConnection();
        $this->loadConfiguration();
        // Use a secure encryption key from environment or generate one
        $this->encryptionKey = defined('ENCRYPTION_KEY') ? ENCRYPTION_KEY :
            hash('sha256', 'dicom_viewer_sync_encryption_key_v2');
    }

    /**
     * Load sync configuration from database
     */
    private function loadConfiguration() {
        $stmt = $this->db->prepare("SELECT * FROM sync_configuration LIMIT 1");
        $stmt->execute();
        $result = $stmt->get_result();
        $this->config = $result->fetch_assoc();
        $stmt->close();

        // Decrypt FTP password if exists
        if (!empty($this->config['ftp_password'])) {
            $this->config['ftp_password'] = $this->decrypt($this->config['ftp_password']);
        }
    }

    /**
     * Scan Orthanc storage directory for DICOM files
     *
     * @return array Array of file information
     */
    public function scanOrthancStorage() {
        $storagePath = $this->config['orthanc_storage_path'] ?? ORTHANC_STORAGE_PATH;

        if (!is_dir($storagePath)) {
            throw new \Exception("Orthanc storage path does not exist: {$storagePath}");
        }

        \logMessage("Scanning Orthanc storage: {$storagePath}", 'info', 'sync.log');

        $files = [];
        $this->scanDirectory($storagePath, $files);

        \logMessage("Found " . count($files) . " files in Orthanc storage", 'info', 'sync.log');

        return $files;
    }

    /**
     * Recursively scan directory for files
     *
     * @param string $directory Directory to scan
     * @param array &$files Reference to files array
     */
    private function scanDirectory($directory, &$files) {
        $items = scandir($directory);

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $directory . DIRECTORY_SEPARATOR . $item;

            if (is_dir($path)) {
                $this->scanDirectory($path, $files);
            } else {
                // Get file info
                $fileInfo = [
                    'path' => $path,
                    'name' => basename($path),
                    'size' => filesize($path),
                    'modified' => filemtime($path),
                    'hash' => md5_file($path),
                    'relative_path' => str_replace($this->config['orthanc_storage_path'] ?? '', '', $path)
                ];

                $files[] = $fileInfo;
            }
        }
    }

    /**
     * Detect new files that haven't been synced yet
     *
     * @param array $files Array of file information
     * @return array Array of new files to sync
     */
    public function detectNewFiles($files = null) {
        if ($files === null) {
            $files = $this->scanOrthancStorage();
        }

        $newFiles = [];

        foreach ($files as $file) {
            // Check if file has been synced before
            $stmt = $this->db->prepare("
                SELECT id FROM import_history
                WHERE file_hash = ? AND status = 'imported'
                LIMIT 1
            ");
            $stmt->bind_param("s", $file['hash']);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 0) {
                $newFiles[] = $file;
            }

            $stmt->close();
        }

        \logMessage("Detected " . count($newFiles) . " new files to sync", 'info', 'sync.log');

        return $newFiles;
    }

    /**
     * Get last sync time
     *
     * @return string|null Last sync timestamp or null if never synced
     */
    public function getLastSyncTime() {
        $stmt = $this->db->prepare("
            SELECT MAX(completed_at) as last_sync
            FROM sync_history
            WHERE status = 'success'
        ");
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        return $row['last_sync'];
    }

    /**
     * Sync files to FTP server
     *
     * @param array $files Array of files to sync
     * @return array Sync results
     */
    public function syncToFTP($files) {
        if (empty($this->config['ftp_host'])) {
            throw new \Exception("FTP host not configured");
        }

        if (empty($files)) {
            return [
                'success' => true,
                'files_synced' => 0,
                'total_size' => 0,
                'errors' => []
            ];
        }

        \logMessage("Starting FTP sync of " . count($files) . " files", 'info', 'sync.log');

        $results = [
            'success' => true,
            'files_synced' => 0,
            'total_size' => 0,
            'errors' => []
        ];

        // Connect to FTP
        $ftpConn = $this->connectFTP();

        if (!$ftpConn) {
            throw new \Exception("Failed to connect to FTP server");
        }

        try {
            foreach ($files as $file) {
                try {
                    // Create remote directory structure
                    $remotePath = ($this->config['ftp_path'] ?? '/') . ltrim($file['relative_path'], '/\\');
                    $remoteDir = dirname($remotePath);

                    // Create remote directory if it doesn't exist
                    $this->createFTPDirectory($ftpConn, $remoteDir);

                    // Upload file
                    $uploaded = ftp_put($ftpConn, $remotePath, $file['path'], FTP_BINARY);

                    if ($uploaded) {
                        $results['files_synced']++;
                        $results['total_size'] += $file['size'];
                        \logMessage("Uploaded: {$file['name']} to {$remotePath}", 'info', 'sync.log');
                    } else {
                        $error = "Failed to upload: {$file['name']}";
                        $results['errors'][] = $error;
                        \logMessage($error, 'error', 'sync.log');
                    }
                } catch (\Exception $e) {
                    $error = "Error uploading {$file['name']}: " . $e->getMessage();
                    $results['errors'][] = $error;
                    \logMessage($error, 'error', 'sync.log');
                }
            }
        } finally {
            ftp_close($ftpConn);
        }

        // Update success status
        if (!empty($results['errors'])) {
            $results['success'] = count($results['errors']) < count($files);
        }

        \logMessage("FTP sync completed: {$results['files_synced']} files synced", 'info', 'sync.log');

        return $results;
    }

    /**
     * Connect to FTP server
     *
     * @return resource|false FTP connection or false on failure
     */
    private function connectFTP() {
        $ftpConn = ftp_connect(
            $this->config['ftp_host'],
            $this->config['ftp_port'] ?? 21,
            30
        );

        if (!$ftpConn) {
            \logMessage("Failed to connect to FTP: {$this->config['ftp_host']}", 'error', 'sync.log');
            return false;
        }

        $login = ftp_login(
            $ftpConn,
            $this->config['ftp_username'],
            $this->config['ftp_password']
        );

        if (!$login) {
            \logMessage("FTP login failed for user: {$this->config['ftp_username']}", 'error', 'sync.log');
            ftp_close($ftpConn);
            return false;
        }

        // Enable passive mode if configured
        if ($this->config['ftp_passive'] ?? true) {
            ftp_pasv($ftpConn, true);
        }

        return $ftpConn;
    }

    /**
     * Create FTP directory recursively
     *
     * @param resource $ftpConn FTP connection
     * @param string $path Directory path to create
     */
    private function createFTPDirectory($ftpConn, $path) {
        $parts = explode('/', ltrim($path, '/'));
        $currentPath = '';

        foreach ($parts as $part) {
            if (empty($part)) {
                continue;
            }

            $currentPath .= '/' . $part;

            // Try to change to directory, create if it doesn't exist
            if (!@ftp_chdir($ftpConn, $currentPath)) {
                if (!@ftp_mkdir($ftpConn, $currentPath)) {
                    \logMessage("Failed to create FTP directory: {$currentPath}", 'warning', 'sync.log');
                }
                @ftp_chdir($ftpConn, $currentPath);
            }
        }

        // Change back to root
        @ftp_chdir($ftpConn, '/');
    }

    /**
     * Test FTP connection
     *
     * @return array Test result
     */
    public function testFTPConnection() {
        if (empty($this->config['ftp_host'])) {
            return [
                'success' => false,
                'message' => 'FTP host not configured'
            ];
        }

        \logMessage("Testing FTP connection to {$this->config['ftp_host']}", 'info', 'sync.log');

        $ftpConn = $this->connectFTP();

        if (!$ftpConn) {
            return [
                'success' => false,
                'message' => 'Failed to connect to FTP server'
            ];
        }

        // Test directory listing
        $list = @ftp_nlist($ftpConn, $this->config['ftp_path']);

        ftp_close($ftpConn);

        if ($list !== false) {
            \logMessage("FTP connection test successful", 'info', 'sync.log');
            return [
                'success' => true,
                'message' => 'FTP connection successful',
                'files_in_directory' => count($list)
            ];
        } else {
            \logMessage("FTP directory access failed: {$this->config['ftp_path']}", 'error', 'sync.log');
            return [
                'success' => false,
                'message' => 'Connected but cannot access FTP directory'
            ];
        }
    }

    /**
     * Create sync history record
     *
     * @param string $type Sync type (manual, scheduled, monitoring)
     * @param string $destination Destination (localhost, godaddy, both)
     * @param int $filesCount Number of files synced
     * @param int $size Total size in bytes
     * @param string $status Status (success, failed, partial)
     * @param string|null $errorMessage Error message if failed
     * @return int|false Insert ID or false on failure
     */
    public function createSyncHistory($type, $destination, $filesCount, $size, $status, $errorMessage = null) {
        $stmt = $this->db->prepare("
            INSERT INTO sync_history
            (sync_type, destination, files_synced, total_size_bytes, status, error_message, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");

        $stmt->bind_param(
            "ssiiss",
            $type,
            $destination,
            $filesCount,
            $size,
            $status,
            $errorMessage
        );

        $result = $stmt->execute();
        $insertId = $stmt->insert_id;
        $stmt->close();

        // Update last sync time in configuration
        if ($status === 'success') {
            $updateStmt = $this->db->prepare("
                UPDATE sync_configuration
                SET last_sync_at = NOW()
                WHERE id = 1
            ");
            $updateStmt->execute();
            $updateStmt->close();
        }

        \logMessage("Sync history created: ID={$insertId}, Status={$status}", 'info', 'sync.log');

        return $result ? $insertId : false;
    }

    /**
     * Update sync configuration
     *
     * @param array $configData Configuration data
     * @return bool Success status
     */
    public function updateConfiguration($configData) {
        // Encrypt password if provided
        if (!empty($configData['ftp_password'])) {
            $configData['ftp_password'] = $this->encrypt($configData['ftp_password']);
        }

        $fields = [];
        $params = [];
        $types = '';

        $allowedFields = [
            'orthanc_storage_path', 'hospital_data_path', 'ftp_host', 'ftp_username',
            'ftp_password', 'ftp_port', 'ftp_path', 'ftp_passive', 'sync_enabled',
            'sync_interval', 'monitoring_enabled', 'monitoring_interval'
        ];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $configData)) {
                $fields[] = "{$field} = ?";
                $params[] = $configData[$field];

                // Determine type
                if (in_array($field, ['ftp_port', 'sync_interval', 'monitoring_interval'])) {
                    $types .= 'i';
                } elseif (in_array($field, ['ftp_passive', 'sync_enabled', 'monitoring_enabled'])) {
                    $types .= 'i';
                } else {
                    $types .= 's';
                }
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "UPDATE sync_configuration SET " . implode(', ', $fields) . " WHERE id = 1";
        $stmt = $this->db->prepare($sql);

        if (!$stmt) {
            \logMessage("Failed to prepare update statement: " . $this->db->error, 'error', 'sync.log');
            return false;
        }

        $stmt->bind_param($types, ...$params);
        $result = $stmt->execute();
        $stmt->close();

        if ($result) {
            \logMessage("Sync configuration updated successfully", 'info', 'sync.log');
            $this->loadConfiguration(); // Reload configuration
        }

        return $result;
    }

    /**
     * Get current configuration
     *
     * @param bool $maskPassword Whether to mask the password
     * @return array Configuration data
     */
    public function getConfiguration($maskPassword = true) {
        $config = $this->config;

        if ($maskPassword && !empty($config['ftp_password'])) {
            $config['ftp_password'] = str_repeat('*', 8);
        }

        return $config;
    }

    /**
     * Enable auto-sync
     *
     * @return bool Success status
     */
    public function enableAutoSync() {
        $stmt = $this->db->prepare("UPDATE sync_configuration SET sync_enabled = 1 WHERE id = 1");
        $result = $stmt->execute();
        $stmt->close();

        if ($result) {
            \logMessage("Auto-sync enabled", 'info', 'sync.log');
            $this->config['sync_enabled'] = 1;
        }

        return $result;
    }

    /**
     * Disable auto-sync
     *
     * @return bool Success status
     */
    public function disableAutoSync() {
        $stmt = $this->db->prepare("UPDATE sync_configuration SET sync_enabled = 0 WHERE id = 1");
        $result = $stmt->execute();
        $stmt->close();

        if ($result) {
            \logMessage("Auto-sync disabled", 'info', 'sync.log');
            $this->config['sync_enabled'] = 0;
        }

        return $result;
    }

    /**
     * Encrypt string using AES-256
     *
     * @param string $data Data to encrypt
     * @return string Encrypted data
     */
    private function encrypt($data) {
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($data, 'aes-256-cbc', $this->encryptionKey, 0, $iv);
        return base64_encode($encrypted . '::' . $iv);
    }

    /**
     * Decrypt string using AES-256
     *
     * @param string $data Data to decrypt
     * @return string Decrypted data
     */
    private function decrypt($data) {
        $parts = explode('::', base64_decode($data), 2);
        if (count($parts) < 2) {
            return $data; // Return as-is if not encrypted
        }

        list($encrypted, $iv) = $parts;
        return openssl_decrypt($encrypted, 'aes-256-cbc', $this->encryptionKey, 0, $iv);
    }

    /**
     * Get sync statistics
     *
     * @return array Sync statistics
     */
    public function getSyncStatistics() {
        $stmt = $this->db->prepare("
            SELECT
                COUNT(*) as total_syncs,
                SUM(files_synced) as total_files_synced,
                SUM(total_size_bytes) as total_size_synced,
                MAX(completed_at) as last_sync,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs
            FROM sync_history
            WHERE completed_at IS NOT NULL
        ");

        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        $stmt->close();

        return $stats;
    }
}

