<?php
/**
 * Update Report Status
 * POST /api/reports/update-status.php
 * Body: { study_uid, status }
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (CORS_ALLOWED_ORIGINS ?? '*'));
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . (CORS_ALLOWED_HEADERS ?? 'Content-Type, Authorization'));

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    $currentUser = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input', 400);
    }

    // Validate required fields
    if (!isset($input['study_uid']) || empty($input['study_uid'])) {
        sendErrorResponse('Missing required field: study_uid', 400);
    }

    if (!isset($input['status']) || empty($input['status'])) {
        sendErrorResponse('Missing required field: status', 400);
    }

    $study_uid = sanitizeInput($input['study_uid']);
    $status = sanitizeInput($input['status']);

    // Validate status value
    $validStatuses = ['draft', 'final', 'amended', 'printed'];
    if (!in_array($status, $validStatuses)) {
        sendErrorResponse('Invalid status value. Must be one of: ' . implode(', ', $validStatuses), 400);
    }

    $db = getDbConnection();

    // Update the most recent report for this study
    $stmt = $db->prepare("
        UPDATE medical_reports
        SET status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE study_uid = ?
        ORDER BY created_at DESC
        LIMIT 1
    ");

    $stmt->bind_param("ss", $status, $study_uid);

    if (!$stmt->execute()) {
        throw new Exception("Failed to update report status: " . $stmt->error);
    }

    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    if ($affectedRows === 0) {
        sendErrorResponse('No report found for this study', 404);
    }

    logAuditEvent(
        $currentUser['id'],
        'update',
        'medical_report',
        null,
        "Updated report status to '{$status}' for study {$study_uid}"
    );

    sendSuccessResponse([
        'study_uid' => $study_uid,
        'status' => $status
    ], 'Report status updated successfully');

} catch (Exception $e) {
    logMessage("Error updating report status: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to update report status: ' . $e->getMessage(), 500);
}
