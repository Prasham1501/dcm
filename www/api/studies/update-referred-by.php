<?php
/**
 * Update Referred By API
 * Updates the referred_by field for a study
 */
header('Content-Type: application/json');

// Prevent any HTML output before JSON
error_reporting(0);
ini_set('display_errors', 0);

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

try {
    requireLogin();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $studyUID = $input['study_uid'] ?? '';
    $referredBy = trim($input['referred_by'] ?? '');
    
    if (empty($studyUID)) {
        echo json_encode(['success' => false, 'error' => 'Study UID is required']);
        exit;
    }
    
    $db = getDbConnection();
    
    // Check if referred_by column exists, add if not
    $columnCheck = $db->query("SHOW COLUMNS FROM cached_studies LIKE 'referred_by'");
    if ($columnCheck->num_rows === 0) {
        $db->query("ALTER TABLE cached_studies ADD COLUMN referred_by VARCHAR(255) DEFAULT NULL");
    }
    
    // Update the referred_by field - use study_instance_uid (the actual column name)
    $stmt = $db->prepare("UPDATE cached_studies SET referred_by = ? WHERE study_instance_uid = ?");
    $stmt->bind_param('ss', $referredBy, $studyUID);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Referred by updated successfully'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to update: ' . $stmt->error]);
    }
    $stmt->close();
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
