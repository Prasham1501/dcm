<?php
declare(strict_types=1);

class PdfInvoice {

    /**
     * Generate a PDF invoice and return the temp file path.
     * $inv     = invoice row from DB
     * $account = account + owner user row
     */
    public function generate(array $inv, array $account): string {
        $html  = $this->buildHtml($inv, $account);
        $base  = sys_get_temp_dir() . '/mv_inv_' . $inv['id'];

        // Wipe stale outputs from prior runs so we never serve a cached corrupt file.
        @unlink($base . '.pdf');
        @unlink($base . '.html');

        if (class_exists('Dompdf\Dompdf')) {
            try {
                $dompdf = new \Dompdf\Dompdf([
                    'isRemoteEnabled'      => false,
                    'defaultFont'          => 'DejaVu Sans', // unicode-safe (renders ₹, etc.)
                    'isHtml5ParserEnabled' => true,
                ]);
                $dompdf->loadHtml($html);
                $dompdf->setPaper('A4', 'portrait');
                $dompdf->render();
                $bytes = $dompdf->output();

                if (is_string($bytes) && str_starts_with($bytes, '%PDF-')) {
                    $path = $base . '.pdf';
                    file_put_contents($path, $bytes);
                    return $path;
                }
                error_log('[PdfInvoice] Dompdf output was not a PDF (' . strlen((string)$bytes) . ' bytes). Falling back to HTML.');
            } catch (\Throwable $e) {
                error_log('[PdfInvoice] Dompdf render failed: ' . $e->getMessage() . '. Falling back to HTML.');
            }
        }

        // Fallback: save HTML so the controller can serve it with a print prompt.
        $path = $base . '.html';
        file_put_contents($path, $html);
        return $path;
    }

    private function buildHtml(array $inv, array $account): string {
        $h          = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
        $brand      = $h(Settings::get('brand.name', 'Mediview'));
        $brandAddr  = $h(Settings::get('brand.address', ''));
        $brandEmail = $h(Settings::get('brand.support_email', ''));
        $brandPhone = $h(Settings::get('brand.phone', ''));
        $brandSite  = $h(Settings::get('brand.website', ''));
        $upiId      = Settings::get('business.upi_id', '');
        $bankName   = $h(Settings::get('business.bank_name', ''));
        $bankAcc    = $h(Settings::get('business.bank_account', ''));
        $bankIfsc   = $h(Settings::get('business.bank_ifsc', ''));

        $number    = $h($inv['number']);
        $date      = date('d M Y', strtotime($inv['created_at'] ?? 'now'));
        $subtotal  = number_format((float)$inv['subtotal_inr'], 2);
        $gst       = number_format((float)$inv['gst_inr'], 2);
        $total     = number_format((float)$inv['total_inr'], 2);
        $status    = strtolower((string)($inv['status'] ?? 'paid'));
        $statusLbl = strtoupper($status === 'manual' ? 'PAID' : $status);
        $items     = json_decode($inv['items_json'] ?? '[]', true) ?: [];

        $custName  = $h($account['owner_name'] ?? $account['name'] ?? '');
        $custEmail = $h($account['owner_email'] ?? $account['email'] ?? '');

        // Items table rows — alternating row backgrounds + cleaner cells.
        $itemRows = '';
        foreach ($items as $i => $item) {
            $bg = $i % 2 === 1 ? 'background:#f8fafc;' : '';
            $itemRows .= '<tr style="' . $bg . '">'
                . '<td class="desc">' . $h($item['name'] ?? '') . '</td>'
                . '<td class="num">' . (int)($item['qty'] ?? 1) . '</td>'
                . '<td class="num">&#8377;' . number_format((float)($item['rate']   ?? 0), 2) . '</td>'
                . '<td class="num strong">&#8377;' . number_format((float)($item['amount'] ?? 0), 2) . '</td>'
                . '</tr>';
        }

        // UPI QR code (rendered as SVG → base64-img so Dompdf can embed it inline).
        $qrBlock = '';
        if ($upiId && class_exists('BaconQrCode\Renderer\ImageRenderer')) {
            try {
                $upiString = 'upi://pay?pa=' . rawurlencode((string)$upiId)
                    . '&pn=' . rawurlencode((string)Settings::get('brand.name', 'Mediview'))
                    . '&am=' . rawurlencode((string)$inv['total_inr'])
                    . '&tn=' . rawurlencode("Invoice $number");
                $renderer = new \BaconQrCode\Renderer\ImageRenderer(
                    new \BaconQrCode\Renderer\RendererStyle\RendererStyle(120),
                    new \BaconQrCode\Renderer\Image\SvgImageBackEnd()
                );
                $writer = new \BaconQrCode\Writer($renderer);
                $svg    = $writer->writeString($upiString);
                $qrBlock = '<div class="qr-card">'
                    . '<img src="data:image/svg+xml;base64,' . base64_encode($svg) . '" width="116" height="116" alt="UPI QR"/>'
                    . '<div class="qr-cap">Scan to pay via UPI</div>'
                    . '<div class="qr-upi">' . $h($upiId) . '</div>'
                    . '</div>';
            } catch (\Throwable) {}
        }

        // Bank-transfer block — only rendered if at least one field is set.
        $bankRows = '';
        if ($bankName) $bankRows .= '<tr><td class="bk-key">Bank</td><td class="bk-val">' . $bankName . '</td></tr>';
        if ($bankAcc)  $bankRows .= '<tr><td class="bk-key">A/c No.</td><td class="bk-val">' . $bankAcc . '</td></tr>';
        if ($bankIfsc) $bankRows .= '<tr><td class="bk-key">IFSC</td><td class="bk-val">' . $bankIfsc . '</td></tr>';
        if ($upiId && !$qrBlock) $bankRows .= '<tr><td class="bk-key">UPI</td><td class="bk-val">' . $h($upiId) . '</td></tr>';

        $bankBlock = '';
        if ($bankRows) {
            $bankBlock = '<div class="bank-card">'
                . '<div class="card-title">Bank transfer details</div>'
                . '<table class="bk">' . $bankRows . '</table>'
                . '</div>';
        }

        // Paid stamp — only when paid/manual.
        $stampHtml = '';
        if (in_array($status, ['paid', 'manual'], true)) {
            $stampHtml = '<div class="stamp">' . $statusLbl . '</div>';
        }

        // Footer line — only show "contact <email>" if email is set.
        $footerLine = $brandEmail
            ? 'Thank you for your business. Questions? <a href="mailto:' . $brandEmail . '">' . $brandEmail . '</a>'
            : 'Thank you for your business.';
        if ($brandSite) {
            $footerLine .= ' &middot; ' . $brandSite;
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice {$number}</title>
<style>
  @page { margin: 0; size: A4; }
  html, body { margin: 0; padding: 0; font-family: 'DejaVu Sans', sans-serif; color: #0f172a; font-size: 11.5px; line-height: 1.45; }
  .page { padding: 0 0 40px 0; }

  /* ── Top brand bar ─────────────────────────────────────────────────────── */
  .topbar { background: #DC2626; color: #fff; padding: 26px 36px; }
  .topbar table { width: 100%; border-collapse: collapse; }
  .topbar .brand-name { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
  .topbar .brand-tag  { font-size: 10px; opacity: 0.85; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.14em; }
  .topbar .inv-title  { font-size: 22px; font-weight: 700; letter-spacing: 0.06em; text-align: right; }
  .topbar .inv-num    { font-size: 12px; opacity: 0.92; margin-top: 4px; text-align: right; }
  .topbar .inv-num strong { font-weight: 700; }

  /* ── Meta strip (date / status / amount) ───────────────────────────────── */
  .meta-strip { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 14px 36px; }
  .meta-strip table { width: 100%; border-collapse: collapse; }
  .meta-strip td { vertical-align: top; padding: 0; }
  .meta-strip .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em; color: #64748b; font-weight: 700; margin-bottom: 3px; display: block; }
  .meta-strip .value { font-size: 13px; font-weight: 600; color: #0f172a; }
  .meta-strip .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; }
  .badge-paid { background: #dcfce7; color: #166534; }

  /* ── Body sections ─────────────────────────────────────────────────────── */
  .section { padding: 26px 36px 0 36px; }

  .parties { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  .parties td { width: 50%; vertical-align: top; padding: 0; }
  .party { border-left: 3px solid #DC2626; padding: 0 0 0 14px; }
  .party + .party { margin-left: 14px; }
  .party-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.18em; color: #94a3b8; font-weight: 700; margin-bottom: 6px; }
  .party-name  { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .party-line  { color: #475569; }

  /* ── Items table ───────────────────────────────────────────────────────── */
  .items { width: 100%; border-collapse: collapse; }
  .items thead th {
    background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em;
    padding: 10px 14px; text-align: left; font-weight: 700;
  }
  .items thead th.num { text-align: right; }
  .items tbody td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .items tbody td.desc { color: #0f172a; }
  .items tbody td.num  { text-align: right; font-variant-numeric: tabular-nums; }
  .items tbody td.strong { font-weight: 700; }

  /* ── Totals card ───────────────────────────────────────────────────────── */
  .totals-wrap { width: 100%; border-collapse: collapse; margin-top: 18px; }
  .totals-wrap td { vertical-align: top; padding: 0; }
  .totals-wrap td.left  { width: 60%; }
  .totals-wrap td.right { width: 40%; }
  .totals { width: 100%; border-collapse: collapse; }
  .totals td { padding: 6px 0; font-variant-numeric: tabular-nums; }
  .totals .label { color: #475569; }
  .totals .value { text-align: right; color: #0f172a; }
  .totals .grand-label { font-size: 13px; font-weight: 700; color: #0f172a; padding-top: 12px; border-top: 2px solid #0f172a; }
  .totals .grand-value { font-size: 16px; font-weight: 700; color: #DC2626; padding-top: 12px; border-top: 2px solid #0f172a; text-align: right; }

  .stamp {
    display: inline-block; transform: rotate(-8deg);
    border: 2.5px solid #16a34a; color: #16a34a; padding: 6px 14px;
    font-size: 18px; font-weight: 700; letter-spacing: 0.18em; border-radius: 4px;
    margin-top: 14px;
  }

  /* ── Tax note ──────────────────────────────────────────────────────────── */
  .tax-note { background: #fefce8; border-left: 3px solid #f59e0b; padding: 10px 14px; font-size: 10.5px; color: #78350f; margin-top: 24px; }
  .tax-note b { color: #78350f; }

  /* ── Payment block (QR + bank) ─────────────────────────────────────────── */
  .pay-wrap { width: 100%; border-collapse: collapse; margin-top: 28px; }
  .pay-wrap td { vertical-align: top; padding: 0; }
  .qr-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; text-align: center; width: 160px; }
  .qr-cap  { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-top: 8px; }
  .qr-upi  { font-size: 10.5px; color: #0f172a; font-weight: 600; margin-top: 4px; }
  .bank-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 18px; }
  .card-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.16em; color: #64748b; font-weight: 700; margin-bottom: 8px; }
  .bk { width: 100%; border-collapse: collapse; }
  .bk td { padding: 4px 0; font-size: 11px; }
  .bk-key { color: #64748b; width: 32%; }
  .bk-val { color: #0f172a; font-weight: 600; }

  /* ── Footer ────────────────────────────────────────────────────────────── */
  .footer { margin: 36px 36px 0 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 10px; text-align: center; }
  .footer a { color: #DC2626; text-decoration: none; }
</style>
</head>
<body>
<div class="page">

  <div class="topbar">
    <table>
      <tr>
        <td>
          <div class="brand-name">{$brand}</div>
          <div class="brand-tag">Diagnostic imaging workstation</div>
        </td>
        <td>
          <div class="inv-title">INVOICE</div>
          <div class="inv-num"><strong>#{$number}</strong></div>
        </td>
      </tr>
    </table>
  </div>

  <div class="meta-strip">
    <table>
      <tr>
        <td style="width:30%;">
          <span class="label">Invoice date</span>
          <span class="value">{$date}</span>
        </td>
        <td style="width:35%;">
          <span class="label">Status</span>
          <span class="badge badge-paid">{$statusLbl}</span>
        </td>
        <td style="width:35%; text-align:right;">
          <span class="label">Amount due</span>
          <span class="value" style="color:#DC2626; font-size:15px;">&#8377;{$total}</span>
        </td>
      </tr>
    </table>
  </div>

  <div class="section">
    <table class="parties">
      <tr>
        <td>
          <div class="party">
            <div class="party-label">From</div>
            <div class="party-name">{$brand}</div>
            <div class="party-line">{$brandAddr}</div>
            <div class="party-line">{$brandEmail}</div>
            <div class="party-line">{$brandPhone}</div>
          </div>
        </td>
        <td>
          <div class="party">
            <div class="party-label">Billed to</div>
            <div class="party-name">{$custName}</div>
            <div class="party-line">{$custEmail}</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:55%;">Description</th>
          <th class="num" style="width:10%;">Qty</th>
          <th class="num" style="width:15%;">Rate</th>
          <th class="num" style="width:20%;">Amount</th>
        </tr>
      </thead>
      <tbody>{$itemRows}</tbody>
    </table>

    <table class="totals-wrap">
      <tr>
        <td class="left">{$stampHtml}</td>
        <td class="right">
          <table class="totals">
            <tr><td class="label">Subtotal</td><td class="value">&#8377;{$subtotal}</td></tr>
            <tr><td class="label">Tax (GST)</td><td class="value">&#8377;{$gst}</td></tr>
            <tr><td class="grand-label">Total</td><td class="grand-value">&#8377;{$total}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <div class="tax-note">
      <b>Tax note:</b> Not GST registered. Tax not applicable under Section 22 of the CGST Act, 2017.
    </div>

    <table class="pay-wrap">
      <tr>
        <td style="width:42%; padding-right: 18px;">{$qrBlock}</td>
        <td style="width:58%;">{$bankBlock}</td>
      </tr>
    </table>
  </div>

  <div class="footer">{$footerLine}</div>
</div>
</body>
</html>
HTML;
    }
}
