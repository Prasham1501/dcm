<?php
declare(strict_types=1);

class BugController {

    public function index(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 20;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare("SELECT * FROM bugs WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $req->user['account_id'], PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $bugs = $stmt->fetchAll();

        $cstmt = db()->prepare("SELECT COUNT(*) FROM bugs WHERE account_id = ?");
        $cstmt->execute([$req->user['account_id']]);
        Response::json(['data' => $bugs, 'total' => (int)$cstmt->fetchColumn(), 'page' => $page, 'per_page' => $limit]);
    }

    public function create(Request $req): void {
        $body = $req->body();
        Validator::make($body, [
            'title'       => 'required|min:5|max:255',
            'description' => 'required|min:10',
            'severity'    => 'required|in:low,medium,high,critical',
        ])->throwIfFails();

        $id  = generateId();
        $now = nowDb();

        db()->prepare(
            "INSERT INTO bugs (id, account_id, user_id, title, description, severity, status, attachments, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)"
        )->execute([$id, $req->user['account_id'], $req->user['id'], $body['title'], $body['description'], $body['severity'], 'open', json_encode($body['attachments'] ?? []), $now]);

        AuditLog::fromRequest($req, 'bug.create', $body['title']);

        $adminEmail = Settings::get('brand.support_email');
        if ($adminEmail) {
            Mailer::send($adminEmail, 'Mediview Admin', '[Bug Report] ' . $body['title'], 'email-ticket-reply', [
                'subject'    => '[Bug] ' . $body['title'],
                'from'       => $req->user['name'] ?? 'User',
                'message'    => "Severity: {$body['severity']}\n\n{$body['description']}",
                'ticket_url' => rtrim(getenv('APP_URL'), '/') . '/admin.html#/admin/bugs',
            ]);
        }

        $stmt = db()->prepare("SELECT * FROM bugs WHERE id = ?");
        $stmt->execute([$id]);
        Response::json($stmt->fetch(), 201);
    }
}
