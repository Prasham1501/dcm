<?php
/**
 * DICOM Nodes Management API
 * Handle CRUD operations for DICOM nodes
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
        // List all nodes
        $result = $db->query("SELECT * FROM dicom_nodes ORDER BY is_default DESC, name ASC");
        $nodes = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode(['success' => true, 'nodes' => $nodes]);
    } 
    elseif ($method === 'POST') {
        // Add or Update node
        $input = json_decode(file_get_contents('php://input'), true);
        
        $id = $input['id'] ?? null;
        $name = $input['name'] ?? '';
        $aeTitle = $input['ae_title'] ?? '';
        $host = $input['host_name'] ?? '';
        $port = intval($input['port'] ?? 0);
        $isDefault = !empty($input['is_default']) ? 1 : 0;
        
        if (empty($name) || empty($aeTitle) || empty($host) || $port <= 0) {
            throw new Exception("Invalid input data");
        }
        
        if ($isDefault) {
            // Unset other defaults
            $db->query("UPDATE dicom_nodes SET is_default = 0");
        }
        
        if ($id) {
            // Update
            $stmt = $db->prepare("UPDATE dicom_nodes SET name=?, ae_title=?, host_name=?, port=?, is_default=? WHERE id=?");
            $stmt->bind_param("sssiis", $name, $aeTitle, $host, $port, $isDefault, $id);
        } else {
            // Create
            $stmt = $db->prepare("INSERT INTO dicom_nodes (name, ae_title, host_name, port, is_default) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("sssii", $name, $aeTitle, $host, $port, $isDefault);
        }
        
        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }
        
        echo json_encode(['success' => true, 'message' => 'Node saved successfully']);
    } 
    elseif ($method === 'DELETE') {
        // Delete node
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        
        if (!$id) throw new Exception("ID required");
        
        $stmt = $db->prepare("DELETE FROM dicom_nodes WHERE id = ?");
        $stmt->bind_param("i", $id);
        
        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }
        
        echo json_encode(['success' => true, 'message' => 'Node deleted']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
