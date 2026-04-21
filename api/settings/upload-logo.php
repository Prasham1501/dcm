<?php
/**
 * Logo Upload API
 * Handles hospital logo upload, retrieval, and deletion
 */
header('Content-Type: application/json');

// Prevent any HTML output before JSON
error_reporting(0);
ini_set('display_errors', 0);

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

try {
    requireLogin();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$uploadDir = __DIR__ . '/../../assets/uploads/logos/';

// Ensure upload directory exists
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Failed to create upload directory']);
        exit;
    }
}

try {
    $db = getDbConnection();
    
    if ($method === 'GET') {
        // Get current logo path
        $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'hospital_logo'");
        $row = $result->fetch_assoc();
        
        echo json_encode([
            'success' => true,
            'logo_path' => $row ? $row['setting_value'] : null
        ]);
    } 
    elseif ($method === 'POST') {
        // Upload new logo
        if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
                UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
                UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
                UPLOAD_ERR_NO_FILE => 'No file was uploaded',
                UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
                UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
                UPLOAD_ERR_EXTENSION => 'Upload blocked by extension'
            ];
            $errorCode = $_FILES['logo']['error'] ?? UPLOAD_ERR_NO_FILE;
            $errorMsg = $errorMessages[$errorCode] ?? 'Unknown upload error';
            
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }
        
        $file = $_FILES['logo'];
        
        // Validate file size (2MB max)
        if ($file['size'] > 2 * 1024 * 1024) {
            echo json_encode(['success' => false, 'error' => 'File too large. Maximum size is 2MB.']);
            exit;
        }
        
        // Validate file type using actual image detection
        $imageInfo = getimagesize($file['tmp_name']);
        if ($imageInfo === false) {
            echo json_encode(['success' => false, 'error' => 'Invalid image file']);
            exit;
        }
        
        $allowedTypes = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF];
        if (!in_array($imageInfo[2], $allowedTypes)) {
            echo json_encode(['success' => false, 'error' => 'Only JPG, PNG, and GIF images are allowed']);
            exit;
        }
        
        // Determine extension
        $extensions = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif'];
        $extension = $extensions[$imageInfo[2]];
        
        // Delete existing logo
        $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'hospital_logo'");
        $existing = $result->fetch_assoc();
        if ($existing && $existing['setting_value']) {
            $existingFile = __DIR__ . '/../../' . $existing['setting_value'];
            if (file_exists($existingFile)) {
                unlink($existingFile);
            }
        }
        
        // Save new logo
        $filename = 'hospital_logo.' . $extension;
        $targetPath = $uploadDir . $filename;
        $relativePath = 'assets/uploads/logos/' . $filename;
        
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            echo json_encode(['success' => false, 'error' => 'Failed to save uploaded file']);
            exit;
        }
        
        // Ensure system_settings table exists
        $db->query("CREATE TABLE IF NOT EXISTS system_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            setting_key VARCHAR(100) UNIQUE NOT NULL,
            setting_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
        
        // Update database
        $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('hospital_logo', ?) 
                             ON DUPLICATE KEY UPDATE setting_value = ?");
        $stmt->bind_param('ss', $relativePath, $relativePath);
        
        if ($stmt->execute()) {
            echo json_encode([
                'success' => true,
                'logo_path' => $relativePath,
                'message' => 'Logo uploaded successfully'
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to save logo path to database']);
        }
        $stmt->close();
    } 
    elseif ($method === 'DELETE') {
        // Delete logo
        $result = $db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'hospital_logo'");
        $row = $result->fetch_assoc();
        
        if ($row && $row['setting_value']) {
            $filePath = __DIR__ . '/../../' . $row['setting_value'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        
        $db->query("DELETE FROM system_settings WHERE setting_key = 'hospital_logo'");
        
        echo json_encode([
            'success' => true,
            'message' => 'Logo removed successfully'
        ]);
    } 
    else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
