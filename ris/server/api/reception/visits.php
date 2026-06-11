<?php
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $db = getDbConnection();
    $from = trim((string)($_GET['from'] ?? date('Y-m-d')));
    $to = trim((string)($_GET['to'] ?? $from));
    $fromDateTime = $from . ' 00:00:00';
    $toDateTime = date('Y-m-d H:i:s', strtotime($to . ' +1 day'));
    $where = ["v.visit_datetime >= ? AND v.visit_datetime < ?"];
    $types = 'ss';
    $vals = [$fromDateTime, $toDateTime];

    $map = [
        'center' => 'v.center_name',
        'status' => 'v.status',
        'doctor' => 'rd.name',
        'consultant' => 'v.consultant_doctor',
        'group' => 's.family',
        'dept' => 's.department',
        'test' => 's.name',
        'ref_no' => 'v.ref_no',
    ];
    foreach ($map as $key => $column) {
        $value = trim((string)($_GET[$key] ?? ''));
        if ($value !== '' && strtolower($value) !== 'all') {
            $where[] = "$column LIKE ?";
            $types .= 's';
            $vals[] = '%' . $value . '%';
        }
    }

    $patient = trim((string)($_GET['patient'] ?? ''));
    if ($patient !== '') {
        $where[] = "(p.full_name LIKE ? OR p.phone LIKE ? OR p.mrn LIKE ?)";
        $types .= 'sss';
        $vals[] = '%' . $patient . '%';
        $vals[] = '%' . $patient . '%';
        $vals[] = '%' . $patient . '%';
    }

    if (!empty($_GET['outstanding'])) {
        $where[] = "v.balance > 0";
    }

    $whereSql = implode(' AND ', $where);

    $sql = "
        SELECT
            v.id, v.visit_no, v.visit_datetime, v.center_name, v.total_amount, v.misc_charge,
            v.discount, v.net_amount, v.paid_amount, v.balance, v.status, v.consultant_doctor,
            v.ref_no, v.urgent_report, v.visit_comment, v.dispatch_mode, v.dispatch_note,
            v.delivery_destination, v.print_barcode, v.print_srs, v.print_receipt,
            v.print_bill_receipt, v.send_to_printer,
            p.id AS patient_id, p.mrn, p.full_name, p.phone, p.age_years, p.sex, p.patient_group,
            rd.name AS doctor_name,
            COALESCE(u.full_name, u.username) AS user_name,
            (SELECT COALESCE(SUM(rp.amount), 0) FROM ris_payments rp WHERE rp.visit_id = v.id AND rp.is_refund = 1) AS refund_total,
            MAX(o.report_emailed_at) AS report_emailed_at,
            MAX(o.report_printed_at) AS report_printed_at,
            COUNT(DISTINCT o.id) AS order_count,
            COUNT(DISTINCT CASE WHEN o.result_status IN ('authenticated','printed') THEN o.id END) AS results_ready_count,
            GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS test_names,
            GROUP_CONCAT(DISTINCT s.department ORDER BY s.department SEPARATOR ', ') AS departments,
            GROUP_CONCAT(DISTINCT s.family ORDER BY s.family SEPARATOR ', ') AS groups
        FROM ris_visits v
        JOIN ris_patients p ON p.id = v.patient_id
        LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
        LEFT JOIN users u ON u.id = v.created_by
        LEFT JOIN ris_orders o ON o.visit_id = v.id
        LEFT JOIN ris_services s ON s.id = o.service_id
        WHERE $whereSql
        GROUP BY v.id
        ORDER BY v.urgent_report DESC, v.visit_datetime DESC, v.id DESC
        LIMIT ? OFFSET ?";

    // Pagination.
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = min(200, max(10, (int)($_GET['page_size'] ?? 50)));
    $offset = ($page - 1) * $pageSize;

    $rowsTypes = $types . 'ii';
    $rowsVals = array_merge($vals, [$pageSize, $offset]);
    $stmt = $db->prepare($sql);
    $bindArgs = [$rowsTypes];
    foreach ($rowsVals as $key => $value) {
        $bindArgs[] = &$rowsVals[$key];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindArgs);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = $row;
    }
    $stmt->close();

    // Totals over the full filtered set (per-visit aggregation, then summed).
    $totalsSql = "
        SELECT
            COUNT(*) AS records,
            COALESCE(SUM(total_amount), 0) AS total,
            COALESCE(SUM(misc_charge), 0) AS others,
            COALESCE(SUM(discount), 0) AS discount,
            COALESCE(SUM(net_amount), 0) AS net,
            COALESCE(SUM(paid_amount), 0) AS paid,
            COALESCE(SUM(balance), 0) AS balance,
            COALESCE(SUM(refund_total), 0) AS refund
        FROM (
            SELECT v.id, v.total_amount, v.misc_charge, v.discount, v.net_amount, v.paid_amount, v.balance,
                (SELECT COALESCE(SUM(rp.amount), 0) FROM ris_payments rp WHERE rp.visit_id = v.id AND rp.is_refund = 1) AS refund_total
            FROM ris_visits v
            JOIN ris_patients p ON p.id = v.patient_id
            LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
            LEFT JOIN ris_orders o ON o.visit_id = v.id
            LEFT JOIN ris_services s ON s.id = o.service_id
            WHERE $whereSql
            GROUP BY v.id
        ) t";
    $tstmt = $db->prepare($totalsSql);
    $tbind = [$types];
    foreach ($vals as $key => $value) {
        $tbind[] = &$vals[$key];
    }
    call_user_func_array([$tstmt, 'bind_param'], $tbind);
    $tstmt->execute();
    $totals = $tstmt->get_result()->fetch_assoc() ?: [];
    $tstmt->close();

    sendSuccessResponse(['rows' => $rows, 'totals' => $totals, 'page' => $page, 'page_size' => $pageSize]);
} catch (Throwable $e) {
    logMessage('Reception visits API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
