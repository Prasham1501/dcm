<?php
declare(strict_types=1);

class PdfInvoice {

    /**
     * Generate a PDF invoice and return the temp file path.
     * $inv  = invoice row from DB
     * $account = account + owner user row
     */
    public function generate(array $inv, array $account): string {
        $html = $this->buildHtml($inv, $account);

        if (class_exists('Dompdf\Dompdf')) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => false]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            $path = sys_get_temp_dir() . '/mv_inv_' . $inv['id'] . '.pdf';
            file_put_contents($path, $dompdf->output());
            return $path;
        }

        // Fallback: save HTML (browser will render it)
        $path = sys_get_temp_dir() . '/mv_inv_' . $inv['id'] . '.html';
        file_put_contents($path, $html);
        return $path;
    }

    private function buildHtml(array $inv, array $account): string {
        $brand      = htmlspecialchars(Settings::get('brand.name', 'Mediview'));
        $brandAddr  = nl2br(htmlspecialchars(Settings::get('brand.address', '')));
        $brandEmail = htmlspecialchars(Settings::get('brand.support_email', ''));
        $brandPhone = htmlspecialchars(Settings::get('brand.phone', ''));
        $upiId      = Settings::get('business.upi_id', '');
        $bankName   = htmlspecialchars(Settings::get('business.bank_name', ''));
        $bankAcc    = htmlspecialchars(Settings::get('business.bank_account', ''));
        $bankIfsc   = htmlspecialchars(Settings::get('business.bank_ifsc', ''));

        $number    = htmlspecialchars($inv['number']);
        $date      = date('d M Y', strtotime($inv['created_at'] ?? 'now'));
        $subtotal  = number_format((float)$inv['subtotal_inr'], 2);
        $total     = number_format((float)$inv['total_inr'], 2);
        $items     = json_decode($inv['items_json'] ?? '[]', true) ?: [];

        $custName  = htmlspecialchars($account['owner_name'] ?? $account['name'] ?? '');
        $custEmail = htmlspecialchars($account['owner_email'] ?? $account['email'] ?? '');

        // Build items table rows
        $itemRows = '';
        foreach ($items as $item) {
            $itemRows .= '<tr>
                <td style="padding:8px 12px;">' . htmlspecialchars($item['name'] ?? '') . '</td>
                <td style="padding:8px 12px;text-align:center;">' . (int)($item['qty'] ?? 1) . '</td>
                <td style="padding:8px 12px;text-align:right;">₹' . number_format((float)($item['rate'] ?? 0), 2) . '</td>
                <td style="padding:8px 12px;text-align:right;">₹' . number_format((float)($item['amount'] ?? 0), 2) . '</td>
            </tr>';
        }

        // UPI QR (if bacon/bacon-qr-code is available)
        $qrImg = '';
        if ($upiId && class_exists('BaconQrCode\Renderer\ImageRenderer')) {
            try {
                $upiString = "upi://pay?pa=$upiId&pn=" . urlencode(Settings::get('brand.name','Mediview')) . "&am={$inv['total_inr']}&tn=" . urlencode("Invoice $number");
                $renderer  = new \BaconQrCode\Renderer\ImageRenderer(
                    new \BaconQrCode\Renderer\RendererStyle\RendererStyle(120),
                    new \BaconQrCode\Renderer\Image\SvgImageBackEnd()
                );
                $writer = new \BaconQrCode\Writer($renderer);
                $svg    = $writer->writeString($upiString);
                $qrImg  = '<img src="data:image/svg+xml;base64,' . base64_encode($svg) . '" width="120" height="120" alt="UPI QR"/>';
            } catch (\Throwable) {}
        }

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; margin: 0; padding: 0; }
    .header { background: #DC2626; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .inv-num { font-size: 14px; opacity: 0.9; }
    .body { padding: 32px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 28px; }
    .meta div { max-width: 48%; }
    .meta h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
    .meta p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: #f1f5f9; }
    thead th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    tbody tr { border-bottom: 1px solid #e2e8f0; }
    .totals { text-align: right; margin-bottom: 28px; }
    .totals table { width: auto; margin-left: auto; }
    .totals td { padding: 4px 12px; }
    .totals .grand { font-weight: bold; font-size: 15px; border-top: 2px solid #1e293b; }
    .gst-note { background: #fefce8; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 6px; font-size: 11px; color: #92400e; margin-bottom: 24px; }
    .payment { display: flex; gap: 24px; border-top: 1px solid #e2e8f0; padding-top: 24px; }
    .bank-details p { margin: 3px 0; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; padding: 16px 32px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>

<div class="header">
  <div>
    <h1>$brand</h1>
    <div class="inv-num">$brandAddr</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:20px;font-weight:bold;">INVOICE</div>
    <div class="inv-num">#$number</div>
    <div class="inv-num">Date: $date</div>
  </div>
</div>

<div class="body">
  <div class="meta">
    <div>
      <h3>From</h3>
      <p><strong>$brand</strong></p>
      <p>$brandEmail</p>
      <p>$brandPhone</p>
    </div>
    <div>
      <h3>Bill To</h3>
      <p><strong>$custName</strong></p>
      <p>$custEmail</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>$itemRows</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>₹$subtotal</td></tr>
      <tr><td>Tax (GST)</td><td>₹0.00</td></tr>
      <tr class="grand"><td>Total</td><td>₹$total</td></tr>
    </table>
  </div>

  <div class="gst-note">
    <strong>Tax Note:</strong> Not GST registered. Tax not applicable under Section 22 of the CGST Act, 2017.
  </div>

  <div class="payment">
    <div>
      $qrImg
      <p style="font-size:11px;color:#64748b;margin-top:4px;">Scan to pay via UPI</p>
    </div>
    <div class="bank-details">
      <h3 style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;">Bank Transfer Details</h3>
      <p><strong>Bank:</strong> $bankName</p>
      <p><strong>Account:</strong> $bankAcc</p>
      <p><strong>IFSC:</strong> $bankIfsc</p>
      <p><strong>UPI:</strong> $upiId</p>
    </div>
  </div>
</div>

<div class="footer">
  Thank you for your business! For queries, contact $brandEmail
</div>

</body>
</html>
HTML;
    }
}
