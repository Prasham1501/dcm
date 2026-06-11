<?php
/**
 * Reception - update editable visit details.
 * POST { visit_id, center_name?, consultant_doctor?, sample_collected_at?, ... }
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
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

function ris_visit_bool($value): int {
    return in_array($value, [1, '1', true, 'true', 'on', 'yes'], true) ? 1 : 0;
}

function ris_visit_str($value): ?string {
    $str = trim((string)($value ?? ''));
    return $str === '' ? null : $str;
}

function ris_visit_money($value): float {
    $num = (float)($value ?? 0);
    return is_finite($num) ? max(0, $num) : 0.0;
}

try {
    $db = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int)($input['visit_id'] ?? 0);
    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }

    $allowedDestinations = ['center', 'home', 'patient', 'other'];
    $delivery = ris_visit_str($input['delivery_destination'] ?? null) ?: 'patient';
    if (!in_array($delivery, $allowedDestinations, true)) { $delivery = 'patient'; }

    $center = ris_visit_str($input['center_name'] ?? null);
    $consultant = ris_visit_str($input['consultant_doctor'] ?? null);
    $sampleCollected = ris_visit_str($input['sample_collected_at'] ?? null);
    $refNo = ris_visit_str($input['ref_no'] ?? null);
    $comment = ris_visit_str($input['visit_comment'] ?? null);
    $staff = ris_visit_str($input['phlebotomy_staff'] ?? null);
    $area = ris_visit_str($input['home_visit_area'] ?? null);
    $homeAmount = ris_visit_money($input['home_visit_amount'] ?? 0);
    $homeTime = ris_visit_str($input['home_visit_time'] ?? null);
    $dispatchMode = ris_visit_str($input['dispatch_mode'] ?? null);
    $dispatchNote = ris_visit_str($input['dispatch_note'] ?? null);
    $proName = ris_visit_str($input['pro_name'] ?? null);
    $commission = ris_visit_money($input['commission_amount'] ?? 0);
    $misc = ris_visit_money($input['misc_charge'] ?? 0);
    $discount = ris_visit_money($input['discount'] ?? 0);
    $urgent = ris_visit_bool($input['urgent_report'] ?? 0);
    $regular = ris_visit_bool($input['regular_patient'] ?? 0);
    $homeVisit = ($staff || $area || $homeAmount > 0 || $homeTime) ? 1 : 0;
    $printBarcode = ris_visit_bool($input['print_barcode'] ?? 0);
    $printSrs = ris_visit_bool($input['print_srs'] ?? 0);
    $printReceipt = ris_visit_bool($input['print_receipt'] ?? 0);
    $printBillReceipt = ris_visit_bool($input['print_bill_receipt'] ?? 0);
    $sendToPrinter = ris_visit_bool($input['send_to_printer'] ?? 0);

    $stmt = $db->prepare(
        "SELECT total_amount, paid_amount FROM ris_visits WHERE id = ? LIMIT 1"
    );
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $visit = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$visit) { sendErrorResponse('Visit not found', 404); }

    $total = (float)$visit['total_amount'];
    $paid = (float)$visit['paid_amount'];
    $net = max(0, $total + $misc + $homeAmount - $discount);
    $balance = max(0, $net - $paid);
    $status = $balance <= 0.001 ? 'paid' : ($paid > 0 ? 'partly_paid' : 'open');

    $stmt = $db->prepare(
        "UPDATE ris_visits
         SET center_name = ?, consultant_doctor = ?, sample_collected_at = ?, ref_no = ?,
             urgent_report = ?, visit_comment = ?, phlebotomy_staff = ?, home_visit_area = ?,
             home_visit_amount = ?, home_visit_time = ?, home_visit = ?, dispatch_mode = ?,
             dispatch_note = ?, delivery_destination = ?, pro_name = ?, commission_amount = ?,
             regular_patient = ?, misc_charge = ?, discount = ?, net_amount = ?, balance = ?,
             status = ?, print_barcode = ?, print_srs = ?, print_receipt = ?,
             print_bill_receipt = ?, send_to_printer = ?
         WHERE id = ?"
    );
    $stmt->bind_param(
        'ssssisssdsissssdiddddsiiiiii',
        $center,
        $consultant,
        $sampleCollected,
        $refNo,
        $urgent,
        $comment,
        $staff,
        $area,
        $homeAmount,
        $homeTime,
        $homeVisit,
        $dispatchMode,
        $dispatchNote,
        $delivery,
        $proName,
        $commission,
        $regular,
        $misc,
        $discount,
        $net,
        $balance,
        $status,
        $printBarcode,
        $printSrs,
        $printReceipt,
        $printBillReceipt,
        $sendToPrinter,
        $visitId
    );
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare('SELECT * FROM ris_visits WHERE id = ?');
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $updated = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    logAuditEvent((int)(getCurrentUser()['id'] ?? 0), 'update', 'ris_visit', $visitId, 'Updated reception visit details');
    sendSuccessResponse($updated, 'Visit updated');
} catch (Throwable $e) {
    logMessage('Reception update visit API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
