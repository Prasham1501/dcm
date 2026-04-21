<?php
/**
 * Dropbox Backup Integration
 * Simple token-based authentication for easy backup setup
 */

class DropboxBackup {
    private $accessToken;
    private $backupFolder;
    
    /**
     * Initialize Dropbox backup with access token
     * 
     * @param string $accessToken Dropbox access token
     * @param string $folder Folder path in Dropbox (default: /DICOM_Backups)
     */
    public function __construct($accessToken, $folder = '/DICOM_Backups') {
        $this->accessToken = $accessToken;
        $this->backupFolder = $folder;
    }
    
    /**
     * Upload a file to Dropbox
     * 
     * @param string $localPath Local file path
     * @param string $dropboxPath Path in Dropbox (filename)
     * @return array Result with success status and file info
     */
    public function uploadFile($localPath, $dropboxPath) {
        if (!file_exists($localPath)) {
            throw new Exception("File not found: $localPath");
        }
        
        $fileSize = filesize($localPath);
        $fileName = basename($dropboxPath);
        
        // Ensure path doesn't have double slashes and is properly formatted
        $fullPath = rtrim($this->backupFolder, '/') . '/' . $fileName;
        
        // Read file contents
        $fileContents = file_get_contents($localPath);
        if ($fileContents === false) {
            throw new Exception("Failed to read file: $localPath");
        }
        
        // Prepare API request - Dropbox requires very specific format
        $url = 'https://content.dropboxapi.com/2/files/upload';
        
        // Build the Dropbox-API-Arg JSON (MUST be valid JSON)
        $apiArg = json_encode([
            'path' => $fullPath,
            'mode' => 'add',
            'autorename' => true,
            'mute' => false,
            'strict_conflict' => false
        ], JSON_UNESCAPED_SLASHES);
        
        // Set headers exactly as Dropbox API requires
        $headers = [
            'Authorization: Bearer ' . trim($this->accessToken),
            'Content-Type: application/octet-stream',
            'Dropbox-API-Arg: ' . $apiArg
        ];
        
        // Upload using cURL with proper settings
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContents);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_VERBOSE, false);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        
        curl_close($ch);
        
        // Check for cURL errors first
        if ($curlError) {
            throw new Exception("cURL error: $curlError");
        }
        
        // Check HTTP response code
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            
            // Build detailed error message
            $errorMsg = 'Upload failed';
            if (isset($errorData['error_summary'])) {
                $errorMsg = $errorData['error_summary'];
            } elseif (isset($errorData['error']['.tag'])) {
                $errorMsg = $errorData['error']['.tag'];
            }
            
            // Add response body for debugging
            if ($httpCode == 400) {
                $errorMsg .= " | Response: " . substr($response, 0, 200);
            }
            
            throw new Exception("Dropbox API Error (HTTP $httpCode): $errorMsg");
        }
        
        // Parse successful response
        $result = json_decode($response, true);
        if (!$result) {
            throw new Exception("Invalid JSON response from Dropbox");
        }
        
        return [
            'success' => true,
            'file_id' => $result['id'] ?? '',
            'path' => $result['path_display'] ?? $fullPath,
            'size' => $fileSize,
            'name' => $fileName
        ];
    }
    
    /**
     * List files in the backup folder
     * 
     * @return array List of files
     */
    public function listFiles() {
        $url = 'https://api.dropboxapi.com/2/files/list_folder';
        
        $headers = [
            'Authorization: Bearer ' . $this->accessToken,
            'Content-Type: application/json'
        ];
        
        $data = json_encode([
            'path' => $this->backupFolder,
            'recursive' => false,
            'include_media_info' => false,
            'include_deleted' => false,
            'include_has_explicit_shared_members' => false
        ]);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            // Folder might not exist, return empty array
            return [];
        }
        
        $result = json_decode($response, true);
        return $result['entries'] ?? [];
    }
    
    /**
     * Delete old backups (retention policy)
     * 
     * @param int $keepDays Number of days to keep backups
     * @return int Number of files deleted
     */
    public function deleteOldBackups($keepDays = 30) {
        $files = $this->listFiles();
        $deleted = 0;
        $cutoffTime = time() - ($keepDays * 24 * 60 * 60);
        
        foreach ($files as $file) {
            if ($file['.tag'] !== 'file') continue;
            
            $modifiedTime = strtotime($file['server_modified']);
            if ($modifiedTime < $cutoffTime) {
                try {
                    $this->deleteFile($file['path_display']);
                    $deleted++;
                } catch (Exception $e) {
                    error_log("Failed to delete old backup: " . $e->getMessage());
                }
            }
        }
        
        return $deleted;
    }
    
    /**
     * Delete a file from Dropbox
     * 
     * @param string $path Full path in Dropbox
     */
    private function deleteFile($path) {
        $url = 'https://api.dropboxapi.com/2/files/delete_v2';
        
        $headers = [
            'Authorization: Bearer ' . $this->accessToken,
            'Content-Type: application/json'
        ];
        
        $data = json_encode(['path' => $path]);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        curl_exec($ch);
        curl_close($ch);
    }
    
    /**
     * Test connection to Dropbox
     * 
     * @return bool True if connection is valid
     */
    public function testConnection() {
        $url = 'https://api.dropboxapi.com/2/users/get_current_account';
        
        $headers = [
            'Authorization: Bearer ' . $this->accessToken,
            'Content-Type: application/json'
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'null');
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return $httpCode === 200;
    }
    
    /**
     * Get account information and space usage
     * 
     * @return array Account info
     */
    public function getAccountInfo() {
        $url = 'https://api.dropboxapi.com/2/users/get_space_usage';
        
        $headers = [
            'Authorization: Bearer ' . $this->accessToken,
            'Content-Type: application/json'
        ];
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, 'null');
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        
        return [
            'used' => $data['used'] ?? 0,
            'allocated' => $data['allocation']['allocated'] ?? 0,
            'used_gb' => round(($data['used'] ?? 0) / (1024**3), 2),
            'allocated_gb' => round(($data['allocation']['allocated'] ?? 0) / (1024**3), 2)
        ];
    }
}
?>
