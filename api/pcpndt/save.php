<?php
/** PCPNDT — save a Form F draft for a study. POST { study_uid, ...fields } */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisPcpndtRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (function_exists('hasRole') && !hasRole(['admin', 'super_admin', 'doctor'])) {
    sendErrorResponse('Forbidden - doctor/admin only', 403);
}

try {
    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $studyUid = trim((string) ($input['study_uid'] ?? ''));
    if ($studyUid === '') { sendErrorResponse('study_uid is required', 400); }
    if (!isset($input['created_by'])) { $input['created_by'] = $user['id']; }

    $saved = (new RisPcpndtRepository(getDbConnection()))->upsertByStudy($studyUid, $input);
    if (function_exists('logAuditEvent')) {
        logAuditEvent($user['id'], 'save', 'pcpndt_form_f', $studyUid, 'Saved PCPNDT Form F');
    }
    sendSuccessResponse($saved, 'Form F saved');
} catch (Throwable $e) {
    logMessage('PCPNDT save error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
