<?php
/**
 * Get Schedule Info API
 * Returns next backup time and schedule status
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

try {
    $db = getDbConnection();
    
    $result = $db->query("SELECT * FROM backup_schedule_config LIMIT 1");
    $config = $result->fetch_assoc();
    
    if ($config) {
        echo json_encode([
            'success' => true,
            'schedule_enabled' => $config['schedule_enabled'] == 1,
            'interval_hours' => $config['interval_hours'],
            'next_backup_time' => $config['next_backup_time'],
            'last_run_time' => $config['last_run_time']
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Schedule not configured']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
