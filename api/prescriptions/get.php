<?php
/**
 * Get Prescriptions by Study UID
 * GET /api/prescriptions/get.php?studyUID={studyUID}
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (CORS_ALLOWED_ORIGINS ?? '*'));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . (CORS_ALLOWED_HEADERS ?? 'Content-Type, Authorization'));

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
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

    $stmt = $db->prepare("
        SELECT
            p.*,
            u.full_name AS prescribed_by_name,
            u.username AS prescribed_by_username
        FROM prescriptions p
        LEFT JOIN users u ON p.prescribed_by = u.id
        WHERE p.study_uid = ?
        ORDER BY p.prescribed_at DESC
    ");

    $stmt->bind_param("s", $study_uid);
    $stmt->execute();
    $result = $stmt->get_result();
    $prescriptions = [];

    while ($row = $result->fetch_assoc()) {
        $prescriptions[] = $row;
    }

    $stmt->close();

    logAuditEvent(
        $currentUser['id'],
        'list',
        'prescription',
        null,
        "Retrieved " . count($prescriptions) . " prescription(s) for study {$study_uid}"
    );

    sendSuccessResponse([
        'study_uid' => $study_uid,
        'count' => count($prescriptions),
        'prescriptions' => $prescriptions
    ], 'Prescriptions retrieved successfully');

} catch (Exception $e) {
    logMessage("Error retrieving prescriptions: " . $e->getMessage(), 'error', 'prescriptions.log');
    sendErrorResponse('Failed to retrieve prescriptions: ' . $e->getMessage(), 500);
}
