<?php
/**
 * Hospital Selector API
 * Handles hospital switching and listing for users
 */
header('Content-Type: application/json');
define('DICOM_VIEWER', true);
define('API_MODE', true);
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/hospital-access.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// GET - List accessible hospitals
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $hospitals = getAccessibleHospitals();
    $currentHospitalId = getCurrentHospitalId();
    
    echo json_encode([
        'success' => true,
        'hospitals' => $hospitals,
        'current_hospital_id' => $currentHospitalId,
        'current_hospital_name' => $currentHospitalId === null ? 'All Hospitals' : 
            (array_filter($hospitals, fn($h) => $h['id'] == $currentHospitalId)[array_key_first(array_filter($hospitals, fn($h) => $h['id'] == $currentHospitalId))]['hospital_name'] ?? 'Unknown')
    ]);
    exit;
}

// POST - Switch hospital context
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $hospitalId = isset($data['hospital_id']) ? 
        ($data['hospital_id'] === 'all' ? null : (int)$data['hospital_id']) : null;
    
    if (setCurrentHospitalId($hospitalId)) {
        // Clear any cached data
        clearHospitalCache();
        
        echo json_encode([
            'success' => true,
            'message' => 'Hospital context switched successfully',
            'current_hospital_id' => $hospitalId
        ]);
    } else {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Access denied to this hospital'
        ]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
