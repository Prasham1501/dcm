<?php
/**
 * Hospital Config API - Scan Directory for DICOM Files
 */
// Ensure no output before headers
error_reporting(0);
ini_set('display_errors', 0);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

try {
    // Include session management
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

// Clear buffer and set header
ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $directory = $input['directory'] ?? '';
    $recursive = $input['recursive'] ?? true;
    
    if (empty($directory)) {
        throw new Exception("Directory path is required");
    }
    
    if (!is_dir($directory)) {
        throw new Exception("Directory does not exist: $directory");
    }
    
    // Scan for DICOM files
    $files = [];
    scanDicomFiles($directory, $files, $recursive);
    
    echo json_encode([
        'success' => true,
        'count' => count($files),
        'files' => $files
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Scan directory for DICOM files
 */
function scanDicomFiles($dir, &$files, $recursive = true) {
    $items = @scandir($dir);
    if ($items === false) return;
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        
        if (is_dir($path) && $recursive) {
            scanDicomFiles($path, $files, $recursive);
        } elseif (is_file($path)) {
            // Simple DICOM detection
            $handle = @fopen($path, 'rb');
            if ($handle) {
                fseek($handle, 128);
                $marker = fread($handle, 4);
                fclose($handle);
                
                if ($marker === 'DICM' || strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'dcm') {
                    $files[] = [
                        'path' => $path,
                        'name' => basename($path),
                        'size' => filesize($path)
                    ];
                }
            }
        }
    }
}
