<?php
/**
 * Monthly center invoicing (credit/debit centers).
 *   GET  ?period=YYYY-MM            -> per-center aggregates for the month (+ existing invoice)
 *   GET  ?print=1&invoice_id=<id>   -> printable monthly statement
 *   POST { action:'generate', center_id, period }   -> snapshot a final invoice
 *   POST { action:'pay', invoice_id, amount }        -> record a center payment
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) {
    if (($_GET['print'] ?? '') === '1') { http_response_code(401); echo 'Unauthorized'; exit; }
    sendErrorResponse('Unauthorized - Please log in', 401);
}
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

function ci_valid_period(string $p): bool { return (bool)preg_match('/^\d{4}-\d{2}$/', $p); }

try {
    $db = getDbConnection();

    // ---- Printable statement ----
    if (($_GET['print'] ?? '') === '1') {
        ci_render_statement($db, (int)($_GET['invoice_id'] ?? 0));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        header('Content-Type: application/json');
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = (string)($input['action'] ?? '');
        $user = getCurrentUser();

        if ($action === 'generate') {
            $centerId = (int)($input['center_id'] ?? 0);
            $period = (string)($input['period'] ?? '');
            if ($centerId <= 0 || !ci_valid_period($period)) { sendErrorResponse('center_id and period (YYYY-MM) required', 400); }
            $agg = ci_aggregate($db, $centerId, $period);
            $stmt = $db->prepare(
                "INSERT INTO ris_center_invoices (center_id, period, total, discount, net, paid_amount, visit_count, status, generated_by)
                 VALUES (?,?,?,?,?,0,?,'final',?)
                 ON DUPLICATE KEY UPDATE total=VALUES(total), discount=VALUES(discount), net=VALUES(net),
                    visit_count=VALUES(visit_count), status='final', generated_by=VALUES(generated_by)"
            );
            $uid = (int)$user['id'];
            $stmt->bind_param('isdddii', $centerId, $period, $agg['total'], $agg['discount'], $agg['net'], $agg['visit_count'], $uid);
            $stmt->execute();
            $stmt->close();
            logAuditEvent($uid, 'create', 'ris_center_invoice', $centerId, "Center invoice $period");
            sendSuccessResponse(ci_period_rows($db, $period), 'Invoice generated');
        }

        if ($action === 'pay') {
            $invoiceId = (int)($input['invoice_id'] ?? 0);
            $amount = max(0, (float)($input['amount'] ?? 0));
            if ($invoiceId <= 0 || $amount <= 0) { sendErrorResponse('invoice_id and positive amount required', 400); }
            $db->query("UPDATE ris_center_invoices SET paid_amount = paid_amount + $amount,
                        status = IF(paid_amount + $amount >= net, 'paid', status) WHERE id = " . (int)$invoiceId);
            $r = $db->query("SELECT period FROM ris_center_invoices WHERE id = " . (int)$invoiceId);
            $row = $r ? $r->fetch_assoc() : null;
            logAuditEvent((int)$user['id'], 'payment', 'ris_center_invoice', $invoiceId, "Center payment $amount");
            sendSuccessResponse(ci_period_rows($db, $row['period'] ?? ''), 'Payment recorded');
        }

        sendErrorResponse('Unknown action', 400);
    }

    // ---- GET period rows ----
    header('Content-Type: application/json');
    $period = (string)($_GET['period'] ?? date('Y-m'));
    if (!ci_valid_period($period)) { sendErrorResponse('period must be YYYY-MM', 400); }
    sendSuccessResponse(ci_period_rows($db, $period));
} catch (Throwable $e) {
    logMessage('Center invoices error: ' . $e->getMessage(), 'error', 'ris.log');
    if (($_GET['print'] ?? '') === '1') { http_response_code(500); echo 'Server error'; exit; }
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ci_aggregate(mysqli $db, int $centerId, string $period): array
{
    $stmt = $db->prepare(
        "SELECT COUNT(v.id) AS visit_count,
                COALESCE(SUM(v.total_amount + v.misc_charge),0) AS total,
                COALESCE(SUM(v.discount),0) AS discount,
                COALESCE(SUM(v.net_amount),0) AS net,
                COALESCE(SUM(v.paid_amount),0) AS paid,
                COALESCE(SUM(v.balance),0) AS balance
         FROM ris_centers c
         JOIN ris_visits v ON (v.center_id = c.id OR v.center_name = c.name)
            AND DATE_FORMAT(v.visit_datetime,'%Y-%m') = ?
            AND v.status <> 'cancelled'
         WHERE c.id = ?"
    );
    $stmt->bind_param('si', $period, $centerId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: ['visit_count' => 0, 'total' => 0, 'discount' => 0, 'net' => 0, 'paid' => 0, 'balance' => 0];
}

function ci_period_rows(mysqli $db, string $period): array
{
    $stmt = $db->prepare(
        "SELECT c.id AS center_id, c.name AS center_name, c.billing_type,
                COUNT(v.id) AS visit_count,
                COALESCE(SUM(v.total_amount + v.misc_charge),0) AS total,
                COALESCE(SUM(v.discount),0) AS discount,
                COALESCE(SUM(v.net_amount),0) AS net,
                COALESCE(SUM(v.paid_amount),0) AS paid,
                COALESCE(SUM(v.balance),0) AS balance,
                ci.id AS invoice_id, ci.status AS invoice_status, ci.paid_amount AS invoice_paid, ci.net AS invoice_net
         FROM ris_centers c
         LEFT JOIN ris_visits v ON (v.center_id = c.id OR v.center_name = c.name)
            AND DATE_FORMAT(v.visit_datetime,'%Y-%m') = ?
            AND v.status <> 'cancelled'
         LEFT JOIN ris_center_invoices ci ON ci.center_id = c.id AND ci.period = ?
         WHERE c.is_active = 1
         GROUP BY c.id
         ORDER BY c.billing_type, c.name"
    );
    $stmt->bind_param('ss', $period, $period);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) { $row['period'] = $period; $rows[] = $row; }
    $stmt->close();
    return $rows;
}

function ci_h($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

function ci_render_statement(mysqli $db, int $invoiceId): void
{
    $stmt = $db->prepare(
        "SELECT ci.*, c.name AS center_name, c.billing_type, c.address, c.phone
         FROM ris_center_invoices ci JOIN ris_centers c ON c.id = ci.center_id WHERE ci.id = ?"
    );
    $stmt->bind_param('i', $invoiceId);
    $stmt->execute();
    $inv = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$inv) { http_response_code(404); echo 'Invoice not found'; exit; }

    $period = (string)$inv['period'];
    $centerId = (int)$inv['center_id'];
    $vstmt = $db->prepare(
        "SELECT v.visit_no, v.visit_datetime, v.net_amount, p.full_name
         FROM ris_visits v JOIN ris_patients p ON p.id = v.patient_id
         JOIN ris_centers c ON c.id = ?
         WHERE (v.center_id = c.id OR v.center_name = c.name)
           AND DATE_FORMAT(v.visit_datetime,'%Y-%m') = ? AND v.status <> 'cancelled'
         ORDER BY v.visit_datetime DESC, v.id DESC"
    );
    $vstmt->bind_param('is', $centerId, $period);
    $vstmt->execute();
    $vres = $vstmt->get_result();
    $rows = '';
    while ($v = $vres->fetch_assoc()) {
        $visitDate = $v['visit_datetime'] ? date('d/m/y/H/i', strtotime((string)$v['visit_datetime'])) : '-';
        $rows .= '<tr><td>' . ci_h($v['visit_no']) . '</td><td>' . ci_h($visitDate) . '</td><td>' . ci_h($v['full_name']) . '</td><td class="num">Rs ' . number_format((float)$v['net_amount'], 2) . '</td></tr>';
    }
    $vstmt->close();

    $brandStmt = $db->query("SELECT setting_value FROM hospital_settings WHERE setting_key='brand_name' LIMIT 1");
    $brand = $brandStmt && ($b = $brandStmt->fetch_assoc()) ? $b['setting_value'] : 'One Clickz Imaging';

    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Center statement ' . ci_h($period) . '</title>
<style>body{font-family:Arial,sans-serif;margin:0;background:#f5f5f5;color:#171717}.page{width:760px;margin:20px auto;background:#fff;border:1px solid #ddd;padding:24px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #dc2626;padding-bottom:10px}.brand{font-size:20px;font-weight:800;color:#dc2626}.muted{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:7px;text-align:left}th{background:#fafafa;font-size:11px;text-transform:uppercase}.num{text-align:right}.totals{margin-left:auto;width:320px;margin-top:12px}@media print{body{background:#fff}.page{border:0;margin:0;width:auto}.noprint{display:none}}</style>
</head><body><div class="page">
<div class="top"><div><div class="brand">' . ci_h($brand) . '</div><div class="muted">Monthly center statement</div></div>
<div class="muted" style="text-align:right"><b>' . ci_h($inv['center_name']) . '</b><br>' . ci_h($inv['billing_type']) . ' center<br>Period: ' . ci_h($period) . '</div></div>
<table><thead><tr><th>Reg No</th><th>Date</th><th>Patient</th><th class="num">Amount</th></tr></thead><tbody>' . ($rows ?: '<tr><td colspan="4" class="muted">No visits</td></tr>') . '</tbody></table>
<table class="totals"><tr><td>Total</td><td class="num">Rs ' . number_format((float)$inv['total'], 2) . '</td></tr>
<tr><td>Discount</td><td class="num">Rs ' . number_format((float)$inv['discount'], 2) . '</td></tr>
<tr><th>Net payable</th><th class="num">Rs ' . number_format((float)$inv['net'], 2) . '</th></tr>
<tr><td>Paid by center</td><td class="num">Rs ' . number_format((float)$inv['paid_amount'], 2) . '</td></tr>
<tr><td>Balance</td><td class="num">Rs ' . number_format((float)$inv['net'] - (float)$inv['paid_amount'], 2) . '</td></tr></table>
<p class="noprint" style="text-align:center"><button onclick="window.print()">Print statement</button></p>
</div></body></html>';
    exit;
}
