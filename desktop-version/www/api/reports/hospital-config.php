<?php
/**
 * Get Hospital Configuration for Reports
 * Returns hospital name, address, logo, and other settings for report headers
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    $db = getDbConnection();
    
    // Get hospital-related settings
    $query = "SELECT setting_key, setting_value FROM system_settings 
              WHERE setting_key IN (
                  'hospital_name', 'hospital_address', 'hospital_phone', 
                  'hospital_email', 'hospital_logo', 'hospital_website',
                  'hospital_registration', 'doctor_name', 'doctor_qualification',
                  'doctor_registration', 'report_footer', 'report_header_text'
              )";
    
    $result = $db->query($query);
    
    $config = [
        'hospital_name' => 'Medical Imaging Center',
        'hospital_address' => '',
        'hospital_phone' => '',
        'hospital_email' => '',
        'hospital_logo' => '',
        'hospital_website' => '',
        'hospital_registration' => '',
        'doctor_name' => '',
        'doctor_qualification' => '',
        'doctor_registration' => '',
        'report_footer' => 'This report is generated using AI-assisted analysis and should be verified by the reporting physician.',
        'report_header_text' => ''
    ];
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $config[$row['setting_key']] = $row['setting_value'];
        }
        $result->free();
    }
    
    // Get current user info for reporting physician
    $userId = $_SESSION['user_id'] ?? null;
    if ($userId) {
        $userQuery = $db->prepare("SELECT full_name, email, role FROM users WHERE id = ?");
        $userQuery->bind_param("i", $userId);
        $userQuery->execute();
        $userResult = $userQuery->get_result();
        if ($userRow = $userResult->fetch_assoc()) {
            $config['current_user'] = [
                'name' => $userRow['full_name'],
                'email' => $userRow['email'],
                'role' => $userRow['role']
            ];
        }
        $userQuery->close();
    }
    
    echo json_encode([
        'success' => true,
        'data' => $config
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
