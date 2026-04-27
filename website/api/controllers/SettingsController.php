<?php
declare(strict_types=1);

class SettingsController {

    /** User-facing settings (name, notification prefs, etc.) */
    public function index(Request $req): void {
        $stmt = db()->prepare("SELECT name, email, role, email_verified, created_at, last_login_at FROM users WHERE id = ?");
        $stmt->execute([$req->user['id']]);
        $user = $stmt->fetch();

        $aStmt = db()->prepare("SELECT name, plan, status FROM accounts WHERE id = ?");
        $aStmt->execute([$req->user['account_id']]);
        $account = $aStmt->fetch();

        Response::json(['user' => $user, 'account' => $account]);
    }

    public function update(Request $req): void {
        $body = $req->body();
        $accountName = trim($body['account_name'] ?? '');

        if ($accountName) {
            db()->prepare("UPDATE accounts SET name=? WHERE id=?")->execute([$accountName, $req->user['account_id']]);
        }

        Response::ok();
    }
}
