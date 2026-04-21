<?php
/**
 * Mark Study as Read API
 * POST /api/studies/mark-read.php
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['success' => false, 'error' => 'Method not allowed']));
}

$input = json_decode(file_get_contents('php://input'), true);
$orthancId = $input['orthanc_id'] ?? null;

if (!$orthancId) {
    http_response_code(400);
    exit(json_encode(['success' => false, 'error' => 'Missing orthanc_id']));
}

try {
    $db = getDbConnection();
    $stmt = $db->prepare("UPDATE cached_studies SET is_new = 0 WHERE orthanc_id = ?");
    $stmt->bind_param("s", $orthancId);
    $stmt->execute();
    $stmt->close();
    
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
