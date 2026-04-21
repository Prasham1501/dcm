<?php
/**
 * Update Backup Schedule API
 * Updates backup schedule configuration
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
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

// Check admin
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $intervalHours = (int)($input['interval_hours'] ?? 6);
    $enabled = (int)($input['enabled'] ?? 1);
    
    $db = getDbConnection();
    
    // Calculate next backup time
    $nextBackupTime = date('Y-m-d H:i:s', strtotime("+{$intervalHours} hours"));
    
    // Update schedule configuration
    $stmt = $db->prepare("
        UPDATE backup_schedule_config 
        SET schedule_enabled = ?, interval_hours = ?, next_backup_time = ?
        WHERE id = 1
    ");
    $stmt->bind_param('iis', $enabled, $intervalHours, $nextBackupTime);
    $stmt->execute();
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => 'Schedule updated successfully',
        'next_backup_time' => $nextBackupTime
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
