<?php
/**
 * Clinic Settings API
 * Manages clinic location configuration and multi-clinic mode
 */
header('Content-Type: application/json');
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../auth/session.php';

// Check if logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Only admins can modify settings (using 'role' not 'user_role')
if (($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied - Admin role required']);
    exit;
}

$mysqli = getDbConnection();

// GET - Retrieve clinic settings
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $settings = [];
    
    $keys = ['clinic_location_name', 'multi_clinic_mode', 'clinic_locations_list'];
    $placeholders = str_repeat('?,', count($keys) - 1) . '?';
    
    $stmt = $mysqli->prepare("SELECT setting_key, setting_value FROM hospital_settings WHERE setting_key IN ($placeholders)");
    $stmt->bind_param(str_repeat('s', count($keys)), ...$keys);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        if ($row['setting_key'] === 'multi_clinic_mode') {
            $settings[$row['setting_key']] = $row['setting_value'] === 'true';
        } else if ($row['setting_key'] === 'clinic_locations_list') {
            $settings[$row['setting_key']] = json_decode($row['setting_value'], true) ?: [];
        } else {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }
    $stmt->close();
    
    echo json_encode(['success' => true, 'settings' => $settings]);
    exit;
}

// POST - Update clinic settings
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }
    
    $mysqli->begin_transaction();
    
    try {
        // Update clinic location name
        if (isset($data['clinic_location_name'])) {
            $stmt = $mysqli->prepare("
                INSERT INTO hospital_settings (setting_key, setting_value, setting_group) 
                VALUES ('clinic_location_name', ?, 'clinic')
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->bind_param("s", $data['clinic_location_name']);
            $stmt->execute();
            $stmt->close();
        }
        
        // Update multi-clinic mode
        if (isset($data['multi_clinic_mode'])) {
            $value = $data['multi_clinic_mode'] ? 'true' : 'false';
            $stmt = $mysqli->prepare("
                INSERT INTO hospital_settings (setting_key, setting_value, setting_group) 
                VALUES ('multi_clinic_mode', ?, 'clinic')
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->bind_param("s", $value);
            $stmt->execute();
            $stmt->close();
        }
        
        // Update clinic locations list
        if (isset($data['clinic_locations_list'])) {
            $locationsJson = json_encode($data['clinic_locations_list']);
            $stmt = $mysqli->prepare("
                INSERT INTO hospital_settings (setting_key, setting_value, setting_group) 
                VALUES ('clinic_locations_list', ?, 'clinic')
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->bind_param("s", $locationsJson);
            $stmt->execute();
            $stmt->close();
        }
        
        $mysqli->commit();
        
        echo json_encode(['success' => true, 'message' => 'Clinic settings updated successfully']);
        
    } catch (Exception $e) {
        $mysqli->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update settings: ' . $e->getMessage()]);
    }
    
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
