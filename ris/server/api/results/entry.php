<?php
/**
 * Lab result entry sheet.
 *   GET  ?visit_id=<id> | ?visit_no=<no>   -> patient + visit + orders(+parameters+results) + prev/next
 *   GET  ?trend=1&patient_id=&parameter_id= -> [{visit_date, value}] numeric history
 *   POST { action:'save', order_id, results:[{parameter_id,value}], remark?, advice?, note? }
 *   POST { action:'status', order_id, status: pending|complete|authenticated|printed }
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisResults.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = (string)($input['action'] ?? 'save');
        $orderId = (int)($input['order_id'] ?? 0);
        if ($orderId <= 0) { sendErrorResponse('order_id is required', 400); }
        $user = getCurrentUser();

        if ($action === 'status') {
            $status = (string)($input['status'] ?? '');
            if (!in_array($status, ['registered', 'pending', 'complete', 'authenticated', 'printed'], true)) {
                sendErrorResponse('Invalid status', 400);
            }
            if ($status === 'authenticated') {
                $stmt = $db->prepare("UPDATE ris_orders SET result_status='authenticated', authenticated_by=?, authenticated_at=NOW() WHERE id=?");
                $uid = (int)$user['id'];
                $stmt->bind_param('ii', $uid, $orderId);
            } elseif ($status === 'printed') {
                $stmt = $db->prepare("UPDATE ris_orders SET result_status='printed', report_printed_at=NOW() WHERE id=?");
                $stmt->bind_param('i', $orderId);
            } else {
                $stmt = $db->prepare('UPDATE ris_orders SET result_status=? WHERE id=?');
                $stmt->bind_param('si', $status, $orderId);
            }
            $stmt->execute();
            $stmt->close();
            logAuditEvent((int)$user['id'], 'update', 'ris_order', $orderId, 'Result status -> ' . $status);
            sendSuccessResponse(['order_id' => $orderId, 'result_status' => $status], 'Status updated');
        }

        // action = save
        $results = is_array($input['results'] ?? null) ? $input['results'] : [];
        $remark = trim((string)($input['remark'] ?? ''));
        $advice = trim((string)($input['advice'] ?? ''));
        $note = trim((string)($input['note'] ?? ''));

        // Patient sex/age for flagging.
        $ctx = ris_order_context($db, $orderId);
        if (!$ctx) { sendErrorResponse('Order not found', 404); }
        $sex = (string)($ctx['sex'] ?? '');
        $ageDays = ris_patient_age_days($ctx);

        // Load parameters (with ranges + formulas) for this order's service.
        $params = ris_service_parameters($db, (int)$ctx['service_id']);
        $byId = [];
        foreach ($params as $p) { $byId[(int)$p['id']] = $p; }

        // Collect entered values (name-keyed for formula evaluation).
        $valuesByName = [];
        $valuesById = [];
        foreach ($results as $r) {
            $pid = (int)($r['parameter_id'] ?? 0);
            if (!isset($byId[$pid])) { continue; }
            $val = (string)($r['value'] ?? '');
            $valuesById[$pid] = $val;
            $valuesByName[strtolower((string)$byId[$pid]['name'])] = $val;
        }

        // Evaluate formula parameters (e.g. eAG) ONLY when left blank, so a manual override is kept.
        foreach ($params as $p) {
            $pid = (int)$p['id'];
            if (!empty($p['formula'])) {
                $existing = isset($valuesById[$pid]) ? trim((string)$valuesById[$pid]) : '';
                if ($existing !== '') { continue; }
                $calc = ris_eval_formula((string)$p['formula'], $valuesByName);
                if ($calc !== null) {
                    $valuesById[$pid] = $calc;
                    $valuesByName[strtolower((string)$p['name'])] = $calc;
                }
            }
        }

        // Upsert each value with computed flag.
        $up = $db->prepare(
            "INSERT INTO ris_test_results (order_id, parameter_id, value, flag, entered_by)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE value=VALUES(value), flag=VALUES(flag), entered_by=VALUES(entered_by)"
        );
        $uid = (int)$user['id'];
        foreach ($valuesById as $pid => $val) {
            $range = ris_resolve_range($byId[$pid]['ranges'] ?? [], $sex, $ageDays);
            $flag = ris_flag($val, $range);
            $up->bind_param('iissi', $orderId, $pid, $val, $flag, $uid);
            $up->execute();
        }
        $up->close();

        $stmt = $db->prepare("UPDATE ris_orders SET result_remark=?, result_advice=?, result_note=?, result_status=IF(result_status IN ('authenticated','printed'), result_status, 'pending') WHERE id=?");
        $stmt->bind_param('sssi', $remark, $advice, $note, $orderId);
        $stmt->execute();
        $stmt->close();

        logAuditEvent((int)$user['id'], 'update', 'ris_order', $orderId, 'Saved results');
        sendSuccessResponse(ris_order_sheet($db, $orderId), 'Results saved');
    }

    // GET trend
    if (!empty($_GET['trend'])) {
        $patientId = (int)($_GET['patient_id'] ?? 0);
        $parameterId = (int)($_GET['parameter_id'] ?? 0);
        if ($patientId <= 0 || $parameterId <= 0) { sendErrorResponse('patient_id and parameter_id required', 400); }
        $stmt = $db->prepare(
            "SELECT v.visit_datetime AS visit_date, tr.value, tr.flag
             FROM ris_test_results tr
             JOIN ris_orders o ON o.id = tr.order_id
             JOIN ris_visits v ON v.id = o.visit_id
             WHERE o.patient_id = ? AND tr.parameter_id = ? AND tr.value <> ''
             ORDER BY v.visit_datetime"
        );
        $stmt->bind_param('ii', $patientId, $parameterId);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($row = $res->fetch_assoc()) { $out[] = $row; }
        $stmt->close();
        sendSuccessResponse($out);
    }

    // GET sheet
    $visitId = (int)($_GET['visit_id'] ?? 0);
    $visitNo = trim((string)($_GET['visit_no'] ?? ''));
    if ($visitId <= 0 && $visitNo !== '') {
        $stmt = $db->prepare('SELECT id FROM ris_visits WHERE visit_no = ? LIMIT 1');
        $stmt->bind_param('s', $visitNo);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $visitId = $row ? (int)$row['id'] : 0;
    }
    if ($visitId <= 0) { sendErrorResponse('Visit not found', 404); }

    sendSuccessResponse(ris_visit_sheet($db, $visitId));
} catch (Throwable $e) {
    logMessage('RIS result entry error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ris_order_context(mysqli $db, int $orderId): ?array
{
    $stmt = $db->prepare(
        "SELECT o.id, o.service_id, p.sex, p.dob, p.age_years, p.age_months, p.age_days
         FROM ris_orders o JOIN ris_patients p ON p.id = o.patient_id WHERE o.id = ?"
    );
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function ris_service_parameters(mysqli $db, int $serviceId): array
{
    $stmt = $db->prepare('SELECT * FROM ris_test_parameters WHERE service_id = ? AND is_active = 1 ORDER BY sort_order, id');
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $res = $stmt->get_result();
    $params = [];
    while ($row = $res->fetch_assoc()) { $row['ranges'] = []; $params[(int)$row['id']] = $row; }
    $stmt->close();
    if ($params) {
        $ids = implode(',', array_map('intval', array_keys($params)));
        $rres = $db->query("SELECT * FROM ris_test_ref_ranges WHERE parameter_id IN ($ids) ORDER BY id");
        while ($r = $rres->fetch_assoc()) { $params[(int)$r['parameter_id']]['ranges'][] = $r; }
    }
    return array_values($params);
}

function ris_order_sheet(mysqli $db, int $orderId): array
{
    $stmt = $db->prepare('SELECT visit_id FROM ris_orders WHERE id = ?');
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return ris_visit_sheet($db, (int)($row['visit_id'] ?? 0));
}

function ris_visit_sheet(mysqli $db, int $visitId): array
{
    $stmt = $db->prepare(
        "SELECT v.*, p.id AS patient_id, p.mrn, p.full_name, p.name_prefix, p.sex, p.age_years, p.age_months, p.age_days, p.dob, p.phone,
                rd.name AS doctor_name
         FROM ris_visits v JOIN ris_patients p ON p.id = v.patient_id
         LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
         WHERE v.id = ?"
    );
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $visit = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$visit) { return ['visit' => null, 'orders' => []]; }

    $patientId = (int)$visit['patient_id'];
    $sex = (string)($visit['sex'] ?? '');
    $ageDays = ris_patient_age_days($visit);

    // Orders for this visit.
    $ostmt = $db->prepare(
        "SELECT o.id, o.service_id, o.accession_number, o.price, o.result_status,
                o.result_remark, o.result_advice, o.result_note, o.authenticated_at, o.report_printed_at, o.report_emailed_at,
                s.name AS service_name, s.lab_name
         FROM ris_orders o LEFT JOIN ris_services s ON s.id = o.service_id
         WHERE o.visit_id = ? ORDER BY o.id"
    );
    $ostmt->bind_param('i', $visitId);
    $ostmt->execute();
    $ores = $ostmt->get_result();
    $orders = [];
    while ($o = $ores->fetch_assoc()) { $orders[] = $o; }
    $ostmt->close();

    foreach ($orders as &$o) {
        $params = ris_service_parameters($db, (int)$o['service_id']);
        // saved values for this order
        $vals = [];
        $vstmt = $db->prepare('SELECT parameter_id, value, flag FROM ris_test_results WHERE order_id = ?');
        $oid = (int)$o['id'];
        $vstmt->bind_param('i', $oid);
        $vstmt->execute();
        $vres = $vstmt->get_result();
        while ($vr = $vres->fetch_assoc()) { $vals[(int)$vr['parameter_id']] = $vr; }
        $vstmt->close();

        foreach ($params as &$p) {
            $range = ris_resolve_range($p['ranges'] ?? [], $sex, $ageDays);
            $p['resolved_range'] = $range;
            $p['range_text'] = ris_range_text($range);
            $saved = $vals[(int)$p['id']] ?? null;
            $p['value'] = $saved['value'] ?? '';
            $p['flag'] = $saved['flag'] ?? '';
        }
        unset($p);
        $o['parameters'] = $params;
    }
    unset($o);

    // prev/next visit (same patient, by datetime).
    $nav = ['prev_visit_id' => null, 'next_visit_id' => null];
    $nstmt = $db->prepare('SELECT id, visit_datetime FROM ris_visits WHERE patient_id = ? ORDER BY visit_datetime, id');
    $nstmt->bind_param('i', $patientId);
    $nstmt->execute();
    $nres = $nstmt->get_result();
    $ids = [];
    while ($n = $nres->fetch_assoc()) { $ids[] = (int)$n['id']; }
    $nstmt->close();
    $pos = array_search($visitId, $ids, true);
    if ($pos !== false) {
        if ($pos > 0) { $nav['prev_visit_id'] = $ids[$pos - 1]; }
        if ($pos < count($ids) - 1) { $nav['next_visit_id'] = $ids[$pos + 1]; }
    }

    return ['visit' => $visit, 'orders' => $orders, 'nav' => $nav];
}

function ris_range_text(?array $range): string
{
    if (!$range) { return ''; }
    if (!empty($range['normal_text'])) { return (string)$range['normal_text']; }
    $low = $range['low'];
    $high = $range['high'];
    if ($low !== null && $high !== null) { return rtrim(rtrim((string)(float)$low, '0'), '.') . ' - ' . rtrim(rtrim((string)(float)$high, '0'), '.'); }
    if ($high !== null) { return '< ' . rtrim(rtrim((string)(float)$high, '0'), '.'); }
    if ($low !== null) { return '> ' . rtrim(rtrim((string)(float)$low, '0'), '.'); }
    return '';
}
