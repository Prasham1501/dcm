<?php
/**
 * Billing — receipts.
 *   POST { visit_id }      -> generate a numbered receipt
 *   GET  ?visit_id=<id>    -> list receipts for a visit (latest first)
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisBillingRepository.php';
require_once __DIR__ . '/../../includes/ris/barcode.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $receiptId = (int) ($_GET['id'] ?? $_GET['receipt_id'] ?? 0);
        if (($_GET['format'] ?? '') === 'html' && $receiptId > 0) {
            ris_render_receipt_html($db, $receiptId);
        }
        $visitId = (int) ($_GET['visit_id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM ris_receipts WHERE visit_id = ? ORDER BY id DESC");
        $stmt->bind_param('i', $visitId);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($r = $res->fetch_assoc()) { $out[] = $r; }
        $stmt->close();
        sendSuccessResponse($out);
    }

    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int) ($input['visit_id'] ?? 0);
    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }

    $repo = new RisBillingRepository($db, new RisCounters($db));
    $receipt = $repo->generateReceipt($visitId, (int) $user['id']);
    $receipt['print_url'] = '/api/billing/receipt.php?id=' . (int)$receipt['id'] . '&format=html';
    logAuditEvent($user['id'], 'create', 'ris_receipt', $receipt['id'] ?? null, 'Receipt ' . ($receipt['receipt_no'] ?? ''));
    sendSuccessResponse($receipt, 'Receipt generated');
} catch (Throwable $e) {
    logMessage('Billing receipt error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ris_setting(mysqli $db, string $key, string $default = ''): string
{
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = ? LIMIT 1");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? (string)$row['setting_value'] : $default;
}

function ris_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function ris_render_receipt_html(mysqli $db, int $receiptId): void
{
    $stmt = $db->prepare(
        "SELECT r.*, v.visit_no, v.visit_datetime, v.total_amount, v.misc_charge,
                v.home_visit_area, v.home_visit_amount, v.home_visit_time, v.phlebotomy_staff,
                v.paid_amount, v.balance, v.status AS visit_status,
                p.mrn, p.full_name, p.phone, p.sex, p.age_years
         FROM ris_receipts r
         JOIN ris_visits v ON v.id = r.visit_id
         JOIN ris_patients p ON p.id = v.patient_id
         WHERE r.id = ?"
    );
    $stmt->bind_param('i', $receiptId);
    $stmt->execute();
    $receipt = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$receipt) {
        http_response_code(404);
        echo 'Receipt not found';
        exit;
    }

    $orders = [];
    $stmt = $db->prepare(
        "SELECT o.accession_number, o.modality, o.price, s.name AS service_name
         FROM ris_orders o LEFT JOIN ris_services s ON s.id = o.service_id
         WHERE o.visit_id = ? ORDER BY o.id"
    );
    $visitId = (int)$receipt['visit_id'];
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) { $orders[] = $row; }
    $stmt->close();

    $payments = [];
    $stmt = $db->prepare("SELECT amount, mode, reference, received_at FROM ris_payments WHERE visit_id = ? AND is_refund = 0 ORDER BY id");
    $stmt->bind_param('i', $visitId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) { $payments[] = $row; }
    $stmt->close();

    $brand = [
        'name' => ris_setting($db, 'brand_name', 'One Clickz Imaging'),
        'tagline' => ris_setting($db, 'brand_tagline', 'Radiology Information System'),
        'phone' => ris_setting($db, 'brand_phone', ''),
        'email' => ris_setting($db, 'brand_email', ''),
        'address' => ris_setting($db, 'brand_address', ''),
        'website' => ris_setting($db, 'brand_website', ''),
        'logo' => ris_setting($db, 'brand_logo_image', ''),
        'header' => ris_setting($db, 'receipt_header', ''),
        'footer' => ris_setting($db, 'receipt_footer', 'Thank you. Get well soon.'),
        'paper_size' => strtoupper(ris_setting($db, 'receipt_paper_size', 'A5')),
        'signature_label' => ris_setting($db, 'receipt_signature_label', 'Authorized sign / stamp'),
        'signature_image' => ris_setting($db, 'receipt_signature_image', ''),
        'stamp_image' => ris_setting($db, 'receipt_stamp_image', ''),
    ];

    header('Content-Type: text/html; charset=utf-8');
    $orderRows = '';
    foreach ($orders as $order) {
        // Accession is intentionally not shown on reception receipts.
        $orderRows .= '<tr><td>' . ris_h($order['service_name'] ?: '-') . '</td><td>' . ris_h($order['modality'] ?: '-') . '</td><td class="num">Rs ' . number_format((float)$order['price'], 2) . '</td></tr>';
    }
    if ($orderRows === '') {
        $orderRows = '<tr><td colspan="3" class="muted">No services found</td></tr>';
    }

    $paymentRows = '';
    foreach ($payments as $payment) {
        $paymentRows .= '<tr><td>' . ris_h(ucfirst($payment['mode'])) . '</td><td>' . ris_h($payment['reference'] ?: '-') . '</td><td>' . ris_h($payment['received_at']) . '</td><td class="num">Rs ' . number_format((float)$payment['amount'], 2) . '</td></tr>';
    }
    if ($paymentRows === '') {
        $paymentRows = '<tr><td colspan="4" class="muted">No payment rows found</td></tr>';
    }
    $paperWidth = $brand['paper_size'] === 'A4' ? '780px' : '560px';
    $signature = '';
    if ($brand['signature_image'] !== '' || $brand['stamp_image'] !== '') {
        $signature = '<div class="signbox">'
            . ($brand['stamp_image'] !== '' ? '<img src="' . ris_h($brand['stamp_image']) . '" alt="Stamp">' : '')
            . ($brand['signature_image'] !== '' ? '<img src="' . ris_h($brand['signature_image']) . '" alt="Signature">' : '')
            . '<div>' . ris_h($brand['signature_label']) . '</div></div>';
    }

    $logoHtml = $brand['logo'] !== '' ? '<img class="logo" src="' . ris_h($brand['logo']) . '" alt="Logo">' : '';

    // Scannable Reg No barcode — a USB scanner in the reception "Scan code" box jumps here.
    $regBarcode = '<div class="regcode">' . ris_code128_svg((string)$receipt['visit_no'], 40)
        . '<div class="regcode-text">' . ris_h($receipt['visit_no']) . '</div></div>';

    echo '<!doctype html><html><head><meta charset="utf-8"><title>Receipt ' . ris_h($receipt['receipt_no']) . '</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f5f5f5;color:#171717}.page{width:' . $paperWidth . ';margin:24px auto;background:white;border:1px solid #ddd;padding:24px}.top{border-bottom:4px solid #dc2626;padding-bottom:14px;display:flex;justify-content:space-between;gap:20px}.brand-wrap{display:flex;gap:12px;align-items:flex-start}.logo{max-height:58px;max-width:90px;object-fit:contain}.brand{font-size:24px;font-weight:800;color:#dc2626}.tag{font-size:12px;color:#666;margin-top:3px}.meta{text-align:right;font-size:12px;line-height:1.7}.note{margin:14px 0;padding:9px 11px;background:#fff5f5;border:1px solid #fecaca;color:#7f1d1d}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}.box{border:1px solid #e5e5e5;padding:10px}.label{font-size:10px;text-transform:uppercase;color:#777;font-weight:700}.value{font-size:13px;font-weight:700;margin-top:4px}h3{font-size:14px;margin:14px 0 6px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#fafafa;text-align:left;font-size:10px;text-transform:uppercase;color:#555}td,th{border:1px solid #e5e5e5;padding:7px}.num{text-align:right}.totals{margin-left:auto;width:300px}.muted{color:#777}.signbox{align-items:center;display:flex;flex-direction:column;gap:4px;margin-left:auto;margin-top:18px;text-align:center;width:180px;color:#555;font-size:11px}.signbox img{max-height:58px;max-width:150px;object-fit:contain}.footer{margin-top:18px;border-top:1px solid #e5e5e5;padding-top:10px;text-align:center;color:#555;font-size:12px}.regcode{margin-top:14px;text-align:center}.regcode .barcode{display:inline-block;height:40px;width:200px;fill:#000}.regcode-text{font-family:Consolas,monospace;font-size:11px;letter-spacing:1px;margin-top:2px}@media print{body{background:white}.page{margin:0 auto;border:0;width:auto}.noprint{display:none}}
</style></head><body><div class="page">
<div class="top"><div class="brand-wrap">' . $logoHtml . '<div><div class="brand">' . ris_h($brand['name']) . '</div><div class="tag">' . ris_h($brand['tagline']) . '</div><div class="tag">' . nl2br(ris_h($brand['address'])) . '</div></div></div><div class="meta"><b>Receipt</b><br>' . ris_h($receipt['receipt_no']) . '<br>' . ris_h((string)$receipt['created_at']) . '<br>' . ris_h($brand['phone']) . '<br>' . ris_h($brand['email']) . '</div></div>
' . ($brand['header'] !== '' ? '<div class="note">' . nl2br(ris_h($brand['header'])) . '</div>' : '') . '
<div class="grid"><div class="box"><div class="label">Patient</div><div class="value">' . ris_h($receipt['full_name']) . '</div><div class="muted">MRN ' . ris_h($receipt['mrn']) . ' | ' . ris_h($receipt['sex'] ?: '-') . ' ' . ris_h((string)($receipt['age_years'] ?? '')) . '</div><div class="muted">' . ris_h($receipt['phone'] ?: '-') . '</div></div><div class="box"><div class="label">Visit</div><div class="value">' . ris_h($receipt['visit_no']) . '</div><div class="muted">' . ris_h($receipt['visit_datetime']) . '</div><div class="muted">Status: ' . ris_h($receipt['visit_status']) . '</div><div class="muted">Home visit: ' . ris_h(((float)($receipt['home_visit_amount'] ?? 0) > 0 || ($receipt['home_visit_area'] ?? '') !== '') ? (($receipt['home_visit_area'] ?: '-') . ' | Rs ' . number_format((float)$receipt['home_visit_amount'], 2) . ' | ' . ($receipt['home_visit_time'] ?: '-')) : 'No') . '</div></div></div>
<h3>Services</h3><table><thead><tr><th>Service</th><th>Modality</th><th class="num">Amount</th></tr></thead><tbody>' . $orderRows . '</tbody></table>
<h3>Payments</h3><table><thead><tr><th>Mode</th><th>Reference</th><th>Received</th><th class="num">Amount</th></tr></thead><tbody>' . $paymentRows . '</tbody></table>
<table class="totals"><tr><td>Tests total</td><td class="num">Rs ' . number_format((float)$receipt['total_amount'], 2) . '</td></tr><tr><td>Home visit</td><td class="num">Rs ' . number_format((float)$receipt['home_visit_amount'], 2) . '</td></tr><tr><td>Extra charge</td><td class="num">Rs ' . number_format((float)$receipt['misc_charge'], 2) . '</td></tr><tr><td>Subtotal</td><td class="num">Rs ' . number_format((float)$receipt['subtotal'], 2) . '</td></tr><tr><td>Discount</td><td class="num">Rs ' . number_format((float)$receipt['discount'], 2) . '</td></tr><tr><td>Tax</td><td class="num">Rs ' . number_format((float)$receipt['tax_amount'], 2) . '</td></tr><tr><th>Total</th><th class="num">Rs ' . number_format((float)$receipt['total'], 2) . '</th></tr><tr><td>Paid</td><td class="num">Rs ' . number_format((float)$receipt['paid_amount'], 2) . '</td></tr><tr><td>Balance</td><td class="num">Rs ' . number_format((float)$receipt['balance'], 2) . '</td></tr></table>
' . ($receipt['gst_number'] ? '<div class="muted">GST: ' . ris_h($receipt['gst_number']) . '</div>' : '') . '
' . $signature . '
' . $regBarcode . '
<div class="footer">' . nl2br(ris_h($brand['footer'])) . ($brand['website'] ? '<br>' . ris_h($brand['website']) : '') . '</div>
<p class="noprint" style="text-align:center"><button onclick="window.print()">Print receipt</button></p>
</div></body></html>';
    exit;
}
