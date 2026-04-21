<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Google Drive Backup System
 *
 * Handles automated backups to Google Drive including:
 * - Database backup (mysqldump)
 * - PHP, JS, and config files backup
 * - Upload to Google Drive
 * - Restore functionality
 * - Backup retention management
 */

namespace DicomViewer;

use Google_Client;
use Google_Service_Drive;
use Google_Service_Drive_DriveFile;
use Google_Service_Drive_FileList;
use mysqli;
use Exception;
use ZipArchive;

class GoogleDriveBackup
{
    private $db;
    private $googleClient;
    private $driveService;
    private $config;
    private $backupPath;
    private $logFile;

    /**
     * Constructor - Initialize Google Drive client with credentials
     *
     * @param mysqli $db Database connection
     * @throws Exception If initialization fails
     */
    public function __construct(mysqli $db)
    {
        $this->db = $db;
        $this->backupPath = __DIR__ . '/../../backups/temp/';
        $this->logFile = __DIR__ . '/../../logs/gdrive-backup.log';

        // Create backup directory if it doesn't exist
        if (!is_dir($this->backupPath)) {
            mkdir($this->backupPath, 0755, true);
        }

        // Load configuration from database
        $this->loadConfig();

        // Initialize Google Client if credentials are available
        if ($this->config && !empty($this->config['client_id'])) {
            $this->initializeGoogleClient();
        }
    }

    /**
     * Load backup configuration from database
     *
     * @throws Exception If configuration cannot be loaded
     */
    private function loadConfig()
    {
        $query = "SELECT * FROM gdrive_backup_config LIMIT 1";
        $result = $this->db->query($query);

        if (!$result) {
            throw new Exception("Failed to load backup configuration: " . $this->db->error);
        }

        $this->config = $result->fetch_assoc() ?? [];
        $result->free();
    }

    /**
     * Initialize Google Drive client
     *
     * @throws Exception If client initialization fails
     */
    private function initializeGoogleClient()
    {
        try {
            $this->googleClient = new Google_Client();
            $this->googleClient->setApplicationName('Hospital DICOM Viewer Pro Backup');
            $this->googleClient->setScopes([Google_Service_Drive::DRIVE_FILE]);
            $this->googleClient->setClientId($this->config['client_id']);
            $this->googleClient->setClientSecret($this->config['client_secret']);
            $this->googleClient->setAccessType('offline');
            $this->googleClient->setPrompt('consent');

            // Set refresh token if available
            if (!empty($this->config['refresh_token'])) {
                $this->googleClient->setRefreshToken($this->config['refresh_token']);

                // Refresh access token
                if ($this->googleClient->isAccessTokenExpired()) {
                    $this->googleClient->fetchAccessTokenWithRefreshToken($this->googleClient->getRefreshToken());
                }
            }

            $this->driveService = new Google_Service_Drive($this->googleClient);
        } catch (Exception $e) {
            $this->log("Failed to initialize Google Client: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * OAuth2 authentication flow
     *
     * @param string $authCode Authorization code from OAuth callback
     * @return array Authentication result
     * @throws Exception If authentication fails
     */
    public function authenticate($authCode)
    {
        try {
            if (!$this->googleClient) {
                $this->initializeGoogleClient();
            }

            // Exchange authorization code for access token
            $accessToken = $this->googleClient->fetchAccessTokenWithAuthCode($authCode);

            if (isset($accessToken['error'])) {
                throw new Exception($accessToken['error_description'] ?? 'Authentication failed');
            }

            // Get refresh token
            $refreshToken = $this->googleClient->getRefreshToken();

            if ($refreshToken) {
                // Save refresh token to database
                $configId = $this->config['id'] ?? 1;
                $stmt = $this->db->prepare("UPDATE gdrive_backup_config SET refresh_token = ? WHERE id = ?");
                $stmt->bind_param('si', $refreshToken, $configId);
                $stmt->execute();
                $stmt->close();

                $this->config['refresh_token'] = $refreshToken;
            }

            $this->log("Google Drive authentication successful", 'info');

            return [
                'success' => true,
                'message' => 'Authentication successful',
                'has_refresh_token' => !empty($refreshToken)
            ];
        } catch (Exception $e) {
            $this->log("Authentication failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Get OAuth2 authorization URL
     *
     * @param string $redirectUri OAuth redirect URI
     * @return string Authorization URL
     */
    public function getAuthUrl($redirectUri)
    {
        if (!$this->googleClient) {
            $this->initializeGoogleClient();
        }

        $this->googleClient->setRedirectUri($redirectUri);
        return $this->googleClient->createAuthUrl();
    }

    /**
     * Create complete backup (database + files)
     *
     * @param string $backupType Type of backup ('manual' or 'scheduled')
     * @return array Backup result
     * @throws Exception If backup creation fails
     */
    public function createBackup($backupType = 'manual')
    {
        try {
            $this->log("Starting backup creation ({$backupType})", 'info');

            $timestamp = date('Y-m-d_H-i-s');
            $backupName = "dicom_viewer_backup_{$timestamp}";
            $zipFilePath = $this->backupPath . $backupName . '.zip';

            // Create ZIP archive
            $zip = new ZipArchive();
            if ($zip->open($zipFilePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new Exception("Failed to create ZIP archive");
            }

            // Backup database
            if (!empty($this->config['backup_database'])) {
                $this->log("Backing up database...", 'info');
                $sqlFile = $this->backupDatabase();
                $zip->addFile($sqlFile, 'database/' . basename($sqlFile));
            }

            // Backup PHP files
            if (!empty($this->config['backup_php_files'])) {
                $this->log("Backing up PHP files...", 'info');
                $this->backupFiles($zip, 'php');
            }

            // Backup JS files
            if (!empty($this->config['backup_js_files'])) {
                $this->log("Backing up JavaScript files...", 'info');
                $this->backupFiles($zip, 'js');
            }

            // Backup config files
            if (!empty($this->config['backup_config_files'])) {
                $this->log("Backing up config files...", 'info');
                $this->backupConfigFiles($zip);
            }

            $zip->close();

            $fileSize = filesize($zipFilePath);
            $this->log("Backup ZIP created: {$backupName}.zip (" . $this->formatBytes($fileSize) . ")", 'info');

            // Upload to Google Drive
            $gdriveFileId = null;
            if ($this->driveService) {
                $gdriveFileId = $this->uploadToGoogleDrive($zipFilePath);
            }

            // Save to backup history
            $this->saveBackupHistory($backupType, $backupName, $gdriveFileId, $fileSize);

            // Clean up temporary files
            @unlink($this->backupPath . 'database.sql');

            // Update last backup time
            $configId = $this->config['id'] ?? 1;
            $this->db->query("UPDATE gdrive_backup_config SET last_backup_at = NOW() WHERE id = {$configId}");

            $this->log("Backup completed successfully", 'info');

            return [
                'success' => true,
                'backup_name' => $backupName,
                'size_bytes' => $fileSize,
                'size_formatted' => $this->formatBytes($fileSize),
                'gdrive_file_id' => $gdriveFileId,
                'local_path' => $zipFilePath
            ];
        } catch (Exception $e) {
            $this->log("Backup failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Backup database using mysqldump
     *
     * @return string Path to SQL file
     * @throws Exception If database backup fails
     */
    public function backupDatabase()
    {
        $sqlFile = $this->backupPath . 'database.sql';

        $dbHost = DB_HOST;
        $dbUser = DB_USER;
        $dbPassword = DB_PASSWORD;
        $dbName = DB_NAME;

        // Use mysqldump command
        $command = sprintf(
            'mysqldump --host=%s --user=%s --password=%s --single-transaction --routines --triggers %s > %s',
            escapeshellarg($dbHost),
            escapeshellarg($dbUser),
            escapeshellarg($dbPassword),
            escapeshellarg($dbName),
            escapeshellarg($sqlFile)
        );

        // Execute mysqldump
        exec($command . ' 2>&1', $output, $returnCode);

        if ($returnCode !== 0) {
            // Fallback to PHP-based backup if mysqldump fails
            $this->log("mysqldump failed, using PHP backup method", 'warning');
            $this->backupDatabasePHP($sqlFile);
        }

        if (!file_exists($sqlFile) || filesize($sqlFile) === 0) {
            throw new Exception("Database backup file is empty or not created");
        }

        return $sqlFile;
    }

    /**
     * PHP-based database backup (fallback method)
     *
     * @param string $sqlFile Path to save SQL file
     * @throws Exception If backup fails
     */
    private function backupDatabasePHP($sqlFile)
    {
        $handle = fopen($sqlFile, 'w');
        if (!$handle) {
            throw new Exception("Cannot create SQL file");
        }

        // Write header
        fwrite($handle, "-- Hospital DICOM Viewer Pro v2.0 Database Backup\n");
        fwrite($handle, "-- Date: " . date('Y-m-d H:i:s') . "\n\n");
        fwrite($handle, "SET FOREIGN_KEY_CHECKS=0;\n\n");

        // Get all tables
        $tablesResult = $this->db->query("SHOW TABLES");
        while ($row = $tablesResult->fetch_array()) {
            $table = $row[0];

            // Get CREATE TABLE statement
            $createResult = $this->db->query("SHOW CREATE TABLE `{$table}`");
            $createRow = $createResult->fetch_array();
            fwrite($handle, "\n\n-- Table: {$table}\n");
            fwrite($handle, "DROP TABLE IF EXISTS `{$table}`;\n");
            fwrite($handle, $createRow[1] . ";\n\n");

            // Get table data
            $dataResult = $this->db->query("SELECT * FROM `{$table}`");
            if ($dataResult && $dataResult->num_rows > 0) {
                while ($dataRow = $dataResult->fetch_assoc()) {
                    $columns = array_keys($dataRow);
                    $values = array_map(function ($value) {
                        if ($value === null) return 'NULL';
                        return "'" . $this->db->real_escape_string($value) . "'";
                    }, array_values($dataRow));

                    fwrite($handle, "INSERT INTO `{$table}` (`" . implode('`, `', $columns) . "`) VALUES (" . implode(', ', $values) . ");\n");
                }
            }
        }

        fwrite($handle, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        fclose($handle);
    }

    /**
     * Backup files (PHP or JS) to ZIP
     *
     * @param ZipArchive $zip ZIP archive object
     * @param string $type File type ('php' or 'js')
     */
    private function backupFiles($zip, $type)
    {
        $basePath = __DIR__ . '/../../';
        $extensions = $type === 'php' ? ['php'] : ['js'];

        $directories = [
            'includes',
            'api',
            'admin',
            'auth',
            'public',
            'scripts'
        ];

        if ($type === 'js') {
            $directories = ['js', 'assets/js'];
        }

        foreach ($directories as $dir) {
            $fullPath = $basePath . $dir;
            if (is_dir($fullPath)) {
                $this->addDirectoryToZip($zip, $fullPath, $dir, $extensions);
            }
        }
    }

    /**
     * Backup configuration files
     *
     * @param ZipArchive $zip ZIP archive object
     */
    private function backupConfigFiles($zip)
    {
        $basePath = __DIR__ . '/../../';
        $configFiles = [
            'config/.env',
            'config/.env.example',
            'composer.json',
            '.htaccess'
        ];

        foreach ($configFiles as $file) {
            $fullPath = $basePath . $file;
            if (file_exists($fullPath)) {
                $zip->addFile($fullPath, 'config/' . basename($file));
            }
        }
    }

    /**
     * Recursively add directory to ZIP
     *
     * @param ZipArchive $zip ZIP archive
     * @param string $sourcePath Source directory path
     * @param string $zipPath Path inside ZIP
     * @param array $extensions File extensions to include
     */
    private function addDirectoryToZip($zip, $sourcePath, $zipPath, $extensions = [])
    {
        $files = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($sourcePath, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($files as $file) {
            if ($file->isDir()) {
                continue;
            }

            $filePath = $file->getRealPath();
            $fileExtension = pathinfo($filePath, PATHINFO_EXTENSION);

            // Skip if extension doesn't match
            if (!empty($extensions) && !in_array($fileExtension, $extensions)) {
                continue;
            }

            $relativePath = str_replace($sourcePath, '', $filePath);
            $relativePath = ltrim($relativePath, '\\/');
            $zipFilePath = $zipPath . '/' . $relativePath;

            $zip->addFile($filePath, $zipFilePath);
        }
    }

    /**
     * Upload backup ZIP to Google Drive
     *
     * @param string $zipFilePath Path to ZIP file
     * @return string Google Drive file ID
     * @throws Exception If upload fails
     */
    public function uploadToGoogleDrive($zipFilePath)
    {
        try {
            $this->log("Uploading to Google Drive...", 'info');

            // Get or create backup folder
            $folderId = $this->getOrCreateFolder();

            // Create file metadata
            $fileMetadata = new Google_Service_Drive_DriveFile([
                'name' => basename($zipFilePath),
                'parents' => [$folderId]
            ]);

            // Upload file
            $content = file_get_contents($zipFilePath);
            $file = $this->driveService->files->create($fileMetadata, [
                'data' => $content,
                'mimeType' => 'application/zip',
                'uploadType' => 'multipart',
                'fields' => 'id,name,size,createdTime'
            ]);

            $this->log("Uploaded to Google Drive: {$file->id}", 'info');

            return $file->id;
        } catch (Exception $e) {
            $this->log("Google Drive upload failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Get or create Google Drive backup folder
     *
     * @return string Folder ID
     * @throws Exception If folder operation fails
     */
    private function getOrCreateFolder()
    {
        // Check if folder ID is already saved
        if (!empty($this->config['folder_id'])) {
            try {
                // Verify folder still exists
                $this->driveService->files->get($this->config['folder_id']);
                return $this->config['folder_id'];
            } catch (Exception $e) {
                // Folder no longer exists, create new one
            }
        }

        // Search for folder by name
        $folderName = $this->config['folder_name'] ?? 'DICOM_Viewer_Backups';
        $query = "name = '{$folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

        $response = $this->driveService->files->listFiles([
            'q' => $query,
            'spaces' => 'drive',
            'fields' => 'files(id, name)'
        ]);

        if (count($response->files) > 0) {
            $folderId = $response->files[0]->id;
        } else {
            // Create new folder
            $folderMetadata = new Google_Service_Drive_DriveFile([
                'name' => $folderName,
                'mimeType' => 'application/vnd.google-apps.folder'
            ]);

            $folder = $this->driveService->files->create($folderMetadata, [
                'fields' => 'id'
            ]);

            $folderId = $folder->id;
        }

        // Save folder ID to database
        $stmt = $this->db->prepare("UPDATE gdrive_backup_config SET folder_id = ? WHERE id = ?");
        $stmt->bind_param('si', $folderId, $this->config['id']);
        $stmt->execute();
        $stmt->close();

        return $folderId;
    }

    /**
     * List all backups from Google Drive
     *
     * @return array List of backups
     */
    public function listBackups()
    {
        try {
            $backups = [];

            // Get backups from database
            $query = "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 50";
            $result = $this->db->query($query);

            while ($row = $result->fetch_assoc()) {
                $backups[] = [
                    'id' => $row['id'],
                    'backup_name' => $row['backup_name'],
                    'backup_type' => $row['backup_type'],
                    'gdrive_file_id' => $row['gdrive_file_id'],
                    'size_bytes' => $row['file_size_bytes'],
                    'size_formatted' => $this->formatBytes($row['file_size_bytes']),
                    'status' => $row['status'],
                    'created_at' => $row['created_at'],
                    'includes_database' => (bool)$row['includes_database'],
                    'includes_php' => (bool)$row['includes_php'],
                    'includes_js' => (bool)$row['includes_js'],
                    'includes_config' => (bool)$row['includes_config']
                ];
            }

            return [
                'success' => true,
                'backups' => $backups,
                'total' => count($backups)
            ];
        } catch (Exception $e) {
            $this->log("Failed to list backups: " . $e->getMessage(), 'error');
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'backups' => []
            ];
        }
    }

    /**
     * Download backup from Google Drive
     *
     * @param string $fileId Google Drive file ID
     * @return string Path to downloaded file
     * @throws Exception If download fails
     */
    public function downloadBackup($fileId)
    {
        try {
            $this->log("Downloading backup from Google Drive: {$fileId}", 'info');

            // Get file metadata
            $file = $this->driveService->files->get($fileId, ['fields' => 'name']);
            $fileName = $file->name;

            // Download file content
            $response = $this->driveService->files->get($fileId, ['alt' => 'media']);
            $content = $response->getBody()->getContents();

            // Save to temp directory
            $downloadPath = $this->backupPath . $fileName;
            file_put_contents($downloadPath, $content);

            $this->log("Backup downloaded: {$fileName}", 'info');

            return $downloadPath;
        } catch (Exception $e) {
            $this->log("Download failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Delete backup from Google Drive
     *
     * @param string $fileId Google Drive file ID
     * @return bool Success status
     * @throws Exception If deletion fails
     */
    public function deleteBackup($fileId)
    {
        try {
            $this->log("Deleting backup from Google Drive: {$fileId}", 'info');

            $this->driveService->files->delete($fileId);

            // Remove from database
            $stmt = $this->db->prepare("DELETE FROM backup_history WHERE gdrive_file_id = ?");
            $stmt->bind_param('s', $fileId);
            $stmt->execute();
            $stmt->close();

            $this->log("Backup deleted successfully", 'info');

            return true;
        } catch (Exception $e) {
            $this->log("Delete failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Restore from backup
     *
     * @param int $backupId Backup history ID
     * @return array Restore result
     * @throws Exception If restore fails
     */
    public function restoreBackup($backupId)
    {
        try {
            $this->log("Starting restore from backup ID: {$backupId}", 'info');

            // Get backup info
            $stmt = $this->db->prepare("SELECT * FROM backup_history WHERE id = ?");
            $stmt->bind_param('i', $backupId);
            $stmt->execute();
            $result = $stmt->get_result();
            $backup = $result->fetch_assoc();
            $stmt->close();

            if (!$backup) {
                throw new Exception("Backup not found");
            }

            // Download from Google Drive if needed
            $zipPath = null;
            if ($backup['gdrive_file_id']) {
                $zipPath = $this->downloadBackup($backup['gdrive_file_id']);
            } else {
                throw new Exception("Backup file not available");
            }

            // Extract ZIP
            $extractPath = $this->backupPath . 'restore_' . time() . '/';
            mkdir($extractPath, 0755, true);

            $zip = new ZipArchive();
            if ($zip->open($zipPath) !== true) {
                throw new Exception("Failed to open backup ZIP file");
            }

            $zip->extractTo($extractPath);
            $zip->close();

            // Restore database if included
            if ($backup['includes_database']) {
                $this->log("Restoring database...", 'info');
                $this->restoreDatabase($extractPath . 'database/database.sql');
            }

            // Restore files would go here (optional, risky in production)
            // For safety, we only restore database by default

            // Clean up
            $this->deleteDirectory($extractPath);
            @unlink($zipPath);

            $this->log("Restore completed successfully", 'info');

            return [
                'success' => true,
                'message' => 'Backup restored successfully',
                'backup_name' => $backup['backup_name']
            ];
        } catch (Exception $e) {
            $this->log("Restore failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Restore database from SQL file
     *
     * @param string $sqlFile Path to SQL file
     * @throws Exception If restore fails
     */
    private function restoreDatabase($sqlFile)
    {
        if (!file_exists($sqlFile)) {
            throw new Exception("SQL file not found: {$sqlFile}");
        }

        // Disable autocommit for transaction support
        $this->db->autocommit(false);

        try {
            // Read SQL file
            $sql = file_get_contents($sqlFile);

            // Split into individual queries
            $queries = array_filter(
                array_map('trim', explode(';', $sql)),
                function ($query) {
                    return !empty($query) && substr($query, 0, 2) !== '--';
                }
            );

            // Execute each query
            foreach ($queries as $query) {
                if (!empty($query)) {
                    if (!$this->db->query($query)) {
                        throw new Exception("Query failed: " . $this->db->error);
                    }
                }
            }

            // Commit transaction
            $this->db->commit();
            $this->db->autocommit(true);

            $this->log("Database restored successfully", 'info');
        } catch (Exception $e) {
            // Rollback on error
            $this->db->rollback();
            $this->db->autocommit(true);
            throw $e;
        }
    }

    /**
     * Clean up old backups based on retention policy
     *
     * @param int $retentionDays Number of days to retain backups
     * @return array Cleanup result
     */
    public function cleanupOldBackups($retentionDays = null)
    {
        try {
            if ($retentionDays === null) {
                $retentionDays = $this->config['retention_days'] ?? 30;
            }

            $this->log("Cleaning up backups older than {$retentionDays} days", 'info');

            // Get old backups
            $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
            $query = "SELECT id, gdrive_file_id, backup_name FROM backup_history WHERE created_at < ? AND status = 'success'";
            $stmt = $this->db->prepare($query);
            $stmt->bind_param('s', $cutoffDate);
            $stmt->execute();
            $result = $stmt->get_result();

            $deletedCount = 0;
            $errors = [];

            while ($row = $result->fetch_assoc()) {
                try {
                    if ($row['gdrive_file_id']) {
                        $this->deleteBackup($row['gdrive_file_id']);
                        $deletedCount++;
                    }
                } catch (Exception $e) {
                    $errors[] = "Failed to delete {$row['backup_name']}: " . $e->getMessage();
                }
            }

            $this->log("Cleanup completed: {$deletedCount} backups deleted", 'info');

            return [
                'success' => true,
                'deleted_count' => $deletedCount,
                'errors' => $errors
            ];
        } catch (Exception $e) {
            $this->log("Cleanup failed: " . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * Save backup to history
     *
     * @param string $backupType Type of backup
     * @param string $backupName Backup name
     * @param string $gdriveFileId Google Drive file ID
     * @param int $fileSize File size in bytes
     */
    private function saveBackupHistory($backupType, $backupName, $gdriveFileId, $fileSize)
    {
        $stmt = $this->db->prepare("
            INSERT INTO backup_history (
                backup_type, backup_name, gdrive_file_id, file_size_bytes,
                includes_database, includes_php, includes_js, includes_config,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success')
        ");

        $stmt->bind_param(
            'sssiiiii',
            $backupType,
            $backupName,
            $gdriveFileId,
            $fileSize,
            $this->config['backup_database'] ?? 0,
            $this->config['backup_php_files'] ?? 0,
            $this->config['backup_js_files'] ?? 0,
            $this->config['backup_config_files'] ?? 0
        );

        $stmt->execute();
        $stmt->close();
    }

    /**
     * Test Google Drive connection
     *
     * @return array Connection test result
     */
    public function testConnection()
    {
        try {
            if (!$this->driveService) {
                throw new Exception("Google Drive service not initialized");
            }

            // Try to list files (limited to 1)
            $response = $this->driveService->files->listFiles([
                'pageSize' => 1,
                'fields' => 'files(id, name)'
            ]);

            return [
                'success' => true,
                'message' => 'Connection successful',
                'authenticated' => true
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Connection failed: ' . $e->getMessage(),
                'authenticated' => false
            ];
        }
    }

    /**
     * Delete directory recursively
     *
     * @param string $dir Directory path
     */
    private function deleteDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }

        rmdir($dir);
    }

    /**
     * Format bytes to human-readable size
     *
     * @param int $bytes Size in bytes
     * @return string Formatted size
     */
    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }

    /**
     * Log message to file
     *
     * @param string $message Log message
     * @param string $level Log level
     */
    private function log($message, $level = 'info')
    {
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [{$level}] {$message}\n";

        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        file_put_contents($this->logFile, $logEntry, FILE_APPEND);
    }

    /**
     * Get backup statistics
     *
     * @return array Backup statistics
     */
    public function getStatistics()
    {
        $stats = [];

        // Total backups
        $result = $this->db->query("SELECT COUNT(*) as total FROM backup_history");
        $stats['total_backups'] = $result->fetch_assoc()['total'];

        // Successful backups
        $result = $this->db->query("SELECT COUNT(*) as total FROM backup_history WHERE status = 'success'");
        $stats['successful_backups'] = $result->fetch_assoc()['total'];

        // Failed backups
        $result = $this->db->query("SELECT COUNT(*) as total FROM backup_history WHERE status = 'failed'");
        $stats['failed_backups'] = $result->fetch_assoc()['total'];

        // Total size
        $result = $this->db->query("SELECT SUM(file_size_bytes) as total FROM backup_history WHERE status = 'success'");
        $totalSize = $result->fetch_assoc()['total'] ?? 0;
        $stats['total_size_bytes'] = $totalSize;
        $stats['total_size_formatted'] = $this->formatBytes($totalSize);

        // Last backup
        $result = $this->db->query("SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 1");
        $stats['last_backup'] = $result->fetch_assoc();

        return $stats;
    }
}
