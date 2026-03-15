<?php
/**
 * Multi-Provider Backup Manager
 * Supports Google Drive and Dropbox
 */

require_once __DIR__ . '/BackupManager.php';
require_once __DIR__ . '/DropboxBackup.php';

class MultiProviderBackupManager {
    private $db;
    private $backupDir;
    
    public function __construct() {
        $this->db = getDbConnection();
        $this->backupDir = __DIR__ . '/../../backups/temp';
        
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
    }
    
    /**
     * Create and upload backup using specified provider
     * 
     * @param string $provider Either 'google_drive' or 'dropbox'
     * @param string $backupType Either 'manual' or 'scheduled'
     * @return array Result with success status and details
     */
    public function createBackup($provider = 'google_drive', $backupType = 'manual') {
        if ($provider === 'dropbox') {
            return $this->createDropboxBackup($backupType);
        } else {
            // Use existing GoogleDrive backup
            $backupManager = new BackupManager();
            return $backupManager->createBackup($backupType);
        }
    }
    
    /**
     * Create backup and upload to Dropbox
     */
    private function createDropboxBackup($backupType) {
        $timestamp = date('Y-m-d_H-i-s');
        $backupName = "dicom_backup_{$timestamp}";
        $sqlFile = $this->backupDir . "/{$backupName}.sql";
        $zipFile = $this->backupDir . "/{$backupName}.zip";
        
        try {
            // Check ZipArchive
            if (!class_exists('ZipArchive')) {
                throw new Exception("ZipArchive extension not loaded");
            }
            
            // Export database
            $this->exportDatabase($sqlFile);
            
            // Create ZIP
            $zip = new ZipArchive();
            if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new Exception("Cannot create ZIP file");
            }
            
            $zip->addFile($sqlFile, basename($sqlFile));
            
            // Add DICOM files if exist
            $dicomDir = __DIR__ . '/../../dicom_files';
            if (is_dir($dicomDir)) {
                $this->addDirectoryToZip($zip, $dicomDir, 'dicom_files');
            }
            
            $zip->close();
            
            // Get Dropbox  token from temp config
            $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
            $key = 'temp_dropbox_token';
            $stmt->bind_param('s', $key);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
            
            if (!$row) {
                throw new Exception("Dropbox token not configured");
            }
            
            $dropboxToken = $row['config_value'];
            
            // Get folder name
            $stmt = $this->db->prepare("SELECT config_value FROM hospital_data_config WHERE config_key = ?");
            $key = 'temp_dropbox_folder';
            $stmt->bind_param('s', $key);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();
            
            $dropboxFolder = $row ? $row['config_value'] : '/DICOM_Backups';
            
            // Upload to Dropbox
            $dropbox = new DropboxBackup($dropboxToken, $dropboxFolder);
            $uploadResult = $dropbox->uploadFile($zipFile, $backupName . '.zip');
            
            // Save to database
            $backupSize = filesize($zipFile);
            $stmt = $this->db->prepare("
                INSERT INTO backup_history 
                (backup_filename, gdrive_file_id, backup_size_bytes, backup_date, backup_type, status)
                VALUES (?, ?, ?, NOW(), ?, 'success')
            ");
            $filename = $backupName . '.zip';
            $fileId = $uploadResult['file_id'];
            $stmt->bind_param('ssis', $filename, $fileId, $backupSize, $backupType);
            $stmt->execute();
            $backupId = $stmt->insert_id;
            $stmt->close();
            
            // Cleanup
            unlink($sqlFile);
            unlink($zipFile);
            
            return [
                'success' => true,
                'backup_id' => $backupId,
                'filename' => $filename,
                'size' => $backupSize,
                'file_id' => $fileId
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
            $createResult = $this->db->query("SHOW CREATE TABLE `$table`");
            $createRow = $createResult->fetch_array();
            $sql .= "-- Table: $table\n";
            $sql .= "DROP TABLE IF EXISTS `$table`;\n";
            $sql .= $createRow[1] . ";\n\n";
            
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
}
?>
