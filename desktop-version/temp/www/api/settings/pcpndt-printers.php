<?php
/**
 * PCPNDT Printers API
 * CRUD operations for PCPNDT (Form F) printers
 */
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

if (!isLoggedIn() || !isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$db = getDbConnection();

// Check if Private Settings 2FA is enabled and verified
$stmt = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'private_settings_2fa_enabled' LIMIT 1");
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();
$is2FAEnabled = ($row && $row['setting_value'] === '1');
$stmt->close();

if ($is2FAEnabled) {
    // Check if session is verified
    $verified = isset($_SESSION['private_settings_2fa_verified']) && 
                $_SESSION['private_settings_2fa_verified'] === true &&
                isset($_SESSION['private_settings_2fa_time']) &&
                (time() - $_SESSION['private_settings_2fa_time']) < 900;
                
    if (!$verified) {
         http_response_code(403);
         echo json_encode(['success' => false, 'error' => '2FA verification required']);
         exit;
    }
}

try {
    // Create table if not exists
    $db->query("CREATE TABLE IF NOT EXISTS pcpndt_printers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        printer_name VARCHAR(255) NOT NULL,
        paper_size VARCHAR(10) DEFAULT 'A5',
        color_mode VARCHAR(20) DEFAULT 'color',
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");

    switch ($method) {
        case 'GET':
            // List all PCPNDT printers
            $result = $db->query("SELECT * FROM pcpndt_printers ORDER BY is_default DESC, printer_name ASC");
            $printers = [];
            if ($result) {
                while ($row = $result->fetch_assoc()) {
                    $printers[] = $row;
                }
            }
            echo json_encode(['success' => true, 'printers' => $printers]);
            break;

        case 'POST':
            // Add or update PCPNDT printer
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['printer_name'])) {
                echo json_encode(['success' => false, 'error' => 'Printer name is required']);
                exit;
            }

            // If setting as default, unset other defaults first
            if (!empty($input['is_default'])) {
                $db->query("UPDATE pcpndt_printers SET is_default = 0");
            }

            if (!empty($input['id'])) {
                // Update
                $stmt = $db->prepare("UPDATE pcpndt_printers SET printer_name = ?, paper_size = ?, color_mode = ?, is_default = ? WHERE id = ?");
                if (!$stmt) {
                    throw new Exception('Prepare failed: ' . $db->error);
                }
                $isDefault = !empty($input['is_default']) ? 1 : 0;
                $stmt->bind_param('sssii', 
                    $input['printer_name'],
                    $input['paper_size'],
                    $input['color_mode'],
                    $isDefault,
                    $input['id']
                );
                $stmt->execute();
                echo json_encode(['success' => true, 'message' => 'Printer updated']);
            } else {
                // Insert
                $stmt = $db->prepare("INSERT INTO pcpndt_printers (printer_name, paper_size, color_mode, is_default) VALUES (?, ?, ?, ?)");
                if (!$stmt) {
                    throw new Exception('Prepare failed: ' . $db->error);
                }
                $isDefault = !empty($input['is_default']) ? 1 : 0;
                $stmt->bind_param('sssi',
                    $input['printer_name'],
                    $input['paper_size'],
                    $input['color_mode'],
                    $isDefault
                );
                $stmt->execute();
                echo json_encode(['success' => true, 'message' => 'Printer added', 'id' => $stmt->insert_id]);
            }
            break;

        case 'DELETE':
            // Delete PCPNDT printer
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (empty($input['id'])) {
                echo json_encode(['success' => false, 'error' => 'Printer ID is required']);
                exit;
            }

            $stmt = $db->prepare("DELETE FROM pcpndt_printers WHERE id = ?");
            if (!$stmt) {
                throw new Exception('Prepare failed: ' . $db->error);
            }
            $stmt->bind_param('i', $input['id']);
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Printer deleted']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
