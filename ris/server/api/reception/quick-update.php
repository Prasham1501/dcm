<?php
/**
 * Reception - targeted single/few-field visit patch (safe for row actions).
 * Unlike update-visit.php (which rewrites every column), this only touches the
 * fields provided, and recomputes net/balance/status when money fields change.
 *
 * POST { visit_id, action?: 'cancel', center_name?, consultant_doctor?, ref_no?,
 *        visit_comment?, urgent_report?, misc_charge?, discount? }
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int)($input['visit_id'] ?? 0);
    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }

    $stmt = $db->prepare('SELECT total_amount, misc_charge, discount, home_visit_amount, paid_amount FROM ris_visits WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $visit = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$visit) { sendErrorResponse('Visit not found', 404); }

    // Report lifecycle markers (drive the reception grid status icons).
    $mark = (string)($input['mark'] ?? '');
    if ($mark !== '') {
        $vid = (int)$visitId;
        if ($mark === 'emailed') {
            $db->query("UPDATE ris_orders SET report_emailed_at = NOW() WHERE visit_id = $vid AND report_emailed_at IS NULL");
            $db->query("UPDATE ris_visits SET dispatch_mode='email', dispatch_note=TRIM(CONCAT(COALESCE(dispatch_note,''), IF(COALESCE(dispatch_note,'')='','','\n'),'Report emailed')) WHERE id=$vid");
        } elseif ($mark === 'printed') {
            $db->query("UPDATE ris_orders SET report_printed_at = COALESCE(report_printed_at, NOW()) WHERE visit_id = $vid");
            $db->query("UPDATE ris_visits SET dispatch_note=TRIM(CONCAT(COALESCE(dispatch_note,''), IF(COALESCE(dispatch_note,'')='','','\n'),'Report printed')) WHERE id=$vid");
        } elseif ($mark === 'ready') {
            $db->query("UPDATE ris_orders SET result_status='authenticated', authenticated_at=COALESCE(authenticated_at, NOW()) WHERE visit_id = $vid AND result_status <> 'printed'");
        } elseif ($mark === 'not_ready') {
            $db->query("UPDATE ris_orders SET report_emailed_at=NULL, report_printed_at=NULL, authenticated_at=NULL, result_status='registered' WHERE visit_id = $vid");
            $db->query("UPDATE ris_visits SET dispatch_mode=NULL, dispatch_note=NULL, delivery_destination='patient' WHERE id=$vid");
        } else {
            sendErrorResponse('Unknown mark', 400);
        }
        $r = $db->prepare('SELECT * FROM ris_visits WHERE id = ?');
        $r->bind_param('i', $visitId);
        $r->execute();
        $row = $r->get_result()->fetch_assoc();
        $r->close();
        $user = getCurrentUser();
        logAuditEvent((int)($user['id'] ?? 0), 'update', 'ris_visit', $visitId, 'Mark ' . $mark);
        sendSuccessResponse($row, 'Updated');
    }

    $sets = [];
    $types = '';
    $vals = [];

    // String fields.
    foreach (['center_name', 'consultant_doctor', 'ref_no', 'visit_comment'] as $f) {
        if (array_key_exists($f, $input)) {
            $v = trim((string)$input[$f]);
            $sets[] = "`$f` = ?";
            $types .= 's';
            $vals[] = $v === '' ? null : $v;
        }
    }
    if (array_key_exists('urgent_report', $input)) {
        $sets[] = '`urgent_report` = ?';
        $types .= 'i';
        $vals[] = !empty($input['urgent_report']) ? 1 : 0;
    }

    // Money fields -> recompute net/balance/status.
    $touchMoney = array_key_exists('misc_charge', $input) || array_key_exists('discount', $input);
    if ($touchMoney) {
        $misc = array_key_exists('misc_charge', $input) ? max(0, (float)$input['misc_charge']) : (float)$visit['misc_charge'];
        $discount = array_key_exists('discount', $input) ? max(0, (float)$input['discount']) : (float)$visit['discount'];
        $total = (float)$visit['total_amount'];
        $home = (float)$visit['home_visit_amount'];
        $paid = (float)$visit['paid_amount'];
        $net = max(0, $total + $misc + $home - $discount);
        $balance = max(0, $net - $paid);
        $status = $balance <= 0.001 ? 'paid' : ($paid > 0 ? 'partly_paid' : 'open');
        $sets[] = '`misc_charge` = ?'; $types .= 'd'; $vals[] = $misc;
        $sets[] = '`discount` = ?'; $types .= 'd'; $vals[] = $discount;
        $sets[] = '`net_amount` = ?'; $types .= 'd'; $vals[] = $net;
        $sets[] = '`balance` = ?'; $types .= 'd'; $vals[] = $balance;
        $sets[] = '`status` = ?'; $types .= 's'; $vals[] = $status;
    }

    // Invalidate / cancel.
    if (($input['action'] ?? '') === 'cancel') {
        $sets[] = "`status` = 'cancelled'";
    }

    if (!$sets) { sendErrorResponse('No fields to update', 400); }

    $types .= 'i';
    $vals[] = $visitId;
    $sql = 'UPDATE ris_visits SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $stmt = $db->prepare($sql);
    $refs = [$types];
    foreach ($vals as $k => $v) { $refs[] = &$vals[$k]; }
    call_user_func_array([$stmt, 'bind_param'], $refs);
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare('SELECT * FROM ris_visits WHERE id = ?');
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $updated = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $user = getCurrentUser();
    logAuditEvent((int)($user['id'] ?? 0), 'update', 'ris_visit', $visitId, 'Quick update reception visit');
    sendSuccessResponse($updated, 'Visit updated');
} catch (Throwable $e) {
    logMessage('Reception quick-update API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
