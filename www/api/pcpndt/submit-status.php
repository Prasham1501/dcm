<?php
/** PCPNDT — record print/submission status. POST { study_uid, status, portal_ack_no?, pdf_path? } */
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
    sendErrorResponse('Forbidden', 403);
}

try {
    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $studyUid = trim((string) ($input['study_uid'] ?? ''));
    $status = $input['status'] ?? '';
    if ($studyUid === '') { sendErrorResponse('study_uid is required', 400); }
    if (!in_array($status, ['draft', 'generated', 'printed', 'submitted', 'failed'], true)) {
        sendErrorResponse('invalid status', 400);
    }
    $ack = isset($input['portal_ack_no']) && $input['portal_ack_no'] !== '' ? (string) $input['portal_ack_no'] : null;
    $pdf = isset($input['pdf_path']) && $input['pdf_path'] !== '' ? (string) $input['pdf_path'] : null;

    $row = (new RisPcpndtRepository(getDbConnection()))->setStatusByStudy($studyUid, $status, $ack, (int) $user['id'], $pdf);
    if (function_exists('logAuditEvent')) {
        logAuditEvent($user['id'], 'status', 'pcpndt_form_f', $studyUid, "Form F status=$status" . ($ack ? " ack=$ack" : ''));
    }
    sendSuccessResponse($row, 'Status updated');
} catch (Throwable $e) {
    logMessage('PCPNDT submit-status error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
