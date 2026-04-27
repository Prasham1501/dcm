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
        $stmt->execute([$req->user['account_id'], $limit, $off]);
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

        $pdf  = new PdfInvoice();
        $path = $pdf->generate($inv, $account);

        if (!$path || !file_exists($path)) Response::error('PDF generation failed', 500);
        Response::pdf($path, $inv['number'] . '.pdf');
    }
}
