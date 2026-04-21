<?php
/**
 * Hospital Config API - List Server Directories
 * Allows admin to browse server directories to select DICOM folder
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

// Only admin can access
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

try {
    $path = $_GET['path'] ?? '';
    
    // Default to C: drive on Windows or / on Linux if empty
    if (empty($path)) {
        $path = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'C:/' : '/';
    }
    
    // Normalize path
    $path = str_replace('\\', '/', $path);
    // Remove trailing slash unless it's root
    if (strlen($path) > 1 && substr($path, -1) === '/') {
        $path = substr($path, 0, -1);
    }
    // Ensure Windows drive root has slash (e.g., C:/)
    if (preg_match('/^[A-Za-z]:$/', $path)) {
        $path .= '/';
    }

    if (!is_dir($path)) {
        throw new Exception("Directory not found: $path");
    }

    if (!is_readable($path)) {
        throw new Exception("Directory not readable: $path");
    }

    $items = @scandir($path);
    if ($items === false) {
        throw new Exception("Failed to scan directory");
    }

    $directories = [];
    
    // Add parent directory if not root
    $isRoot = false;
    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        // Check if it's a drive root like C:/
        if (preg_match('/^[A-Za-z]:\/?$/', $path)) {
            $isRoot = true;
        }
    } else {
        if ($path === '/') {
            $isRoot = true;
        }
    }

    if (!$isRoot) {
        $parent = dirname($path);
        // Fix dirname for Windows drive root (dirname('C:/') returns 'C:\' or '.')
        if ($parent === '.' || $parent === '\\') {
            $parent = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'C:/' : '/';
        }
        $directories[] = [
            'name' => '..',
            'path' => $parent,
            'type' => 'parent'
        ];
    }

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $fullPath = $path . ($path === '/' || substr($path, -1) === '/' ? '' : '/') . $item;
        
        if (is_dir($fullPath)) {
            $directories[] = [
                'name' => $item,
                'path' => $fullPath,
                'type' => 'dir'
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'current_path' => $path,
        'directories' => $directories
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
