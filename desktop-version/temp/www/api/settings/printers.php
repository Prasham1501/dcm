<?php
/**
 * DICOM Printers Management API
 * Handle CRUD operations for DICOM printers
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
    if ($method === 'GET') {
        // List all printers
        $result = $db->query("SELECT * FROM dicom_printers ORDER BY name ASC");
        $printers = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'printers' => $printers]);
    } 
    elseif ($method === 'POST') {
        // Add or Update printer
        $input = json_decode(file_get_contents('php://input'), true);
        
        $id = $input['id'] ?? null;
        $name = $input['name'] ?? '';
        $aeTitle = $input['ae_title'] ?? '';
        $host = $input['host_name'] ?? '';
        $port = intval($input['port'] ?? 0);
        $description = $input['description'] ?? '';
        $isActive = !empty($input['is_active']) ? 1 : 0;
        $isDefault = !empty($input['is_default']) ? 1 : 0;
        
        if (empty($name) || empty($aeTitle) || empty($host) || $port <= 0) {
            throw new Exception("Invalid input data");
        }
        
        // Ensure is_default column exists
        try {
            $db->query("SELECT is_default FROM dicom_printers LIMIT 1");
        } catch (Exception $e) {
            $db->query("ALTER TABLE dicom_printers ADD COLUMN is_default TINYINT(1) DEFAULT 0");
        }

        if ($isDefault) {
            // Unset other defaults
            $db->query("UPDATE dicom_printers SET is_default = 0");
        }
        
        if ($id) {
            // Update
            $stmt = $db->prepare("UPDATE dicom_printers SET name=?, ae_title=?, host_name=?, port=?, description=?, is_active=?, is_default=? WHERE id=?");
            $stmt->bind_param("sssisiii", $name, $aeTitle, $host, $port, $description, $isActive, $isDefault, $id);
        } else {
            // Create
            $stmt = $db->prepare("INSERT INTO dicom_printers (name, ae_title, host_name, port, description, is_active, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssiiii", $name, $aeTitle, $host, $port, $description, $isActive, $isDefault);
        }
        
        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }
        
        echo json_encode(['success' => true, 'message' => 'Printer saved successfully']);
    } 
    elseif ($method === 'DELETE') {
        // Delete printer
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        
        if (!$id) throw new Exception("ID required");
        
        $stmt = $db->prepare("DELETE FROM dicom_printers WHERE id = ?");
        $stmt->bind_param("i", $id);
        
        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }
        
        echo json_encode(['success' => true, 'message' => 'Printer deleted']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
