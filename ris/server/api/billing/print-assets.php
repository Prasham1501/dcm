<?php
/**
 * Printable reception assets: barcode labels, SRS, and bill receipt.
 * GET ?visit_id=<id>&type=barcode|srs|bill_receipt
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/barcode.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { http_response_code(401); echo 'Unauthorized'; exit; }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { http_response_code(403); echo 'Forbidden'; exit; }

try {
    $db = getDbConnection();
    $visitId = (int)($_GET['visit_id'] ?? 0);
    $type = (string)($_GET['type'] ?? 'barcode');
    if ($visitId <= 0) { throw new RuntimeException('visit_id is required'); }
    if (!in_array($type, ['barcode', 'srs', 'bill_receipt'], true)) { throw new RuntimeException('Invalid print type'); }

    $visit = ris_print_visit($db, $visitId);
    if (!$visit) { throw new RuntimeException('Visit not found'); }
    $orders = ris_print_orders($db, $visitId);
    $payments = ris_print_payments($db, $visitId);

    header('Content-Type: text/html; charset=utf-8');
    if ($type === 'barcode') {
        ris_render_barcode_labels($db, $visit, $orders);
    } elseif ($type === 'srs') {
        ris_render_srs($visit, $orders);
    } else {
        ris_render_bill_receipt($visit, $orders, $payments);
    }
} catch (Throwable $e) {
    logMessage('Billing print asset error: ' . $e->getMessage(), 'error', 'ris.log');
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Server error: ' . $e->getMessage();
}

function ris_h($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function ris_print_visit(mysqli $db, int $visitId): ?array
{
    $stmt = $db->prepare(
        "SELECT v.*, p.mrn, p.full_name, p.phone, p.sex, p.age_years,
                rd.name AS doctor_name
         FROM ris_visits v
         JOIN ris_patients p ON p.id = v.patient_id
         LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
         WHERE v.id = ?"
    );
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function ris_print_orders(mysqli $db, int $visitId): array
{
    $stmt = $db->prepare(
        "SELECT o.*, s.name AS service_name, s.sample_type, s.tube_type, s.tube_count, s.barcode_label_count
         FROM ris_orders o
         LEFT JOIN ris_services s ON s.id = o.service_id
         WHERE o.visit_id = ? ORDER BY o.id"
    );
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) { $rows[] = $row; }
    $stmt->close();
    return $rows;
}

function ris_print_payments(mysqli $db, int $visitId): array
{
    $stmt = $db->prepare("SELECT * FROM ris_payments WHERE visit_id = ? ORDER BY id");
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) { $rows[] = $row; }
    $stmt->close();
    return $rows;
}

function ris_setting(mysqli $db, string $key, string $default = ''): string
{
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = ? LIMIT 1");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $val = $row ? (string)$row['setting_value'] : '';
    return $val !== '' ? $val : $default;
}

/**
 * Barcode payload that the reception grid "Scan code" box can resolve back to a
 * registration. We encode the visit/Reg No so any tube label scans to the patient.
 */
function ris_barcode_payload(array $visit, array $order): string
{
    return (string)$visit['visit_no'];
}

function ris_print_css(string $width = '760px'): string
{
    return '<style>
body{font-family:Arial,sans-serif;margin:0;background:#f4f4f5;color:#171717}.page{width:' . $width . ';margin:20px auto;background:white;border:1px solid #ddd;padding:18px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #dc2626;padding-bottom:10px;margin-bottom:12px}.brand{font-size:20px;font-weight:800;color:#dc2626}.muted{color:#666;font-size:12px}.strong{font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #ddd;padding:9px}.label{font-size:10px;text-transform:uppercase;color:#666;font-weight:700}.value{font-size:13px;font-weight:700;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #ddd;padding:7px;text-align:left}th{background:#fafafa;font-size:11px;text-transform:uppercase}.num{text-align:right}.noprint{text-align:center}.barcode{display:block;height:54px;width:100%;fill:#000}.label-card{break-inside:avoid;border:1px dashed #999;display:inline-block;margin:6px;padding:8px;width:260px}.label-card .name{font-size:13px;font-weight:800}.label-card .code{font-family:Consolas,monospace;font-size:10px;margin-top:4px}.label-card .small{font-size:10px;color:#444;margin-top:3px}@media print{body{background:white}.page{border:0;margin:0 auto;width:auto}.noprint{display:none}.label-card{margin:4px}}
</style>';
}

function ris_render_barcode_labels(mysqli $db, array $visit, array $orders): void
{
    // Label-roll dimensions are configurable (Settings → printing); default 50x25 mm.
    $labelW = max(20, (int)ris_setting($db, 'barcode_label_width_mm', '50'));
    $labelH = max(12, (int)ris_setting($db, 'barcode_label_height_mm', '25'));
    $dateStr = $visit['visit_datetime'] ? date('d-m-Y', strtotime((string)$visit['visit_datetime'])) : date('d-m-Y');

    $css = '<style>
@page{size:' . $labelW . 'mm ' . $labelH . 'mm;margin:0}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#000}
.label{width:' . $labelW . 'mm;height:' . $labelH . 'mm;padding:1.5mm 2mm;page-break-after:always;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.label:last-child{page-break-after:auto}
.lname{font-size:10pt;font-weight:800;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lsub{font-size:6.5pt;color:#222;line-height:1.05}
.barcode{display:block;width:100%;height:9mm;fill:#000}
.lbot{display:flex;justify-content:space-between;align-items:flex-end;font-family:Consolas,monospace}
.lcode{font-size:6.5pt}
.ldate{font-size:7.5pt;font-weight:700}
.screenwrap{padding:14px;background:#f4f4f5}
.screenwrap .label{border:1px dashed #bbb;margin:0 auto 8px}
.noprint{text-align:center}
@media print{.screenwrap{padding:0;background:#fff}.screenwrap .label{border:0;margin:0}.noprint{display:none}}
</style>';

    echo '<!doctype html><html><head><meta charset="utf-8"><title>Barcode ' . ris_h($visit['visit_no']) . '</title>' . $css . '</head><body><div class="screenwrap">';
    foreach ($orders as $order) {
        $count = max(1, (int)($order['barcode_label_count'] ?? 1));
        $payload = ris_barcode_payload($visit, $order);
        for ($i = 0; $i < $count; $i++) {
            echo '<div class="label">'
                . '<div><div class="lname">' . ris_h($visit['full_name']) . '</div>'
                . '<div class="lsub">' . ris_h((string)$visit['age_years']) . ($visit['sex'] ? ris_h(strtoupper(substr((string)$visit['sex'], 0, 1))) : '')
                . ' &middot; ' . ris_h($order['service_name'] ?: 'Sample') . ($order['tube_type'] ? ' &middot; ' . ris_h($order['tube_type']) : '') . '</div></div>'
                . ris_code128_svg($payload, 60)
                . '<div class="lbot"><span class="lcode">' . ris_h($payload) . '</span><span class="ldate">' . ris_h($dateStr) . '</span></div>'
                . '</div>';
        }
    }
    echo '<p class="noprint"><button onclick="window.print()">Print barcode</button></p></div></body></html>';
    exit;
}

function ris_render_srs(array $visit, array $orders): void
{
    $rows = '';
    foreach ($orders as $order) {
        $rows .= '<tr><td>' . ris_h($order['accession_number']) . '</td><td>' . ris_h($order['service_name'] ?: '-') . '</td><td>' . ris_h($order['sample_type'] ?: '-') . '</td><td>' . ris_h($order['tube_type'] ?: '-') . '</td><td>' . ris_h((string)($order['tube_count'] ?: 1)) . '</td></tr>';
    }
    echo '<!doctype html><html><head><meta charset="utf-8"><title>SRS ' . ris_h($visit['visit_no']) . '</title>' . ris_print_css() . '</head><body><div class="page"><div class="top"><div><div class="brand">Sample Receipt Slip</div><div class="muted">' . ris_h($visit['visit_no']) . '</div></div><div class="muted">' . ris_h($visit['visit_datetime']) . '</div></div><div class="grid"><div class="box"><div class="label">Patient</div><div class="value">' . ris_h($visit['full_name']) . '</div><div class="muted">MRN ' . ris_h($visit['mrn']) . ' | ' . ris_h($visit['phone'] ?: '-') . '</div></div><div class="box"><div class="label">Collection</div><div class="value">' . ris_h($visit['center_name'] ?: 'Main Lab') . '</div><div class="muted">Staff: ' . ris_h($visit['phlebotomy_staff'] ?: '-') . ' | Area: ' . ris_h($visit['home_visit_area'] ?: '-') . '</div></div></div><table><thead><tr><th>Accession</th><th>Service</th><th>Sample</th><th>Tube</th><th>Qty</th></tr></thead><tbody>' . $rows . '</tbody></table><table class="totals" style="margin-left:auto;width:300px"><tr><td>Total</td><td class="num">Rs ' . number_format((float)$visit['net_amount'], 2) . '</td></tr><tr><td>Paid</td><td class="num">Rs ' . number_format((float)$visit['paid_amount'], 2) . '</td></tr><tr><th>Balance</th><th class="num">Rs ' . number_format((float)$visit['balance'], 2) . '</th></tr></table><p class="noprint"><button onclick="window.print()">Print SRS</button></p></div></body></html>';
    exit;
}

function ris_render_bill_receipt(array $visit, array $orders, array $payments): void
{
    $orderRows = '';
    foreach ($orders as $order) {
        $orderRows .= '<tr><td>' . ris_h($order['service_name'] ?: '-') . '</td><td>' . ris_h($order['accession_number']) . '</td><td class="num">Rs ' . number_format((float)$order['price'], 2) . '</td></tr>';
    }
    $payRows = '';
    foreach ($payments as $payment) {
        $sign = (int)$payment['is_refund'] === 1 ? '-' : '';
        $payRows .= '<tr><td>' . ris_h($payment['mode']) . '</td><td>' . ris_h($payment['payer_name'] ?: 'Patient') . '</td><td>' . ris_h($payment['received_at']) . '</td><td class="num">' . $sign . 'Rs ' . number_format((float)$payment['amount'], 2) . '</td></tr>';
    }
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Bill ' . ris_h($visit['visit_no']) . '</title>' . ris_print_css() . '</head><body><div class="page"><div class="top"><div><div class="brand">Bill Receipt</div><div class="muted">' . ris_h($visit['visit_no']) . '</div></div><div class="muted">' . ris_h($visit['visit_datetime']) . '</div></div><div class="grid"><div class="box"><div class="label">Patient</div><div class="value">' . ris_h($visit['full_name']) . '</div><div class="muted">MRN ' . ris_h($visit['mrn']) . ' | ' . ris_h($visit['phone'] ?: '-') . '</div></div><div class="box"><div class="label">Doctor / Center</div><div class="value">' . ris_h($visit['doctor_name'] ?: 'Self') . '</div><div class="muted">' . ris_h($visit['center_name'] ?: 'Main Lab') . '</div></div></div><table><thead><tr><th>Service</th><th>Accession</th><th class="num">Amount</th></tr></thead><tbody>' . $orderRows . '</tbody></table><table><tr><td>Total</td><td class="num">Rs ' . number_format((float)$visit['total_amount'], 2) . '</td></tr><tr><td>Extra charge</td><td class="num">Rs ' . number_format((float)$visit['misc_charge'], 2) . '</td></tr><tr><td>Discount</td><td class="num">Rs ' . number_format((float)$visit['discount'], 2) . '</td></tr><tr><th>Final</th><th class="num">Rs ' . number_format((float)$visit['net_amount'], 2) . '</th></tr><tr><td>Paid</td><td class="num">Rs ' . number_format((float)$visit['paid_amount'], 2) . '</td></tr><tr><td>Balance</td><td class="num">Rs ' . number_format((float)$visit['balance'], 2) . '</td></tr></table><h3>Payments</h3><table><thead><tr><th>Mode</th><th>Paid by</th><th>Date</th><th class="num">Amount</th></tr></thead><tbody>' . ($payRows ?: '<tr><td colspan="4">No payments recorded</td></tr>') . '</tbody></table><p class="noprint"><button onclick="window.print()">Print bill receipt</button></p></div></body></html>';
    exit;
}
