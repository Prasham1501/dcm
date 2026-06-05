<?php
/**
 * Worklist — order status transition.
 * POST { order_id, action: 'claim'|'report'|'deliver', report_id? }
 *   claim  : acquired      -> in_progress   (doctor/admin)
 *   report : in_progress   -> reported      (doctor/admin)
 *   deliver: reported      -> delivered     (doctor/admin/receptionist)
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisOrderWorkflow.php';
require_once __DIR__ . '/../../includes/ris/RisCommissionRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }

try {
    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = (int) ($input['order_id'] ?? 0);
    $action = (string) ($input['action'] ?? '');
    if ($orderId <= 0) { sendErrorResponse('order_id is required', 400); }

    $wf = new RisOrderWorkflow(getDbConnection());

    switch ($action) {
        case 'claim':
            if (!hasRole(['admin', 'super_admin', 'doctor'])) { sendErrorResponse('Forbidden', 403); }
            $ok = $wf->claim($orderId, (int) $user['id']);
            break;
        case 'report':
            if (!hasRole(['admin', 'super_admin', 'doctor'])) { sendErrorResponse('Forbidden', 403); }
            $reportId = isset($input['report_id']) && $input['report_id'] !== '' ? (int) $input['report_id'] : null;
            $ok = $wf->markReported($orderId, $reportId, (int) $user['id']);
            // Accrue referring-doctor commission when the study is reported (best-effort, idempotent).
            if ($ok) {
                try { (new RisCommissionRepository(getDbConnection()))->accrueForOrder($orderId); }
                catch (Throwable $ce) { logMessage('Commission accrue (report) failed: ' . $ce->getMessage(), 'warning', 'ris.log'); }
            }
            break;
        case 'deliver':
            if (!hasRole(['admin', 'super_admin', 'doctor', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }
            $ok = $wf->markDelivered($orderId, (int) $user['id']);
            break;
        default:
            sendErrorResponse('Unknown action: ' . $action, 400);
    }

    if (!$ok) {
        sendErrorResponse('Invalid transition for the order\'s current status', 409);
    }
    logAuditEvent($user['id'], $action, 'ris_order', $orderId, "Worklist action '$action' on order $orderId");
    sendSuccessResponse(['order_id' => $orderId, 'action' => $action]);
} catch (Throwable $e) {
    logMessage('Worklist transition error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
