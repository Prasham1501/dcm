<?php
/**
 * Setup Progress API
 * Save and retrieve onboarding progress
 */
define('DICOM_VIEWER', true);

header('Content-Type: application/json');

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $step = intval($input['step'] ?? 1);
    
    // Get current completed steps
    $result = $db->query("SELECT completed_steps FROM onboarding_progress WHERE id = 1");
    $progress = $result->fetch_assoc();
    $completedSteps = json_decode($progress['completed_steps'] ?? '[]', true);
    
    // Add current step if not already completed
    if (!in_array($step - 1, $completedSteps) && $step > 1) {
        $completedSteps[] = $step - 1;
    }
    
    $completedJson = json_encode(array_values(array_unique($completedSteps)));
    
    $stmt = $db->prepare("
        UPDATE onboarding_progress SET 
            current_step = ?,
            completed_steps = ?
        WHERE id = 1
    ");
    $stmt->bind_param("is", $step, $completedJson);
    $stmt->execute();
    $stmt->close();
    
    echo json_encode(['success' => true, 'step' => $step]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $db->query("SELECT * FROM onboarding_progress WHERE id = 1");
    $progress = $result->fetch_assoc();
    
    echo json_encode([
        'success' => true,
        'progress' => $progress
    ]);
}
