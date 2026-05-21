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

        $prefix = $this->accountPrefix($req->user['account_id']);
        $sStmt = db()->prepare("SELECT `key`, `value` FROM settings WHERE `key` LIKE ?");
        $sStmt->execute([$prefix . '%']);
        $settings = [];
        foreach ($sStmt->fetchAll() as $row) {
            $settings[substr($row['key'], strlen($prefix))] = $row['value'];
        }
        $settings['account_name'] = $account['name'] ?? '';

        Response::json(['user' => $user, 'account' => $account, 'settings' => $settings]);
    }

    public function update(Request $req): void {
        $body = $req->body();
        $allowed = [
            'account_name',
            'profile.phone','profile.specialty',
            'org.name','org.address','org.phone','org.website','org.print_header',
            'billing.entity','billing.gstin','billing.state','billing.pan',
            'notifications.low_print','notifications.low_ai','notifications.ticket','notifications.weekly','notifications.marketing',
            'prefs.paper_size','prefs.modality','prefs.date_format','prefs.language',
        ];

        $prefix = $this->accountPrefix($req->user['account_id']);
        $saved = 0;

        foreach ($allowed as $key) {
            if (!array_key_exists($key, $body)) continue;
            $value = is_bool($body[$key]) ? ($body[$key] ? '1' : '0') : (string)$body[$key];
            if ($key === 'account_name' || $key === 'org.name') {
                $accountName = trim($value);
                if ($accountName !== '') {
                    db()->prepare("UPDATE accounts SET name=?, updated_at=? WHERE id=?")
                        ->execute([$accountName, nowDb(), $req->user['account_id']]);
                }
            }
            Settings::set($prefix . $key, $value, $req->user['id']);
            $saved++;
        }

        if (isset($body['profile.name'])) {
            $name = trim((string)$body['profile.name']);
            if ($name !== '') {
                db()->prepare("UPDATE users SET name=?, updated_at=? WHERE id=?")
                    ->execute([$name, nowDb(), $req->user['id']]);
                $saved++;
            }
        }

        Settings::invalidate();
        AuditLog::fromRequest($req, 'settings.save', $saved . ' setting(s)');
        Response::ok(['saved' => $saved]);
    }

    private function accountPrefix(string $accountId): string {
        return 'acct.' . $accountId . '.';
    }
}
