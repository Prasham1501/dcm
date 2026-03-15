<?php
/**
 * Backup Manager Class
 * Handles database backup, file compression, and Google Drive uploads
 */

class BackupManager {
    private $db;
    private $driveService;
    private $backupDir;
    private $folderName;
    
    public function __construct() {
        $this->db = getDbConnection();
        $this->backupDir = __DIR__ . '/../../backups/temp';
        $this->folderName = 'DICOM_Viewer_Backups';
        
        // Create backup directory if not exists
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
        
        $this->initializeGoogleDrive();
    }
    
    private function initializeGoogleDrive() {
        // Check for temporary credentials first (used by multi-account backup)
        $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
        $key = 'temp_gdrive_credentials';
        $stmt->bind_param('s', $key);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
        
        // If no temp credentials, use main credentials
        if (!$row || empty($row['config_value'])) {
            $key = 'gdrive_credentials';
            $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
            $stmt->bind_param('s', $key);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
        }
        
        if (!$row || empty($row['config_value'])) {
            throw new Exception('Google Drive not configured');
        }
        
        $credentials = json_decode($row['config_value'], true);
        
        // Initialize Google Client
        $client = new Google_Client();
        $client->setAuthConfig($credentials);
        $client->addScope(Google_Service_Drive::DRIVE_FILE);
        $client->setApplicationName('DICOM Viewer Pro - Backup');
        
        $this->driveService = new Google_Service_Drive($client);
        
        // Get folder name - check temp first
        $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
        $key = 'temp_gdrive_folder';
        $stmt->bind_param('s', $key);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();
        
        if ($row && !empty($row['config_value'])) {
            $this->folderName = $row['config_value'];
        } else {
            // Fall back to main folder
            $key = 'gdrive_folder_name';
            $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
            $stmt->bind_param('s', $key);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
            
            if ($row && !empty($row['config_value'])) {
                $this->folderName = $row['config_value'];
            }
        }
    }
    
    /**
     * Export database to SQL file
     */
    private function exportDatabase($outputFile) {
        $tables = [];
        $result = $this->db->query("SHOW TABLES");
        
        while ($row = $result->fetch_array()) {
            $tables[] = $row[0];
        }
        
        $sql = "-- DICOM Viewer Database Backup\n";
        $sql .= "-- Generated: " . date('Y-m-d H:i:s') . "\n\n";
        $sql .= "SET FOREIGN_KEY_CHECKS=0;\n\n";
        
        foreach ($tables as $table) {
            // Get CREATE TABLE statement
            $createResult = $this->db->query("SHOW CREATE TABLE `$table`");
            $createRow = $createResult->fetch_array();
            $sql .= "-- Table: $table\n";
            $sql .= "DROP TABLE IF EXISTS `$table`;\n";
            $sql .= $createRow[1] . ";\n\n";
            
            // Get table data
            $dataResult = $this->db->query("SELECT * FROM `$table`");
            
            if ($dataResult->num_rows > 0) {
                $sql .= "-- Data for table: $table\n";
                
                while ($dataRow = $dataResult->fetch_assoc()) {
                    $columns = array_keys($dataRow);
                    $values = array_map(function($val) {
                        return $val === null ? 'NULL' : "'" . $this->db->real_escape_string($val) . "'";
                    }, array_values($dataRow));
                    
                    $sql .= "INSERT INTO `$table` (`" . implode('`, `', $columns) . "`) VALUES (" . implode(', ', $values) . ");\n";
                }
                $sql .= "\n";
            }
        }
        
        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
        
        file_put_contents($outputFile, $sql);
        return filesize($outputFile);
    }
    
    /**
     * Create ZIP archive of database and files
     */
    public function createBackup($backupType = 'manual') {
        $timestamp = date('Y-m-d_H-i-s');
        $backupName = "dicom_backup_{$timestamp}";
        $sqlFile = $this->backupDir . "/{$backupName}.sql";
        $zipFile = $this->backupDir . "/{$backupName}.zip";
        
        try {
            // Check if ZipArchive is available
            if (!class_exists('ZipArchive')) {
                throw new Exception("ZipArchive extension not loaded. Please restart Apache from XAMPP Control Panel or enable php_zip.dll in php.ini");
            }

            // Export database
            $dbSize = $this->exportDatabase($sqlFile);

            // Create ZIP
            $zip = new ZipArchive();
            if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new Exception("Cannot create ZIP file");
            }
            
            // Add SQL file
            $zip->addFile($sqlFile, basename($sqlFile));
            
            // Add DICOM files if they exist
            $dicomDir = __DIR__ . '/../../dicom_files';
            if (is_dir($dicomDir)) {
                $this->addDirectoryToZip($zip, $dicomDir, 'dicom_files');
            }
            
            $zip->close();
            
            // Upload to Google Drive
            $driveFileId = $this->uploadToGoogleDrive($zipFile, $backupName . '.zip');
            
            // Save to database
            $backupSize = filesize($zipFile);
            $stmt = $this->db->prepare("
                INSERT INTO backup_history 
                (backup_filename, gdrive_file_id, backup_size_bytes, backup_date, backup_type, status)
                VALUES (?, ?, ?, NOW(), ?, 'completed')
            ");
            $filename = $backupName . '.zip';
            $stmt->bind_param('ssis', $filename, $driveFileId, $backupSize, $backupType);
            $stmt->execute();
            $backupId = $stmt->insert_id;
            $stmt->close();
            
            // Cleanup local files
            unlink($sqlFile);
            unlink($zipFile);
            
            return [
                'success' => true,
                'backup_id' => $backupId,
                'filename' => $filename,
                'size' => $backupSize,
                'gdrive_file_id' => $driveFileId
            ];
            
        } catch (Exception $e) {
            // Log error
            if (isset($backupName)) {
                $stmt = $this->db->prepare("
                    INSERT INTO backup_history 
                    (backup_filename, backup_date, backup_type, status, error_message)
                    VALUES (?, NOW(), ?, 'failed', ?)
                ");
                $filename = $backupName . '.zip';
                $errorMsg = $e->getMessage();
                $stmt->bind_param('sss', $filename, $backupType, $errorMsg);
                $stmt->execute();
                $stmt->close();
            }
            
            throw $e;
        }
    }
    
    /**
     * Recursively add directory to ZIP
     */
    private function addDirectoryToZip($zip, $dir, $zipPath) {
        if (!is_dir($dir)) return;
        
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        
        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = $zipPath . '/' . substr($filePath, strlen($dir) + 1);
                $zip->addFile($filePath, $relativePath);
            }
        }
    }
    
    /**
     * Upload file to Google Drive
     */
    private function uploadToGoogleDrive($filePath, $fileName) {
        // Find or create backup folder
        $folderId = $this->findOrCreateFolder($this->folderName);
        
        // Create file metadata
        $fileMetadata = new Google_Service_Drive_DriveFile([
            'name' => $fileName,
            'parents' => [$folderId]
        ]);
        
        // Upload file
        $content = file_get_contents($filePath);
        $file = $this->driveService->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => 'application/zip',
            'uploadType' => 'multipart'
        ]);
        
        return $file->id;
    }
    
    /**
     * Find or create Google Drive folder
     */
    private function findOrCreateFolder($folderName) {
        // Search for existing folder
        $query = "name='{$folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false";
        $results = $this->driveService->files->listFiles([
            'q' => $query,
            'fields' => 'files(id, name)'
        ]);
        
        if (count($results->getFiles()) > 0) {
            return $results->getFiles()[0]->id;
        }
        
        // Create new folder
        $fileMetadata = new Google_Service_Drive_DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder'
        ]);
        
        $folder = $this->driveService->files->create($fileMetadata, [
            'fields' => 'id'
        ]);
        
        return $folder->id;
    }
    
    /**
     * Get backup statistics
     */
    public function getBackupStats() {
        // Get Drive quota
        $about = $this->driveService->about->get(['fields' => 'storageQuota']);
        $quota = $about->getStorageQuota();
        
        // Get backup files from Drive
        $folderId = $this->findOrCreateFolder($this->folderName);
        $query = "'{$folderId}' in parents and trashed=false";
        $results = $this->driveService->files->listFiles([
            'q' => $query,
            'fields' => 'files(id, name, size, createdTime)',
            'orderBy' => 'createdTime desc'
        ]);
        
        $files = $results->getFiles();
        $totalSize = 0;
        foreach ($files as $file) {
            $totalSize += (int)$file->getSize();
        }
        
        return [
            'file_count' => count($files),
            'total_size_bytes' => $totalSize,
            'total_size_gb' => round($totalSize / (1024**3), 2),
            'quota_limit' => $quota->getLimit(),
            'quota_usage' => $quota->getUsage(),
            'quota_limit_gb' => round($quota->getLimit() / (1024**3), 2),
            'quota_usage_gb' => round($quota->getUsage() / (1024**3), 2),
            'quota_free_gb' => round(($quota->getLimit() - $quota->getUsage()) / (1024**3), 2),
            'recent_files' => array_slice($files, 0, 5)
        ];
    }
}
?>
