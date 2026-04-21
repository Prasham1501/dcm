<?php
/**
 * Create Backup API
 * Creates compressed backup and uploads to Google Drive
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
    require_once __DIR__ . '/../../vendor/autoload.php';
    require_once __DIR__ . '/../../includes/classes/BackupManager.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check admin role
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $backupType = $input['type'] ?? 'manual';
    
    $backupManager = new BackupManager();
    $result = $backupManager->createBackup($backupType);
    
    echo json_encode([
        'success' => true,
        'message' => 'Backup created and uploaded successfully',
        'data' => $result
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
