<?php
/**
 * Commission — payouts.
 *   POST { action:'create', doctor_id, from, to } -> create a payout from unpaid entries
 *   POST { action:'pay', payout_id }              -> mark a payout (and its entries) paid
 *   GET  ?doctor_id=<id>                           -> list a doctor's payouts
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCommissionRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    $repo = new RisCommissionRepository($db);
    $user = getCurrentUser();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $doctorId = (int) ($_GET['doctor_id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM ris_commission_payouts WHERE referring_doctor_id = ? ORDER BY id DESC");
        $stmt->bind_param('i', $doctorId);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($r = $res->fetch_assoc()) { $out[] = $r; }
        $stmt->close();
        sendSuccessResponse($out);
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? '';

    if ($action === 'create') {
        $doctorId = (int) ($input['doctor_id'] ?? 0);
        $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['from'] ?? '') ? $input['from'] : date('Y-m-01');
        $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['to'] ?? '') ? $input['to'] : date('Y-m-d');
        if ($doctorId <= 0) { sendErrorResponse('doctor_id is required', 400); }
        $payout = $repo->createPayout($doctorId, $from, $to, (int) $user['id']);
        logAuditEvent($user['id'], 'create', 'ris_commission_payout', $payout['id'], 'Payout for doctor ' . $doctorId);
        sendSuccessResponse($payout, 'Payout created');
    }

    if ($action === 'pay') {
        $payoutId = (int) ($input['payout_id'] ?? 0);
        if ($payoutId <= 0) { sendErrorResponse('payout_id is required', 400); }
        $payout = $repo->markPayoutPaid($payoutId);
        logAuditEvent($user['id'], 'pay', 'ris_commission_payout', $payoutId, 'Marked payout paid');
        sendSuccessResponse($payout, 'Payout marked paid');
    }

    sendErrorResponse('Unknown action: ' . $action, 400);
} catch (Throwable $e) {
    logMessage('Commission payouts error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
