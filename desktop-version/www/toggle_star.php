<?php
/**
 * Toggle Star Status for DICOM Files
 * Updates the is_starred field in the database
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/auth/session.php';

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Get input from the frontend
$input = json_decode(file_get_contents('php://input'), true);
$fileId = $input['id'] ?? '';
$isStarred = isset($input['is_starred']) ? (int)$input['is_starred'] : 0;
$type = $input['type'] ?? 'file'; // 'file' or 'study'

if (empty($fileId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'ID is required']);
    exit;
}

// Validate isStarred is either 0 or 1
if ($isStarred !== 0 && $isStarred !== 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid starred status provided']);
    exit;
}

try {
    $mysqli = getDbConnection();
    
    if ($type === 'study') {
        // Update cached_studies table
        $stmt = $mysqli->prepare("UPDATE cached_studies SET is_starred = ? WHERE study_instance_uid = ?");
        if (!$stmt) {
            throw new Exception('Database statement preparation failed: ' . $mysqli->error);
        }
        $stmt->bind_param("is", $isStarred, $fileId);
    } else {
        // Update dicom_files table (default)
        $stmt = $mysqli->prepare("UPDATE dicom_files SET is_starred = ? WHERE id = ?");
        if (!$stmt) {
            throw new Exception('Database statement preparation failed: ' . $mysqli->error);
        }
        $stmt->bind_param("is", $isStarred, $fileId);
    }

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Star status updated.']);
    } else {
        throw new Exception('Database query execution failed: ' . $stmt->error);
    }

    $stmt->close();

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
