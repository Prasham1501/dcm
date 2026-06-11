<?php
/**
 * Machine result ingest for analyzers / external middleware.
 * No user session — API key (Settings -> Integrations). Works local or cloud.
 *
 * POST (JSON) with header `X-API-Key: <key>`:
 *   {
 *     "visit_no": "V000005",            // or "accession_number" / "visit_id"
 *     "results": [ {"parameter":"HBA1C","value":"9.7"}, {"parameter":"WBC","value":"6.2"} ],
 *     "authenticate": false              // optional: mark the test complete
 *   }
 * Parameters are matched by NAME (case-insensitive) against the tests on that visit.
 * Flags (L/N/H) and formula rows (eAG, etc.) are computed automatically.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../includes/ris/RisResults.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }

try {
    $db = getDbConnection();

    // ---- API key ----
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = 'integration_api_key' LIMIT 1");
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $configured = $row ? (string)$row['setting_value'] : '';

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) { $input = $_POST; }
    $provided = (string)($_SERVER['HTTP_X_API_KEY'] ?? $input['api_key'] ?? '');
    if ($configured === '' || $provided === '' || !hash_equals($configured, $provided)) {
        sendErrorResponse('Invalid or missing API key', 401);
    }

    // ---- Resolve visit ----
    $visitId = (int)($input['visit_id'] ?? 0);
    $visitNo = trim((string)($input['visit_no'] ?? ''));
    $accession = trim((string)($input['accession_number'] ?? ''));
    if ($visitId <= 0 && $visitNo !== '') {
        $s = $db->prepare('SELECT id FROM ris_visits WHERE visit_no = ? LIMIT 1');
        $s->bind_param('s', $visitNo); $s->execute();
        $r = $s->get_result()->fetch_assoc(); $s->close();
        $visitId = $r ? (int)$r['id'] : 0;
    }
    if ($visitId <= 0 && $accession !== '') {
        $s = $db->prepare('SELECT visit_id FROM ris_orders WHERE accession_number = ? LIMIT 1');
        $s->bind_param('s', $accession); $s->execute();
        $r = $s->get_result()->fetch_assoc(); $s->close();
        $visitId = $r ? (int)$r['visit_id'] : 0;
    }
    if ($visitId <= 0) { sendErrorResponse('Visit not found (provide visit_no, accession_number, or visit_id)', 404); }

    $results = is_array($input['results'] ?? null) ? $input['results'] : [];
    if (!$results) { sendErrorResponse('results array is required', 400); }

    // ---- Patient context for flagging ----
    $ps = $db->prepare("SELECT p.sex, p.dob, p.age_years, p.age_months, p.age_days FROM ris_visits v JOIN ris_patients p ON p.id = v.patient_id WHERE v.id = ?");
    $ps->bind_param('i', $visitId); $ps->execute();
    $patient = $ps->get_result()->fetch_assoc(); $ps->close();
    $sex = (string)($patient['sex'] ?? '');
    $ageDays = ris_patient_age_days($patient ?: []);

    // ---- Build parameter index across all tests on the visit ----
    $os = $db->prepare("SELECT id, service_id FROM ris_orders WHERE visit_id = ?");
    $os->bind_param('i', $visitId); $os->execute();
    $ores = $os->get_result();
    $orders = [];
    while ($o = $ores->fetch_assoc()) { $orders[(int)$o['id']] = (int)$o['service_id']; }
    $os->close();

    // param-name(lower) -> list of {order_id, param}
    $index = [];
    $paramsByOrder = []; // order_id -> [params]
    foreach ($orders as $orderId => $serviceId) {
        $list = ris_ing_service_parameters($db, $serviceId);
        $paramsByOrder[$orderId] = $list;
        foreach ($list as $p) {
            $index[strtolower($p['name'])][] = ['order_id' => $orderId, 'param' => $p];
        }
    }

    // ---- Apply incoming values ----
    $touchedOrders = [];
    $matched = [];
    $unmatched = [];
    $valuesByOrderName = []; // order_id -> name(lower) -> value (for formula eval)

    $up = $db->prepare(
        "INSERT INTO ris_test_results (order_id, parameter_id, value, flag, entered_by)
         VALUES (?,?,?,?,NULL)
         ON DUPLICATE KEY UPDATE value=VALUES(value), flag=VALUES(flag)"
    );

    foreach ($results as $r) {
        $pname = strtolower(trim((string)($r['parameter'] ?? $r['name'] ?? '')));
        $value = (string)($r['value'] ?? '');
        if ($pname === '' || !isset($index[$pname])) { $unmatched[] = $r['parameter'] ?? $pname; continue; }
        foreach ($index[$pname] as $hit) {
            $orderId = $hit['order_id'];
            $param = $hit['param'];
            if (!empty($param['formula'])) { continue; } // computed later
            $range = ris_resolve_range($param['ranges'] ?? [], $sex, $ageDays);
            $flag = ris_flag($value, $range);
            $pid = (int)$param['id'];
            $up->bind_param('iiss', $orderId, $pid, $value, $flag);
            $up->execute();
            $valuesByOrderName[$orderId][$pname] = $value;
            $touchedOrders[$orderId] = true;
            $matched[] = $param['name'];
        }
    }
    $up->close();

    // ---- Evaluate formula parameters for touched orders ----
    foreach (array_keys($touchedOrders) as $orderId) {
        // seed with already-saved values for this order
        $vs = $db->prepare("SELECT tp.name, tr.value FROM ris_test_results tr JOIN ris_test_parameters tp ON tp.id = tr.parameter_id WHERE tr.order_id = ?");
        $vs->bind_param('i', $orderId); $vs->execute();
        $vr = $vs->get_result();
        $vals = $valuesByOrderName[$orderId] ?? [];
        while ($row2 = $vr->fetch_assoc()) { $vals[strtolower($row2['name'])] = $row2['value']; }
        $vs->close();
        foreach ($paramsByOrder[$orderId] as $p) {
            if (empty($p['formula'])) { continue; }
            $calc = ris_eval_formula((string)$p['formula'], $vals);
            if ($calc !== null) {
                $range = ris_resolve_range($p['ranges'] ?? [], $sex, $ageDays);
                $flag = ris_flag($calc, $range);
                $pid = (int)$p['id'];
                $f2 = $db->prepare("INSERT INTO ris_test_results (order_id, parameter_id, value, flag, entered_by) VALUES (?,?,?,?,NULL) ON DUPLICATE KEY UPDATE value=VALUES(value), flag=VALUES(flag)");
                $f2->bind_param('iiss', $orderId, $pid, $calc, $flag);
                $f2->execute();
                $f2->close();
            }
        }
    }

    // ---- Update order status ----
    $authenticate = !empty($input['authenticate']);
    foreach (array_keys($touchedOrders) as $orderId) {
        if ($authenticate) {
            $db->query("UPDATE ris_orders SET result_status='authenticated', authenticated_at=NOW() WHERE id = " . (int)$orderId . " AND result_status NOT IN ('printed')");
        } else {
            $db->query("UPDATE ris_orders SET result_status='pending' WHERE id = " . (int)$orderId . " AND result_status NOT IN ('authenticated','printed')");
        }
    }

    logMessage("Results ingest: visit $visitId matched " . count($matched), 'info', 'ris.log');
    sendSuccessResponse([
        'visit_id' => $visitId,
        'matched' => array_values(array_unique($matched)),
        'unmatched' => array_values(array_unique($unmatched)),
        'orders_updated' => count($touchedOrders),
    ], 'Results ingested');
} catch (Throwable $e) {
    logMessage('Results ingest error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ris_ing_service_parameters(mysqli $db, int $serviceId): array
{
    $stmt = $db->prepare('SELECT * FROM ris_test_parameters WHERE service_id = ? AND is_active = 1 ORDER BY sort_order, id');
    $stmt->bind_param('i', $serviceId); $stmt->execute();
    $res = $stmt->get_result();
    $params = [];
    while ($row = $res->fetch_assoc()) { $row['ranges'] = []; $params[(int)$row['id']] = $row; }
    $stmt->close();
    if ($params) {
        $ids = implode(',', array_map('intval', array_keys($params)));
        $rres = $db->query("SELECT * FROM ris_test_ref_ranges WHERE parameter_id IN ($ids)");
        while ($r = $rres->fetch_assoc()) { $params[(int)$r['parameter_id']]['ranges'][] = $r; }
    }
    return array_values($params);
}
