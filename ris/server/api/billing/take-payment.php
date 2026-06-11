<?php
/**
 * Billing — record a payment (or refund) against a visit.
 * POST { visit_id, amount, mode, reference?, payer_name?, payer_relation?,
 *        payer_mobile?, notes?, is_refund? } -> { payment, visit }
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisBillingRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

ob_start();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
    if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
    if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int) ($input['visit_id'] ?? 0);
    $amount = (float) ($input['amount'] ?? 0);
    $mode = in_array($input['mode'] ?? '', ['cash', 'upi', 'card', 'other'], true) ? $input['mode'] : 'cash';
    $ref = isset($input['reference']) && $input['reference'] !== '' ? (string) $input['reference'] : null;
    $payerName = isset($input['payer_name']) && $input['payer_name'] !== '' ? (string) $input['payer_name'] : null;
    $payerRelation = isset($input['payer_relation']) && $input['payer_relation'] !== '' ? (string) $input['payer_relation'] : null;
    $payerMobile = isset($input['payer_mobile']) && $input['payer_mobile'] !== '' ? (string) $input['payer_mobile'] : null;
    $notes = isset($input['notes']) && $input['notes'] !== '' ? (string) $input['notes'] : null;
    $isRefund = !empty($input['is_refund']);

    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }
    if ($amount <= 0) { sendErrorResponse('amount must be positive', 400); }

    $repo = new RisBillingRepository(getDbConnection(), new RisCounters(getDbConnection()));
    $result = $repo->takePayment($visitId, $amount, $mode, $ref, (int) $user['id'], $isRefund, [
        'payer_name' => $payerName,
        'payer_relation' => $payerRelation,
        'payer_mobile' => $payerMobile,
        'notes' => $notes,
    ]);

    logAuditEvent($user['id'], $isRefund ? 'refund' : 'payment', 'ris_visit', $visitId,
        ($isRefund ? 'Refund ' : 'Payment ') . $amount . ' (' . $mode . ')');
    if (ob_get_length()) { ob_clean(); }
    sendSuccessResponse($result, 'Payment recorded');
} catch (Throwable $e) {
    logMessage('Billing take-payment error: ' . $e->getMessage(), 'error', 'ris.log');
    if (ob_get_length()) { ob_clean(); }
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
