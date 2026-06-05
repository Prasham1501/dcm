<?php
/**
 * Billing — record a payment (or refund) against a visit.
 * POST { visit_id, amount, mode, reference?, is_refund? } -> { payment, visit }
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisBillingRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int) ($input['visit_id'] ?? 0);
    $amount = (float) ($input['amount'] ?? 0);
    $mode = in_array($input['mode'] ?? '', ['cash', 'upi', 'card', 'other'], true) ? $input['mode'] : 'cash';
    $ref = isset($input['reference']) && $input['reference'] !== '' ? (string) $input['reference'] : null;
    $isRefund = !empty($input['is_refund']);

    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }
    if ($amount <= 0) { sendErrorResponse('amount must be positive', 400); }

    $repo = new RisBillingRepository(getDbConnection(), new RisCounters(getDbConnection()));
    $result = $repo->takePayment($visitId, $amount, $mode, $ref, (int) $user['id'], $isRefund);

    logAuditEvent($user['id'], $isRefund ? 'refund' : 'payment', 'ris_visit', $visitId,
        ($isRefund ? 'Refund ' : 'Payment ') . $amount . ' (' . $mode . ')');
    sendSuccessResponse($result, 'Payment recorded');
} catch (Throwable $e) {
    logMessage('Billing take-payment error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
