<?php
/**
 * AI Feedback Collection Endpoint
 * POST /ai/feedback.php
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized', 401);
}

$currentUser = getCurrentUser();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Submit feedback
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['analysis_id'])) {
            sendErrorResponse('analysis_id is required', 400);
        }
        
        if (empty($input['feedback_type'])) {
            sendErrorResponse('feedback_type is required', 400);
        }
        
        $analysisId = intval($input['analysis_id']);
        $feedbackType = sanitizeInput($input['feedback_type']);
        $feedbackCategory = sanitizeInput($input['feedback_category'] ?? 'accuracy');
        $originalFinding = $input['original_finding'] ?? null;
        $correctedFinding = $input['corrected_finding'] ?? null;
        $comments = $input['comments'] ?? null;
        $severityRating = isset($input['severity_rating']) ? intval($input['severity_rating']) : null;
        
        // Validate feedback type
        $validTypes = ['thumbs_up', 'thumbs_down', 'correction', 'comment'];
        if (!in_array($feedbackType, $validTypes)) {
            sendErrorResponse('Invalid feedback_type', 400);
        }
        
        $db = getDbConnection();
        
        // Verify analysis exists
        $checkStmt = $db->prepare("SELECT id FROM ai_analysis WHERE id = ?");
        $checkStmt->bind_param("i", $analysisId);
        $checkStmt->execute();
        if ($checkStmt->get_result()->num_rows === 0) {
            $checkStmt->close();
            sendErrorResponse('Analysis not found', 404);
        }
        $checkStmt->close();
        
        // Insert feedback
        $stmt = $db->prepare("
            INSERT INTO ai_feedback (
                analysis_id, feedback_type, feedback_category,
                original_finding, corrected_finding, comments,
                severity_rating, user_id, user_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $userRole = $currentUser['role'] ?? 'user';
        
        $stmt->bind_param(
            "isssssiss",
            $analysisId, $feedbackType, $feedbackCategory,
            $originalFinding, $correctedFinding, $comments,
            $severityRating, $currentUser['id'], $userRole
        );
        
        if ($stmt->execute()) {
            sendSuccessResponse([], 'Feedback submitted successfully');
        } else {
            throw new Exception("Failed to save feedback: " . $stmt->error);
        }
        
        $stmt->close();
        
    } catch (Exception $e) {
        logMessage("Feedback error: " . $e->getMessage(), 'error', 'ai_feedback.log');
        sendErrorResponse('Failed to submit feedback: ' . $e->getMessage(), 500);
    }
} else {
    sendErrorResponse('Method not allowed', 405);
}
?>
