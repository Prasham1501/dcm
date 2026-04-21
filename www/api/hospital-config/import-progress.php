<?php
/**
 * Import Progress Tracker API
 * Returns real-time progress of DICOM import
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

// Close session to prevent locking
session_write_close();

try {
    $batchId = $_GET['batch_id'] ?? '';
    
    if (empty($batchId)) {
        throw new Exception("Batch ID required");
    }
    
    // Read progress from temp file
    $progressFile = sys_get_temp_dir() . '/dicom_import_' . $batchId . '.json';
    
    if (!file_exists($progressFile)) {
        echo json_encode([
            'success' => true,
            'status' => 'not_found',
            'progress' => 0,
            'message' => 'Import not started'
        ]);
        exit;
    }
    
    $progressData = json_decode(file_get_contents($progressFile), true);
    
    echo json_encode([
        'success' => true,
        'status' => $progressData['status'] ?? 'unknown',
        'progress' => $progressData['progress'] ?? 0,
        'current' => $progressData['current'] ?? 0,
        'total' => $progressData['total'] ?? 0,
        'message' => $progressData['message'] ?? '',
        'imported_count' => $progressData['imported_count'] ?? 0,
        'error_count' => $progressData['error_count'] ?? 0,
        'current_file' => $progressData['current_file'] ?? ''
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
