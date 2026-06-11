<?php
/**
 * Printable lab report for an order.
 *   GET ?order_id=<id>&header=1|0   (header=0 leaves blank space for pre-printed letterhead)
 * Marks the order printed (result_status=printed, report_printed_at) when header=1 print is rendered.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisResults.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { http_response_code(401); echo 'Unauthorized'; exit; }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { http_response_code(403); echo 'Forbidden'; exit; }

function rr_h($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

function rr_setting(mysqli $db, string $key, string $default = ''): string
{
    $stmt = $db->prepare('SELECT setting_value FROM hospital_settings WHERE setting_key = ? LIMIT 1');
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $v = $row ? (string)$row['setting_value'] : '';
    return $v !== '' ? $v : $default;
}

try {
    $db = getDbConnection();
    $orderId = (int)($_GET['order_id'] ?? 0);
    $withHeader = ($_GET['header'] ?? '1') !== '0';
    $markPrinted = ($_GET['preview'] ?? '0') !== '1';
    if ($orderId <= 0) { throw new RuntimeException('order_id is required'); }

    $stmt = $db->prepare(
        "SELECT o.*, s.name AS service_name, s.lab_name,
                v.visit_no, v.visit_datetime, v.ref_no,
                p.id AS patient_id, p.mrn, p.full_name, p.name_prefix, p.sex, p.dob, p.age_years, p.age_months, p.age_days, p.phone,
                rd.name AS doctor_name, COALESCE(au.full_name, au.username) AS authenticated_name
         FROM ris_orders o
         LEFT JOIN ris_services s ON s.id = o.service_id
         JOIN ris_visits v ON v.id = o.visit_id
         JOIN ris_patients p ON p.id = o.patient_id
         LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
         LEFT JOIN users au ON au.id = o.authenticated_by
         WHERE o.id = ?"
    );
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$order) { throw new RuntimeException('Order not found'); }

    $sex = (string)($order['sex'] ?? '');
    $ageDays = ris_patient_age_days($order);
    $ageText = $order['age_years'] !== null ? ((int)$order['age_years'] . 'y') : '';
    if (!empty($order['age_months'])) { $ageText .= ' ' . (int)$order['age_months'] . 'm'; }
    if (!empty($order['age_days'])) { $ageText .= ' ' . (int)$order['age_days'] . 'd'; }

    // Parameters + saved values.
    $pstmt = $db->prepare('SELECT * FROM ris_test_parameters WHERE service_id = ? AND is_active = 1 ORDER BY sort_order, id');
    $sid = (int)$order['service_id'];
    $pstmt->bind_param('i', $sid);
    $pstmt->execute();
    $pres = $pstmt->get_result();
    $params = [];
    while ($row = $pres->fetch_assoc()) { $row['ranges'] = []; $params[(int)$row['id']] = $row; }
    $pstmt->close();
    if ($params) {
        $ids = implode(',', array_map('intval', array_keys($params)));
        $rres = $db->query("SELECT * FROM ris_test_ref_ranges WHERE parameter_id IN ($ids)");
        while ($r = $rres->fetch_assoc()) { $params[(int)$r['parameter_id']]['ranges'][] = $r; }
    }
    $vals = [];
    $vstmt = $db->prepare('SELECT parameter_id, value, flag FROM ris_test_results WHERE order_id = ?');
    $vstmt->bind_param('i', $orderId);
    $vstmt->execute();
    $vres = $vstmt->get_result();
    while ($vr = $vres->fetch_assoc()) { $vals[(int)$vr['parameter_id']] = $vr; }
    $vstmt->close();

    $brand = [
        'name' => rr_setting($db, 'brand_name', 'One Clickz Imaging'),
        'tagline' => rr_setting($db, 'brand_tagline', ''),
        'phone' => rr_setting($db, 'brand_phone', ''),
        'email' => rr_setting($db, 'brand_email', ''),
        'address' => rr_setting($db, 'brand_address', ''),
        'logo' => rr_setting($db, 'brand_logo_image', ''),
    ];

    $rows = '';
    foreach ($params as $p) {
        $range = ris_resolve_range($p['ranges'] ?? [], $sex, $ageDays);
        $rangeText = '';
        if ($range) {
            if (!empty($range['normal_text'])) { $rangeText = $range['normal_text']; }
            elseif ($range['low'] !== null && $range['high'] !== null) { $rangeText = (float)$range['low'] . ' - ' . (float)$range['high']; }
            elseif ($range['high'] !== null) { $rangeText = '< ' . (float)$range['high']; }
            elseif ($range['low'] !== null) { $rangeText = '> ' . (float)$range['low']; }
        }
        $saved = $vals[(int)$p['id']] ?? null;
        $value = $saved['value'] ?? '';
        $flag = $saved['flag'] ?? '';
        if ((int)$p['is_heading'] === 1) {
            $rows .= '<tr><td colspan="4" style="font-weight:700;background:#f6f6f6">' . rr_h($p['name']) . '</td></tr>';
            continue;
        }
        $strong = ($flag === 'H' || $flag === 'L') ? 'font-weight:700;' : '';
        $flagMark = $flag === 'H' ? ' &uarr;' : ($flag === 'L' ? ' &darr;' : '');
        $rows .= '<tr>'
            . '<td>' . rr_h($p['name']) . '</td>'
            . '<td style="' . $strong . '">' . rr_h($value) . $flagMark . '</td>'
            . '<td>' . rr_h($p['unit'] ?: '') . '</td>'
            . '<td>' . rr_h($rangeText) . '</td>'
            . '</tr>';
    }

    // Machine graphs/images attached to this order.
    $graphsHtml = '';
    $gres = $db->query('SELECT id, asset_type, title FROM ris_result_assets WHERE order_id = ' . (int)$orderId . ' ORDER BY id');
    if ($gres) {
        $imgs = '';
        $links = '';
        while ($g = $gres->fetch_assoc()) {
            $url = '/api/results/graph-file.php?id=' . (int)$g['id'];
            if ($g['asset_type'] === 'pdf') {
                $links .= '<li><a href="' . rr_h($url) . '" target="_blank">' . rr_h($g['title'] ?: 'Attachment') . ' (PDF)</a></li>';
            } else {
                $imgs .= '<div class="graph"><img src="' . rr_h($url) . '" alt="' . rr_h($g['title']) . '"><div class="muted">' . rr_h($g['title']) . '</div></div>';
            }
        }
        if ($imgs !== '' || $links !== '') {
            $graphsHtml = '<h2 style="text-align:left">Graphs / attachments</h2>' . $imgs . ($links ? '<ul>' . $links . '</ul>' : '');
        }
    }

    if ($markPrinted) {
        $db->query('UPDATE ris_orders SET result_status = ' . ($order['result_status'] === 'authenticated' || $order['result_status'] === 'printed' ? "'printed'" : "result_status") . ', report_printed_at = NOW() WHERE id = ' . (int)$orderId);
    }

    header('Content-Type: text/html; charset=utf-8');
    $headerHtml = '';
    if ($withHeader) {
        $logo = $brand['logo'] !== '' ? '<img src="' . rr_h($brand['logo']) . '" style="max-height:60px;max-width:120px;object-fit:contain">' : '';
        $headerHtml = '<div class="rep-top"><div style="display:flex;gap:12px;align-items:center">' . $logo
            . '<div><div class="brand">' . rr_h($brand['name']) . '</div><div class="muted">' . rr_h($brand['tagline']) . '</div><div class="muted">' . nl2br(rr_h($brand['address'])) . '</div></div></div>'
            . '<div class="muted" style="text-align:right">' . rr_h($brand['phone']) . '<br>' . rr_h($brand['email']) . '</div></div>';
    } else {
        $headerHtml = '<div style="height:120px"></div>';
    }

    $authLine = $order['authenticated_name']
        ? '<div class="auth">Authenticated by: ' . rr_h($order['authenticated_name']) . ' &middot; ' . rr_h($order['authenticated_at']) . '</div>'
        : '';

    echo '<!doctype html><html><head><meta charset="utf-8"><title>Report ' . rr_h($order['visit_no']) . '</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f5f5f5;color:#171717}
.page{width:780px;margin:18px auto;background:#fff;border:1px solid #ddd;padding:24px;min-height:1000px}
.rep-top{display:flex;justify-content:space-between;border-bottom:3px solid #dc2626;padding-bottom:10px}
.brand{font-size:22px;font-weight:800;color:#dc2626}.muted{color:#666;font-size:12px}
.pinfo{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:14px 0;font-size:13px}
.pinfo b{color:#444}
h2{font-size:16px;margin:14px 0 6px;text-align:center;text-transform:uppercase;letter-spacing:1px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #ddd;padding:7px;text-align:left;font-size:13px}
th{background:#fafafa;font-size:11px;text-transform:uppercase}
.notes{margin-top:14px;font-size:12px;white-space:pre-wrap}
.auth{margin-top:30px;font-size:12px;color:#444}
.graph{margin-top:10px;text-align:center}.graph img{max-width:100%;border:1px solid #ddd}
.sign{margin-top:50px;text-align:right;font-size:12px}
@media print{body{background:#fff}.page{border:0;margin:0;width:auto}.noprint{display:none}}
</style></head><body><div class="page">'
        . $headerHtml
        . '<div class="pinfo">'
        . '<div><b>Patient:</b> ' . rr_h(trim(($order['name_prefix'] ?? '') . ' ' . $order['full_name'])) . '</div>'
        . '<div><b>Reg No:</b> ' . rr_h($order['visit_no']) . '</div>'
        . '<div><b>Age / Sex:</b> ' . rr_h(trim($ageText)) . ' / ' . rr_h($order['sex'] ?: '-') . '</div>'
        . '<div><b>Date:</b> ' . rr_h($order['visit_datetime']) . '</div>'
        . '<div><b>MRN:</b> ' . rr_h($order['mrn']) . '</div>'
        . '<div><b>Ref. Doctor:</b> ' . rr_h($order['doctor_name'] ?: 'Self') . '</div>'
        . '</div>'
        . '<h2>' . rr_h($order['service_name'] ?: 'Report') . ($order['lab_name'] ? ' <span class="muted">(' . rr_h($order['lab_name']) . ')</span>' : '') . '</h2>'
        . '<table><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference range</th></tr></thead><tbody>'
        . ($rows ?: '<tr><td colspan="4" class="muted">No parameters configured for this test.</td></tr>')
        . '</tbody></table>'
        . ($order['result_remark'] ? '<div class="notes"><b>Remark:</b> ' . nl2br(rr_h($order['result_remark'])) . '</div>' : '')
        . ($order['result_advice'] ? '<div class="notes"><b>Advice:</b> ' . nl2br(rr_h($order['result_advice'])) . '</div>' : '')
        . ($order['result_note'] ? '<div class="notes"><b>Note:</b> ' . nl2br(rr_h($order['result_note'])) . '</div>' : '')
        . $graphsHtml
        . $authLine
        . '<div class="sign">_______________________<br>Authorised signatory</div>'
        . '<p class="noprint" style="text-align:center"><button onclick="window.print()">Print report</button></p>'
        . '</div></body></html>';
} catch (Throwable $e) {
    logMessage('RIS report print error: ' . $e->getMessage(), 'error', 'ris.log');
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Server error: ' . $e->getMessage();
}
