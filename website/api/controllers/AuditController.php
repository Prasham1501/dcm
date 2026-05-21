<?php
declare(strict_types=1);

class AuditController {

    public function index(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 50;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT * FROM audit_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $req->user['account_id'], PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $logs = $stmt->fetchAll();

        $cstmt = db()->prepare("SELECT COUNT(*) FROM audit_logs WHERE account_id = ?");
        $cstmt->execute([$req->user['account_id']]);

        Response::json(['data' => $logs, 'total' => (int)$cstmt->fetchColumn(), 'page' => $page, 'per_page' => $limit]);
    }
}
