<?php
/**
 * Hospital Join API
 * Allows users to join a hospital using its access code
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['hospital_code']) || empty(trim($data['hospital_code']))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Hospital code is required']);
    exit;
}

$hospitalCode = trim($data['hospital_code']);
$userId = $_SESSION['user_id'];
$mysqli = getDbConnection();

try {
    // Find hospital by code
    $stmt = $mysqli->prepare("SELECT id, hospital_name, is_active FROM hospitals WHERE hospital_code = ?");
    $stmt->bind_param("s", $hospitalCode);
    $stmt->execute();
    $hospital = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    if (!$hospital) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Invalid hospital code']);
        exit;
    }
    
    if (!$hospital['is_active']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'This hospital is currently inactive']);
        exit;
    }
    
    // Check if user already has access
    $checkStmt = $mysqli->prepare("SELECT id FROM user_hospital_access WHERE user_id = ? AND hospital_id = ?");
    $checkStmt->bind_param("ii", $userId, $hospital['id']);
    $checkStmt->execute();
    
    if ($checkStmt->get_result()->fetch_assoc()) {
        $checkStmt->close();
        echo json_encode([
            'success' => true,
            'message' => 'You already have access to this hospital',
            'hospital' => [
                'id' => $hospital['id'],
                'name' => $hospital['hospital_name']
            ]
        ]);
        exit;
    }
    $checkStmt->close();
    
    // Grant read_only access by default
    $accessLevel = 'read_only';
    
    // Doctors and radiologists get higher default access
    $userRole = $_SESSION['role'] ?? 'technician';
    if (in_array($userRole, ['doctor', 'radiologist'])) {
        $accessLevel = 'admin'; // Can view and edit data
    }
    if ($userRole === 'admin') {
        $accessLevel = 'owner'; // Full control
    }
    
    $stmt = $mysqli->prepare("
        INSERT INTO user_hospital_access (user_id, hospital_id, access_level)
        VALUES (?, ?, ?)
    ");
    $stmt->bind_param("iis", $userId, $hospital['id'], $accessLevel);
    
    if ($stmt->execute()) {
        // Clear cache
        clearHospitalCache();
        
        echo json_encode([
            'success' => true,
            'message' => "Successfully joined {$hospital['hospital_name']} as $accessLevel",
            'hospital' => [
                'id' => $hospital['id'],
                'name' => $hospital['hospital_name']
            ],
            'access_level' => $accessLevel
        ]);
    } else {
        throw new Exception($stmt->error);
    }
    $stmt->close();
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to join hospital: ' . $e->getMessage()]);
}
