<?php
declare(strict_types=1);

class InvoiceController {

    public function index(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 20;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT * FROM invoices WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $req->user['account_id'], PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $invoices = $stmt->fetchAll();

        $cstmt = db()->prepare("SELECT COUNT(*) FROM invoices WHERE account_id = ?");
        $cstmt->execute([$req->user['account_id']]);
        $total = (int)$cstmt->fetchColumn();

        Response::json(['data' => $invoices, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function pdf(Request $req): void {
        $invId = $req->param('id');
        $stmt  = db()->prepare("SELECT * FROM invoices WHERE id = ? AND account_id = ?");
        $stmt->execute([$invId, $req->user['account_id']]);
        $inv = $stmt->fetch();
        if (!$inv) Response::error('Invoice not found', 404);

        $aStmt = db()->prepare(
            "SELECT a.*, u.name as owner_name, u.email as owner_email
             FROM accounts a JOIN users u ON u.account_id=a.id AND u.role='admin'
             WHERE a.id=? LIMIT 1"
        );
        $aStmt->execute([$req->user['account_id']]);
        $account = $aStmt->fetch() ?: [];

        try {
            $pdf  = new PdfInvoice();
            $path = $pdf->generate($inv, $account);
        } catch (\Throwable $e) {
            error_log('[InvoiceController/pdf] PdfInvoice::generate failed: ' . $e->getMessage());
            $path = null;
        }

        if (!$path || !file_exists($path)) Response::error('PDF generation failed', 500);

        // Inspect actual file bytes — don't trust the extension. Dompdf can
        // silently return original HTML on some hosts (missing extensions etc.)
        // so we verify the "%PDF" magic before declaring this a real PDF.
        $head    = (string)file_get_contents($path, false, null, 0, 5);
        $isRealPdf = str_starts_with($head, '%PDF-');

        if ($isRealPdf) {
            Response::pdf($path, $inv['number'] . '.pdf');
        }

        // Fallback: serve the HTML and let the browser print → save as PDF.
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: private, no-cache');
        readfile($path);
        echo '<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>';
        exit;
    }
}
