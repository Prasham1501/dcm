<?php
/**
 * Auto-Scan Scheduler API
 * Manages automatic folder scanning configuration and scheduling
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
$action = $_GET['action'] ?? '';

try {
    $db = getDbConnection();

    // Ensure auto_scan_config table exists
    $db->query("
        CREATE TABLE IF NOT EXISTS auto_scan_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scan_interval_minutes INT DEFAULT 15,
            auto_import_enabled TINYINT(1) DEFAULT 1,
            last_scan_time DATETIME,
            scan_status ENUM('idle', 'scanning', 'importing') DEFAULT 'idle',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Ensure scan_logs table exists
    $db->query("
        CREATE TABLE IF NOT EXISTS scan_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            scan_type ENUM('auto', 'manual') DEFAULT 'auto',
            folders_found INT DEFAULT 0,
            new_folders INT DEFAULT 0,
            files_imported INT DEFAULT 0,
            scan_duration_seconds INT,
            status ENUM('success', 'error', 'partial') DEFAULT 'success',
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Initialize default config if not exists
    $result = $db->query("SELECT COUNT(*) as count FROM auto_scan_config");
    $row = $result->fetch_assoc();
    if ($row['count'] == 0) {
        $db->query("INSERT INTO auto_scan_config (scan_interval_minutes, auto_import_enabled) VALUES (15, 1)");
    }

    if ($method === 'GET') {
        switch ($action) {
            case 'get_config':
                // Get current configuration
                $result = $db->query("SELECT * FROM auto_scan_config WHERE id = 1");
                $config = $result->fetch_assoc();

                if (!$config) {
                    echo json_encode(['success' => false, 'error' => 'Configuration not found']);
                    exit;
                }

                echo json_encode([
                    'success' => true,
                    'config' => $config
                ]);
                break;

            case 'get_scan_logs':
                // Get recent scan logs
                $limit = intval($_GET['limit'] ?? 50);
                $result = $db->query("SELECT * FROM scan_logs ORDER BY created_at DESC LIMIT $limit");

                $logs = [];
                while ($row = $result->fetch_assoc()) {
                    $logs[] = $row;
                }

                echo json_encode([
                    'success' => true,
                    'logs' => $logs,
                    'total' => count($logs)
                ]);
                break;

            case 'get_status':
                // Get current scan status
                $result = $db->query("SELECT scan_status, last_scan_time, scan_interval_minutes, auto_import_enabled FROM auto_scan_config WHERE id = 1");
                $status = $result->fetch_assoc();

                // Calculate next scan time
                $nextScanTime = null;
                if ($status['last_scan_time'] && $status['auto_import_enabled']) {
                    $lastScan = new DateTime($status['last_scan_time']);
                    $nextScan = clone $lastScan;
                    $nextScan->modify("+{$status['scan_interval_minutes']} minutes");
                    $nextScanTime = $nextScan->format('Y-m-d H:i:s');
                }

                echo json_encode([
                    'success' => true,
                    'status' => $status['scan_status'],
                    'last_scan' => $status['last_scan_time'],
                    'next_scan' => $nextScanTime,
                    'interval_minutes' => $status['scan_interval_minutes'],
                    'auto_import_enabled' => $status['auto_import_enabled'] == 1
                ]);
                break;

            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    }
    elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $postAction = $input['action'] ?? $action;

        switch ($postAction) {
            case 'update_config':
                // Update scan configuration
                $intervalMinutes = intval($input['scan_interval_minutes'] ?? 15);
                $autoImportEnabled = intval($input['auto_import_enabled'] ?? 1);

                // Validate interval (1 min to 1440 min = 24 hours)
                if ($intervalMinutes < 1 || $intervalMinutes > 1440) {
                    echo json_encode(['success' => false, 'error' => 'Interval must be between 1 and 1440 minutes']);
                    exit;
                }

                $stmt = $db->prepare("UPDATE auto_scan_config SET scan_interval_minutes = ?, auto_import_enabled = ? WHERE id = 1");
                $stmt->bind_param('ii', $intervalMinutes, $autoImportEnabled);

                if ($stmt->execute()) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Configuration updated successfully',
                        'interval_minutes' => $intervalMinutes,
                        'auto_import_enabled' => $autoImportEnabled == 1
                    ]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Failed to update configuration']);
                }
                $stmt->close();
                break;

            case 'start_manual_scan':
                // Trigger manual scan
                require_once __DIR__ . '/../../scripts/auto-scanner-service.php';

                $scanner = new AutoScannerService();
                $result = $scanner->runScan('manual');

                echo json_encode([
                    'success' => true,
                    'message' => 'Manual scan completed',
                    'result' => $result
                ]);
                break;

            case 'enable_auto_import':
                // Enable/disable auto import
                $enabled = intval($input['enabled'] ?? 1);

                $stmt = $db->prepare("UPDATE auto_scan_config SET auto_import_enabled = ? WHERE id = 1");
                $stmt->bind_param('i', $enabled);

                if ($stmt->execute()) {
                    echo json_encode([
                        'success' => true,
                        'message' => $enabled ? 'Auto-import enabled' : 'Auto-import disabled',
                        'auto_import_enabled' => $enabled == 1
                    ]);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Failed to update setting']);
                }
                $stmt->close();
                break;

            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    }
    else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
