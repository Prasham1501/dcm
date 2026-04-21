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
        
        if (empty($name) || empty($aeTitle) || empty($host) || $port <= 0) {
            throw new Exception("Invalid input data");
        }
        
        if ($id) {
            // Update
            $stmt = $db->prepare("UPDATE dicom_printers SET name=?, ae_title=?, host_name=?, port=?, description=?, is_active=? WHERE id=?");
            $stmt->bind_param("sssisii", $name, $aeTitle, $host, $port, $description, $isActive, $id);
        } else {
            // Create
            $stmt = $db->prepare("INSERT INTO dicom_printers (name, ae_title, host_name, port, description, is_active) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("sssisi", $name, $aeTitle, $host, $port, $description, $isActive);
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
