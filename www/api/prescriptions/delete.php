<?php
/**
 * Delete Prescriptions by Study UID
 * DELETE /api/prescriptions/delete.php?studyUID={studyUID}
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (CORS_ALLOWED_ORIGINS ?? '*'));
header('Access-Control-Allow-Methods: DELETE, OPTIONS');
header('Access-Control-Allow-Headers: ' . (CORS_ALLOWED_HEADERS ?? 'Content-Type, Authorization'));

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    sendErrorResponse('Method not allowed', 405);
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    $currentUser = getCurrentUser();

    if (!isset($_GET['studyUID']) || empty($_GET['studyUID'])) {
        sendErrorResponse('Missing required parameter: studyUID', 400);
    }

    $study_uid = sanitizeInput($_GET['studyUID']);
    $db = getDbConnection();

    // Delete all prescriptions for this study
    $stmt = $db->prepare("DELETE FROM prescriptions WHERE study_uid = ?");
    $stmt->bind_param("s", $study_uid);

    if (!$stmt->execute()) {
        throw new Exception("Failed to delete prescriptions: " . $stmt->error);
    }

    $deletedCount = $stmt->affected_rows;
    $stmt->close();

    logAuditEvent(
        $currentUser['id'],
        'delete',
        'prescription',
        null,
        "Deleted {$deletedCount} prescription(s) for study {$study_uid}"
    );

    sendSuccessResponse([
        'study_uid' => $study_uid,
        'deleted_count' => $deletedCount
    ], 'Prescriptions deleted successfully');

} catch (Exception $e) {
    logMessage("Error deleting prescriptions: " . $e->getMessage(), 'error', 'prescriptions.log');
    sendErrorResponse('Failed to delete prescriptions: ' . $e->getMessage(), 500);
}
