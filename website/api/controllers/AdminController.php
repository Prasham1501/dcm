<?php
declare(strict_types=1);

class AdminController {

    public function overview(Request $req): void {
        $now  = time();
        $ago5m  = gmdate('Y-m-d H:i:s', $now - 5   * 60);
        $ago24h = gmdate('Y-m-d H:i:s', $now - 24  * 3600);
        $ago7d  = gmdate('Y-m-d H:i:s', $now - 7   * 86400);
        $ago30d = gmdate('Y-m-d H:i:s', $now - 30  * 86400);
        $in7d   = gmdate('Y-m-d H:i:s', $now + 7   * 86400);

        $stats = [];
        $stats['total_accounts']  = (int)db()->query("SELECT COUNT(*) FROM accounts WHERE id != 'acc_superadmin00'")->fetchColumn();
        $stats['total_licenses']  = (int)db()->query("SELECT COUNT(*) FROM licenses")->fetchColumn();
        $stats['active_licenses'] = (int)db()->query("SELECT COUNT(*) FROM licenses WHERE status='active'")->fetchColumn();
        $stats['total_revenue']   = (float)db()->query("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status IN ('captured','manual')")->fetchColumn();
        $stats['open_tickets']    = (int)db()->query("SELECT COUNT(*) FROM tickets WHERE status='open'")->fetchColumn();

        // Fleet device counts — total ever activated, currently active, online (5min),
        // active within last 24h, dormant >7d.
        $stats['total_devices']    = (int)db()->query("SELECT COUNT(*) FROM devices WHERE status='active'")->fetchColumn();
        $st1 = db()->prepare("SELECT COUNT(*) FROM devices WHERE status='active' AND last_heartbeat_at >= ?");
        $st1->execute([$ago5m]);   $stats['devices_online']      = (int)$st1->fetchColumn();
        $st1->execute([$ago24h]);  $stats['devices_active_24h']  = (int)$st1->fetchColumn();
        $st2 = db()->prepare("SELECT COUNT(*) FROM devices WHERE status='active' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < ?)");
        $st2->execute([$ago7d]);   $stats['devices_dormant_7d']  = (int)$st2->fetchColumn();

        // Revenue
        $rev30 = db()->prepare("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status IN ('captured','manual') AND COALESCE(captured_at, created_at) >= ?");
        $rev30->execute([$ago30d]);
        $stats['revenue_30d'] = (float)$rev30->fetchColumn();

        // New accounts last 30d
        $new30 = db()->prepare("SELECT COUNT(*) FROM accounts WHERE created_at >= ? AND id != 'acc_superadmin00'");
        $new30->execute([$ago30d]);
        $stats['new_accounts_30d'] = (int)$new30->fetchColumn();

        // Licenses expiring within 7 days
        $exp = db()->prepare("SELECT COUNT(*) FROM licenses WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= ?");
        $exp->execute([$in7d]);
        $stats['licenses_expiring_7d'] = (int)$exp->fetchColumn();

        // App-version distribution across active devices
        $verRows = db()->query(
            "SELECT COALESCE(NULLIF(app_version, ''), 'unknown') AS version, COUNT(*) AS n
             FROM devices WHERE status='active'
             GROUP BY version ORDER BY n DESC LIMIT 8"
        )->fetchAll();
        $stats['version_distribution'] = array_map(fn($r) => ['version' => $r['version'], 'count' => (int)$r['n']], $verRows);

        // OS distribution across active devices
        $osRows = db()->query(
            "SELECT COALESCE(NULLIF(os, ''), 'unknown') AS os, COUNT(*) AS n
             FROM devices WHERE status='active'
             GROUP BY os ORDER BY n DESC LIMIT 8"
        )->fetchAll();
        $stats['os_distribution'] = array_map(fn($r) => ['os' => $r['os'], 'count' => (int)$r['n']], $osRows);

        // Top 5 accounts by active devices (most heavily deployed)
        $top = db()->query(
            "SELECT a.id, a.name,
                    (SELECT email FROM users WHERE account_id=a.id AND role='admin' LIMIT 1) AS owner_email,
                    (SELECT COUNT(*) FROM devices WHERE account_id=a.id AND status='active') AS active_devices
             FROM accounts a
             WHERE a.id != 'acc_superadmin00'
             ORDER BY active_devices DESC LIMIT 5"
        )->fetchAll();
        $stats['top_accounts'] = array_map(fn($r) => [
            'id' => $r['id'], 'name' => $r['name'],
            'owner_email' => $r['owner_email'],
            'active_devices' => (int)$r['active_devices'],
        ], $top);

        Response::json($stats);
    }

    /**
     * GET /admin/devices — fleet view of every Mediview install.
     * Filterable by status / online / version / account / search term.
     * The single most important admin view: shows where the software lives,
     * when it last phoned home, which version it's running, and who owns it.
     */
    public function devices(Request $req): void {
        $page   = max(1, (int)$req->query('page', 1));
        $limit  = 50;
        $off    = ($page - 1) * $limit;
        $status = (string)$req->query('status', '');        // active|deactivated|''
        $online = (string)$req->query('online', '');        // 1=online now (heartbeat<5m), 0=offline, ''=all
        $q      = trim((string)$req->query('q', ''));
        $ago5m  = gmdate('Y-m-d H:i:s', time() - 5 * 60);

        $where  = ['1=1'];
        $params = [];
        if ($status !== '') { $where[] = 'd.status = ?';                 $params[] = $status; }
        if ($online === '1') { $where[] = 'd.last_heartbeat_at >= ?';     $params[] = $ago5m; }
        if ($online === '0') { $where[] = '(d.last_heartbeat_at IS NULL OR d.last_heartbeat_at < ?)'; $params[] = $ago5m; }
        if ($q !== '') {
            $where[] = '(d.machine_name LIKE ? OR d.last_ip LIKE ? OR a.name LIKE ?
                         OR (SELECT email FROM users WHERE account_id=a.id AND role=\'admin\' LIMIT 1) LIKE ?
                         OR l.key_code LIKE ?)';
            $like = "%$q%";
            $params = array_merge($params, [$like, $like, $like, $like, $like]);
        }
        $whereSql = implode(' AND ', $where);

        $sql =
            "SELECT d.*,
                    a.name AS account_name,
                    (SELECT email FROM users WHERE account_id=a.id AND role='admin' LIMIT 1) AS owner_email,
                    l.key_code, l.plan AS license_plan, l.status AS license_status, l.expires_at AS license_expires_at,
                    CASE WHEN d.last_heartbeat_at >= ? THEN 1 ELSE 0 END AS is_online
             FROM devices d
             LEFT JOIN accounts a ON a.id = d.account_id
             LEFT JOIN licenses l ON l.id = d.license_id
             WHERE $whereSql
             ORDER BY (d.last_heartbeat_at IS NULL), d.last_heartbeat_at DESC, d.activated_at DESC
             LIMIT ? OFFSET ?";

        $stmt = db()->prepare($sql);
        $bindIdx = 1;
        $stmt->bindValue($bindIdx++, $ago5m, PDO::PARAM_STR); // is_online cutoff
        foreach ($params as $p) $stmt->bindValue($bindIdx++, $p, PDO::PARAM_STR);
        $stmt->bindValue($bindIdx++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($bindIdx,   $off,   PDO::PARAM_INT);
        $stmt->execute();
        $devices = $stmt->fetchAll();

        // Count for pagination
        $countSql = "SELECT COUNT(*) FROM devices d
                     LEFT JOIN accounts a ON a.id = d.account_id
                     LEFT JOIN licenses l ON l.id = d.license_id
                     WHERE $whereSql";
        $cnt = db()->prepare($countSql);
        $i = 1;
        foreach ($params as $p) $cnt->bindValue($i++, $p, PDO::PARAM_STR);
        $cnt->execute();
        $total = (int)$cnt->fetchColumn();

        Response::json(['data' => $devices, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    /** Admin force-deactivate a single device. */
    public function deactivateDevice(Request $req): void {
        $id = $req->param('id');
        db()->prepare("UPDATE devices SET status='deactivated', deactivated_at=? WHERE id=?")
            ->execute([nowDb(), $id]);
        AuditLog::fromRequest($req, 'admin.device.deactivate', $id);
        Response::ok();
    }

    /** Drill-down on a single account — everything we know about it. */
    public function accountDetail(Request $req): void {
        $id = $req->param('id');
        $acc = db()->prepare("SELECT * FROM accounts WHERE id=?");
        $acc->execute([$id]);
        $account = $acc->fetch();
        if (!$account) Response::error('Account not found', 404);

        $u = db()->prepare("SELECT id, name, email, role, email_verified, last_login_at, created_at FROM users WHERE account_id=?");
        $u->execute([$id]); $users = $u->fetchAll();

        $l = db()->prepare(
            "SELECT l.*, (SELECT COUNT(*) FROM devices d WHERE d.license_id=l.id AND d.status='active') AS seats_used
             FROM licenses l WHERE l.account_id=? ORDER BY l.created_at DESC"
        );
        $l->execute([$id]); $licenses = $l->fetchAll();

        $d = db()->prepare(
            "SELECT d.*, l.key_code FROM devices d LEFT JOIN licenses l ON l.id=d.license_id
             WHERE d.account_id=? ORDER BY d.last_heartbeat_at DESC"
        );
        $d->execute([$id]); $devices = $d->fetchAll();

        $w = db()->prepare("SELECT type, balance FROM wallets WHERE account_id=?");
        $w->execute([$id]);
        $wallets = [];
        foreach ($w->fetchAll() as $row) $wallets[$row['type']] = (int)$row['balance'];

        $p = db()->prepare("SELECT * FROM payments WHERE account_id=? ORDER BY created_at DESC LIMIT 10");
        $p->execute([$id]); $payments = $p->fetchAll();

        $a = db()->prepare("SELECT * FROM audit_logs WHERE account_id=? ORDER BY created_at DESC LIMIT 20");
        $a->execute([$id]); $audit = $a->fetchAll();

        Response::json([
            'account'  => $account,
            'users'    => $users,
            'licenses' => $licenses,
            'devices'  => $devices,
            'wallets'  => $wallets,
            'payments' => $payments,
            'audit'    => $audit,
        ]);
    }

    // ───────── ACCOUNT lifecycle ─────────

    public function suspendAccount(Request $req): void {
        $id = $req->param('id');
        $pdo = db(); $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE accounts SET status='suspended' WHERE id=?")->execute([$id]);
            $pdo->prepare("UPDATE licenses SET status='suspended' WHERE account_id=? AND status='active'")->execute([$id]);
            $pdo->prepare("UPDATE devices  SET status='deactivated', deactivated_at=? WHERE account_id=? AND status='active'")
                ->execute([nowDb(), $id]);
            $pdo->commit();
        } catch (\Throwable $e) { $pdo->rollBack(); Response::error('Failed to suspend account.', 500); }
        AuditLog::fromRequest($req, 'admin.account.suspend', $id);
        Response::ok();
    }

    public function resumeAccount(Request $req): void {
        $id = $req->param('id');
        $pdo = db(); $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE accounts SET status='active' WHERE id=?")->execute([$id]);
            $pdo->prepare("UPDATE licenses SET status='active' WHERE account_id=? AND status='suspended'")->execute([$id]);
            $pdo->commit();
        } catch (\Throwable $e) { $pdo->rollBack(); Response::error('Failed to resume account.', 500); }
        AuditLog::fromRequest($req, 'admin.account.resume', $id);
        Response::ok();
    }

    public function deleteAccount(Request $req): void {
        $id = $req->param('id');
        if ($id === 'acc_superadmin00') Response::error('Cannot delete super-admin account', 400);
        $pdo = db(); $pdo->beginTransaction();
        try {
            foreach (['devices','licenses','wallets','transactions','payments','invoices','tickets','ticket_messages','bugs','referrals','api_keys','audit_logs','users','accounts'] as $t) {
                $col = $t === 'accounts' ? 'id' : 'account_id';
                try { $pdo->prepare("DELETE FROM $t WHERE $col = ?")->execute([$id]); } catch (\Throwable $e) {}
            }
            $pdo->commit();
        } catch (\Throwable $e) { $pdo->rollBack(); Response::error('Failed to delete account: ' . $e->getMessage(), 500); }
        AuditLog::fromRequest($req, 'admin.account.delete', $id);
        Response::ok();
    }

    // ───────── LICENSE superpowers ─────────

    /** Extend an active license by ±N days. Negative shrinks. */
    public function extendLicense(Request $req): void {
        $id   = $req->param('id');
        $days = (int)($req->body()['days'] ?? 0);
        if ($days === 0) Response::error('days must be non-zero', 400);

        $stmt = db()->prepare("SELECT expires_at FROM licenses WHERE id=?");
        $stmt->execute([$id]); $row = $stmt->fetch();
        if (!$row) Response::error('License not found', 404);

        $base = $row['expires_at'] ? strtotime($row['expires_at']) : time();
        // If already expired, extend from now rather than from old date.
        if ($base < time()) $base = time();
        $newExp = gmdate('Y-m-d H:i:s', $base + ($days * 86400));

        db()->prepare("UPDATE licenses SET expires_at=?, status='active' WHERE id=?")
            ->execute([$newExp, $id]);
        AuditLog::fromRequest($req, 'admin.license.extend', $id, ['days' => $days, 'new_expires_at' => $newExp]);
        Response::ok(['expires_at' => $newExp]);
    }

    /** Move a license from its current account to another. Detaches devices. */
    public function transferLicense(Request $req): void {
        $id     = $req->param('id');
        $target = trim((string)($req->body()['account_id'] ?? ''));
        if (!$target) Response::error('account_id required', 400);

        $acc = db()->prepare("SELECT id FROM accounts WHERE id=?");
        $acc->execute([$target]);
        if (!$acc->fetch()) Response::error('Target account not found', 404);

        $pdo = db(); $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE licenses SET account_id=? WHERE id=?")->execute([$target, $id]);
            // Drop existing seat bindings — new owner activates their own devices.
            $pdo->prepare("UPDATE devices SET status='deactivated', deactivated_at=? WHERE license_id=? AND status='active'")
                ->execute([nowDb(), $id]);
            $pdo->commit();
        } catch (\Throwable $e) { $pdo->rollBack(); Response::error('Failed to transfer.', 500); }
        AuditLog::fromRequest($req, 'admin.license.transfer', $id, ['new_account_id' => $target]);
        Response::ok();
    }

    /** Issue a new key_code and revoke the old one. Use after key compromise. */
    public function regenerateLicense(Request $req): void {
        $id   = $req->param('id');
        $stmt = db()->prepare("SELECT * FROM licenses WHERE id=?");
        $stmt->execute([$id]); $row = $stmt->fetch();
        if (!$row) Response::error('License not found', 404);

        $newKey = LicenseKey::generate();
        $hmac   = LicenseKey::sign($newKey, ['plan' => $row['plan'], 'seats' => (int)$row['seats'], 'account' => $row['account_id']]);

        $pdo = db(); $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE licenses SET key_code=?, hmac_signature=? WHERE id=?")->execute([$newKey, $hmac, $id]);
            $pdo->prepare("UPDATE devices SET status='deactivated', deactivated_at=? WHERE license_id=? AND status='active'")
                ->execute([nowDb(), $id]);
            $pdo->commit();
        } catch (\Throwable $e) { $pdo->rollBack(); Response::error('Failed to regenerate.', 500); }
        AuditLog::fromRequest($req, 'admin.license.regenerate', $id, ['new_key' => $newKey]);
        Response::ok(['key_code' => $newKey]);
    }

    /** Free a single seat without revoking the whole license. */
    public function unbindSeat(Request $req): void {
        $id = $req->param('id'); // device id
        db()->prepare("UPDATE devices SET status='deactivated', deactivated_at=? WHERE id=?")
            ->execute([nowDb(), $id]);
        AuditLog::fromRequest($req, 'admin.license.unbind_seat', $id);
        Response::ok();
    }

    // ───────── WALLET adjustments (no invoice) ─────────

    /**
     * Credit or debit any account's wallet manually. NO invoice is generated
     * (per spec) — adjustments are tracked in the transactions table with
     * kind='adjust' and the admin's reason. Money transactions still create
     * invoices in WalletController::verify and the auto-provision path.
     */
    public function adjustWallet(Request $req): void {
        $b      = $req->body();
        $acc    = trim((string)($b['account_id'] ?? ''));
        $type   = (string)($b['type'] ?? 'print');
        // Accept either `delta` (new canonical) or `amount` (legacy UI).
        $delta  = (int)($b['delta'] ?? $b['amount'] ?? 0);
        $reason = trim((string)($b['reason'] ?? ''));

        if (!$acc)                                      Response::error('account_id required', 400);
        if (!in_array($type, ['print','ai'], true))     Response::error('type must be print|ai', 400);
        if ($delta === 0)                               Response::error('delta must be non-zero', 400);
        if ($reason === '') $reason = 'Admin adjustment';

        $pdo = db(); $pdo->beginTransaction();
        try {
            // Capture previous balance so the UI can show "X → Y".
            $prevStmt = $pdo->prepare("SELECT balance FROM wallets WHERE account_id=? AND type=?");
            $prevStmt->execute([$acc, $type]);
            $prevBal = (int)($prevStmt->fetchColumn() ?: 0);

            // Upsert balance
            $pdo->prepare("INSERT INTO wallets (account_id, type, balance) VALUES (?,?,GREATEST(0, ?))
                           ON DUPLICATE KEY UPDATE balance = GREATEST(0, balance + ?)")
                ->execute([$acc, $type, $delta, $delta]);

            $wStmt = $pdo->prepare("SELECT balance FROM wallets WHERE account_id=? AND type=?");
            $wStmt->execute([$acc, $type]);
            $newBal = (int)$wStmt->fetchColumn();

            $pdo->prepare(
                "INSERT INTO transactions (id, account_id, wallet_type, kind, credits_delta, balance_after, meta, created_at)
                 VALUES (?,?,?,?,?,?,?,?)"
            )->execute([generateId(), $acc, $type, 'adjust', $delta, $newBal, '[admin] ' . $reason, nowDb()]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Admin/adjustWallet] ' . $e->getMessage());
            Response::error('Failed to adjust wallet.', 500);
        }
        AuditLog::fromRequest($req, 'admin.wallet.adjust', "$acc:$type:$delta", ['reason' => $reason]);
        Response::json(['ok' => true, 'balance' => $newBal, 'previous' => $prevBal]);
    }

    // ───────── REVENUE ─────────

    public function revenue(Request $req): void {
        $range = (string)$req->query('range', '30d');
        $days  = ['7d' => 7, '30d' => 30, '90d' => 90, '12mo' => 365][$range] ?? 30;
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

        $total = (float)db()->query("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status IN ('captured')")
                            ->fetchColumn();
        $totalManual = (float)db()->query("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status='manual'")
                                  ->fetchColumn();

        $rangeStmt = db()->prepare("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status='captured' AND COALESCE(captured_at, created_at) >= ?");
        $rangeStmt->execute([$since]);
        $rangeTotal = (float)$rangeStmt->fetchColumn();

        $byPlan = db()->query(
            "SELECT COALESCE(NULLIF(purpose, ''), 'unknown') AS purpose, COUNT(*) AS n, COALESCE(SUM(amount_inr),0) AS total
             FROM payments WHERE status='captured' GROUP BY purpose ORDER BY total DESC"
        )->fetchAll();

        // Daily revenue (last $days days)
        $daily = [];
        $dStmt = db()->prepare(
            "SELECT DATE(COALESCE(captured_at, created_at)) AS day, COALESCE(SUM(amount_inr),0) AS total
             FROM payments WHERE status='captured' AND COALESCE(captured_at, created_at) >= ?
             GROUP BY day ORDER BY day"
        );
        $dStmt->execute([$since]);
        foreach ($dStmt->fetchAll() as $r) $daily[] = ['day' => $r['day'], 'total' => (float)$r['total']];

        // Recent payments
        $recent = db()->query(
            "SELECT p.id, p.amount_inr, p.status, p.purpose, p.created_at, p.captured_at,
                    a.name AS account_name,
                    (SELECT email FROM users WHERE account_id=p.account_id AND role='admin' LIMIT 1) AS owner_email
             FROM payments p LEFT JOIN accounts a ON a.id=p.account_id
             ORDER BY p.created_at DESC LIMIT 50"
        )->fetchAll();

        Response::json([
            'range'         => $range,
            'total_paid'    => $total,
            'total_manual'  => $totalManual,
            'range_total'   => $rangeTotal,
            'by_purpose'    => $byPlan,
            'daily'         => $daily,
            'recent'        => $recent,
        ]);
    }

    // ───────── RELEASES (force-update) ─────────

    private function ensureReleasesTable(): void {
        db()->exec(
            "CREATE TABLE IF NOT EXISTS releases (
                id            VARCHAR(40)  PRIMARY KEY,
                app           VARCHAR(20)  NOT NULL,
                version       VARCHAR(40)  NOT NULL,
                file_name     VARCHAR(255) NOT NULL,
                file_size     BIGINT       NOT NULL DEFAULT 0,
                changelog     TEXT,
                force_update  TINYINT      NOT NULL DEFAULT 0,
                uploaded_by   VARCHAR(40),
                created_at    DATETIME     NOT NULL,
                INDEX idx_app_created (app, created_at),
                INDEX idx_app_version (app, version)
            )"
        );
    }

    private function releasesDir(): string {
        $dir = __DIR__ . '/../../uploads/releases';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        return $dir;
    }

    public function listReleases(Request $req): void {
        $this->ensureReleasesTable();
        $rows = db()->query("SELECT * FROM releases ORDER BY created_at DESC LIMIT 200")->fetchAll();
        Response::json(['data' => $rows]);
    }

    /** Multipart upload: fields = app (viewer|bridge), version, changelog, force_update; file = installer. */
    public function uploadRelease(Request $req): void {
        $this->ensureReleasesTable();
        $app     = (string)($_POST['app']     ?? '');
        $version = trim((string)($_POST['version'] ?? ''));
        $changes = (string)($_POST['changelog'] ?? '');
        $force   = !empty($_POST['force_update']) ? 1 : 0;

        if (!in_array($app, ['viewer','bridge'], true)) Response::error('app must be viewer or bridge', 400);
        if (!preg_match('/^\d+\.\d+\.\d+(-[0-9A-Za-z\.\-]+)?$/', $version)) Response::error('version must be semver (e.g. 1.2.3)', 400);
        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) Response::error('installer file required', 400);

        $up   = $_FILES['file'];
        $safe = $app . '-' . $version . '-' . substr(bin2hex(random_bytes(4)),0,8) . '-' . preg_replace('/[^A-Za-z0-9._-]/','_', basename($up['name']));
        $dest = $this->releasesDir() . '/' . $safe;
        if (!move_uploaded_file($up['tmp_name'], $dest)) Response::error('Could not store uploaded file', 500);

        $id = generateId();
        db()->prepare(
            "INSERT INTO releases (id, app, version, file_name, file_size, changelog, force_update, uploaded_by, created_at)
             VALUES (?,?,?,?,?,?,?,?,?)"
        )->execute([$id, $app, $version, $safe, filesize($dest), $changes, $force, $req->user['id'] ?? null, nowDb()]);

        AuditLog::fromRequest($req, 'admin.release.upload', "$app:$version", ['force' => $force, 'size' => filesize($dest)]);
        Response::json(['ok' => true, 'id' => $id, 'app' => $app, 'version' => $version, 'force_update' => (bool)$force]);
    }

    public function deleteRelease(Request $req): void {
        $this->ensureReleasesTable();
        $id = $req->param('id');
        $stmt = db()->prepare("SELECT file_name FROM releases WHERE id=?");
        $stmt->execute([$id]); $row = $stmt->fetch();
        if ($row && $row['file_name']) @unlink($this->releasesDir() . '/' . $row['file_name']);
        db()->prepare("DELETE FROM releases WHERE id=?")->execute([$id]);
        AuditLog::fromRequest($req, 'admin.release.delete', $id);
        Response::ok();
    }

    /**
     * PUBLIC endpoint hit by every desktop install on launch + every 30 min.
     * Returns {latest_version, download_url, force_update, changelog, current_is_outdated}.
     * Compares semver of `?current=X.Y.Z` to the newest release for `?app=`.
     */
    public function releaseCheck(Request $req): void {
        $this->ensureReleasesTable();
        $app     = (string)$req->query('app', 'viewer');
        $current = (string)$req->query('current', '0.0.0');

        if (!in_array($app, ['viewer','bridge'], true)) Response::error('Invalid app', 400);

        $stmt = db()->prepare("SELECT * FROM releases WHERE app=? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$app]);
        $latest = $stmt->fetch();

        if (!$latest) {
            Response::json(['app' => $app, 'has_update' => false]);
        }

        $cmp = version_compare($current, $latest['version']);
        $base = rtrim((string)getenv('APP_URL'), '/') ?: 'https://' . ($_SERVER['HTTP_HOST'] ?? '');
        $downloadUrl = $base . '/api/release/download/' . $latest['id'];

        Response::json([
            'app'                => $app,
            'current_version'    => $current,
            'latest_version'     => $latest['version'],
            'has_update'         => $cmp < 0,
            'force_update'       => (bool)$latest['force_update'],
            'changelog'          => $latest['changelog'] ?? '',
            'download_url'       => $downloadUrl,
            'file_size'          => (int)$latest['file_size'],
            'released_at'        => $latest['created_at'],
        ]);
    }

    /** PUBLIC: stream the installer file by release id. */
    public function releaseDownload(Request $req): void {
        $this->ensureReleasesTable();
        $id   = $req->param('id');
        $stmt = db()->prepare("SELECT * FROM releases WHERE id=?");
        $stmt->execute([$id]); $row = $stmt->fetch();
        if (!$row) Response::error('Release not found', 404);
        $path = $this->releasesDir() . '/' . $row['file_name'];
        if (!file_exists($path)) Response::error('File missing on server', 404);

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($row['file_name']) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, no-cache');
        readfile($path);
        exit;
    }

    public function accounts(Request $req): void {
        $page   = max(1, (int)$req->query('page', 1));
        $limit  = 25;
        $off    = ($page - 1) * $limit;
        $search = $req->query('q', '');

        $subselect = "(SELECT email FROM users WHERE account_id=a.id AND role='admin' LIMIT 1) as owner_email,
                      (SELECT name  FROM users WHERE account_id=a.id AND role='admin' LIMIT 1) as owner_name,
                      (SELECT COUNT(*) FROM licenses WHERE account_id=a.id) as licenses,
                      (SELECT COUNT(*) FROM devices  WHERE account_id=a.id AND status='active') as active_devices";

        if ($search) {
            $like = "%$search%";
            $stmt = db()->prepare(
                "SELECT a.*, $subselect
                 FROM accounts a
                 WHERE a.id != 'acc_superadmin00'
                   AND (a.name LIKE ?
                        OR (SELECT email FROM users WHERE account_id=a.id AND role='admin' LIMIT 1) LIKE ?)
                 ORDER BY a.created_at DESC LIMIT ? OFFSET ?"
            );
            $stmt->bindValue(1, $like,  PDO::PARAM_STR);
            $stmt->bindValue(2, $like,  PDO::PARAM_STR);
            $stmt->bindValue(3, $limit, PDO::PARAM_INT);
            $stmt->bindValue(4, $off,   PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = db()->prepare(
                "SELECT a.*, $subselect
                 FROM accounts a
                 WHERE a.id != 'acc_superadmin00'
                 ORDER BY a.created_at DESC LIMIT ? OFFSET ?"
            );
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(2, $off,   PDO::PARAM_INT);
            $stmt->execute();
        }
        $accounts = $stmt->fetchAll();

        $total = (int)db()->query("SELECT COUNT(*) FROM accounts WHERE id != 'acc_superadmin00'")->fetchColumn();
        Response::json(['data' => $accounts, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function licenses(Request $req): void {
        $this->ensureLicenseQuotaColumns(); // ensures quota_* columns exist
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT l.*,
                    (SELECT name  FROM accounts WHERE id=l.account_id LIMIT 1) as account_name,
                    (SELECT email FROM users    WHERE account_id=l.account_id AND role='admin' LIMIT 1) as owner_email,
                    (SELECT COUNT(*) FROM devices WHERE license_id=l.id AND status='active') as seats_used
             FROM licenses l
             ORDER BY l.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $licenses = $stmt->fetchAll();
        $total = (int)db()->query("SELECT COUNT(*) FROM licenses")->fetchColumn();
        Response::json(['data' => $licenses, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function revokeLicense(Request $req): void {
        $id = $req->param('id');
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $pdo->prepare("UPDATE licenses SET status='revoked' WHERE id=?")->execute([$id]);
            // Force every device under this license offline so the next heartbeat fails.
            $devs = $pdo->prepare(
                "UPDATE devices SET status='deactivated', deactivated_at=? WHERE license_id=? AND status='active'"
            );
            $devs->execute([nowDb(), $id]);
            $deactivatedCount = $devs->rowCount();
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Admin/revokeLicense] ' . $e->getMessage());
            Response::error('Failed to revoke license.', 500);
        }
        AuditLog::fromRequest($req, 'admin.license.revoke', $id, ['devices_deactivated' => $deactivatedCount]);
        Response::ok(['devices_deactivated' => $deactivatedCount]);
    }

    /** POST /admin/licenses/issue — create a license key manually.
     *
     *  Manual super-admin issuance is liberal about the "Account ID" field:
     *  - if it matches an existing account.id, use it;
     *  - else if it matches an existing account.name, use that account;
     *  - else auto-create a new account using the typed string as its name.
     *  This lets the operator issue keys to walk-ins / phone orders without
     *  needing the client to sign up first. */
    public function issueLicense(Request $req): void {
        $body    = $req->body();
        $plan    = $body['plan'] ?? 'trial';
        $seats   = max(1, (int)($body['seats'] ?? 1));
        $days    = max(1, (int)($body['days']  ?? 30));
        $product = in_array(($body['product'] ?? 'viewer'), ['viewer', 'bridge'], true) ? $body['product'] : 'viewer';
        // Manual revenue capture — let the operator log the actual amount
        // collected (cash, UPI, bank transfer, cheque, etc.) so it flows
        // into the dashboard alongside Razorpay-captured payments.
        $paymentAmount = max(0, (int)round((float)($body['payment_amount'] ?? 0)));
        $paymentMethod = in_array(($body['payment_method'] ?? 'manual'), ['manual','cash','upi','bank_transfer','cheque','razorpay','other'], true)
                          ? $body['payment_method'] : 'manual';
        $paymentNote   = trim((string)($body['payment_note'] ?? ''));
        $raw           = trim((string)($body['account_id'] ?? $req->user['account_id']));
        if ($raw === '') Response::error('Please enter an account name or ID', 400);

        // 1) try as account id
        $accStmt = db()->prepare("SELECT id, name FROM accounts WHERE id = ?");
        $accStmt->execute([$raw]);
        $account = $accStmt->fetch();

        // 2) try as account name
        if (!$account) {
            $byName = db()->prepare("SELECT id, name FROM accounts WHERE name = ? LIMIT 1");
            $byName->execute([$raw]);
            $account = $byName->fetch();
        }

        // 3) auto-create — manual licenses don't require a pre-existing account
        if (!$account) {
            $newId = generateId();
            db()->prepare(
                "INSERT INTO accounts (id, name, plan, status, created_at) VALUES (?,?,?,?,?)"
            )->execute([$newId, $raw, 'free', 'active', nowDb()]);
            $account = ['id' => $newId, 'name' => $raw];
            AuditLog::fromRequest($req, 'admin.account.autocreate', $newId, ['name' => $raw, 'reason' => 'manual_license_issue']);
        }
        $accountId = $account['id'];

        // Ensure the licenses table has the product column (added with the
        // Bridge launch). Safe to call repeatedly.
        $this->ensureLicenseProductColumn();
        // Quota columns (sell-by-print model) — same lazy migration.
        $this->ensureLicenseQuotaColumns();

        $keyCode = LicenseKey::generate();
        $now     = nowDb();
        $expires = gmdate('Y-m-d H:i:s', time() + $days * 86400);
        $hmac    = LicenseKey::sign($keyCode, ['plan' => $plan, 'seats' => $seats, 'account' => $accountId, 'product' => $product]);
        $licId   = generateId();

        db()->prepare(
            "INSERT INTO licenses (id, account_id, key_code, plan, product, seats, status, starts_at, expires_at, hmac_signature, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        )->execute([$licId, $accountId, $keyCode, $plan, $product, $seats, 'active', $now, $expires, $hmac, $now]);

        AuditLog::fromRequest($req, 'admin.license.issue', "$keyCode ($product / $plan, $seats seats, $days days) → {$account['name']}");

        // If the operator collected money, record it in the payments table
        // so revenue dashboards reflect the cash. No Razorpay payment_id —
        // we synthesise a marker prefix so the row is identifiable.
        $payId = null;
        if ($paymentAmount > 0) {
            $this->ensurePaymentsManualColumns();
            $payId       = generateId();
            $razorOrder  = 'manual_' . $licId;
            $razorPayKey = 'manual_' . $licId;
            $description = trim(($paymentNote !== '' ? $paymentNote : 'Manual issuance')
                              . " · $product/$plan · {$account['name']}");
            try {
                db()->prepare(
                    "INSERT INTO payments (id, account_id, razorpay_order_id, razorpay_payment_id,
                                           amount_inr, currency, status, method, description,
                                           license_id, created_at, captured_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
                )->execute([
                    $payId, $accountId, $razorOrder, $razorPayKey,
                    $paymentAmount, 'INR', 'captured', $paymentMethod, $description,
                    $licId, $now, $now,
                ]);
            } catch (\Throwable $e) {
                error_log('[issueLicense] manual payment insert failed: ' . $e->getMessage());
            }
            AuditLog::fromRequest($req, 'admin.payment.manual', "$payId ₹$paymentAmount via $paymentMethod for $keyCode");
        }

        Response::json([
            'id'             => $licId,
            'key_code'       => $keyCode,
            'plan'           => $plan,
            'product'        => $product,
            'seats'          => $seats,
            'status'         => 'active',
            'starts_at'      => $now,
            'expires_at'     => $expires,
            'account_id'     => $accountId,
            'account_name'   => $account['name'],
            'payment_amount' => $paymentAmount,
            'payment_method' => $paymentMethod,
            'payment_id'     => $payId,
        ], 201);
    }

    private function ensureLicenseQuotaColumns(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $cols = db()->query("SHOW COLUMNS FROM licenses")->fetchAll(\PDO::FETCH_COLUMN);
            $sql = [];
            if (!in_array('quota_enabled', $cols, true))    $sql[] = "ADD COLUMN quota_enabled TINYINT(1) NOT NULL DEFAULT 0";
            if (!in_array('quota_remaining', $cols, true))  $sql[] = "ADD COLUMN quota_remaining INT NOT NULL DEFAULT 0";
            if (!in_array('quota_total', $cols, true))      $sql[] = "ADD COLUMN quota_total INT NOT NULL DEFAULT 0";
            if ($sql) db()->exec("ALTER TABLE licenses " . implode(', ', $sql));
        } catch (\Throwable $e) { error_log('[ensureLicenseQuotaColumns] ' . $e->getMessage()); }
    }

    private function ensurePaymentsManualColumns(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $cols = db()->query("SHOW COLUMNS FROM payments")->fetchAll(\PDO::FETCH_COLUMN);
            $sql = [];
            if (!in_array('method',      $cols, true)) $sql[] = "ADD COLUMN method VARCHAR(30) NULL";
            if (!in_array('description', $cols, true)) $sql[] = "ADD COLUMN description VARCHAR(255) NULL";
            if (!in_array('license_id',  $cols, true)) $sql[] = "ADD COLUMN license_id VARCHAR(32) NULL, ADD INDEX idx_license (license_id)";
            if ($sql) db()->exec("ALTER TABLE payments " . implode(', ', $sql));
        } catch (\Throwable $e) { error_log('[ensurePaymentsManualColumns] ' . $e->getMessage()); }
    }

    private function ensureLicenseProductColumn(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $col = db()->query("SHOW COLUMNS FROM licenses LIKE 'product'")->fetch();
            if (!$col) {
                db()->exec("ALTER TABLE licenses ADD COLUMN product VARCHAR(20) NOT NULL DEFAULT 'viewer' AFTER plan, ADD INDEX idx_product (product)");
            }
        } catch (\Throwable $e) { error_log('[ensureLicenseProductColumn] ' . $e->getMessage()); }
    }

    public function payments(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT p.*,
                    (SELECT name  FROM accounts WHERE id=p.account_id LIMIT 1) as account_name,
                    (SELECT email FROM users    WHERE account_id=p.account_id AND role='admin' LIMIT 1) as owner_email
             FROM payments p
             ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM payments")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function invoices(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT i.*,
                    (SELECT name  FROM accounts WHERE id=i.account_id LIMIT 1) as account_name,
                    (SELECT email FROM users    WHERE account_id=i.account_id AND role='admin' LIMIT 1) as owner_email
             FROM invoices i
             ORDER BY i.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function markInvoicePaid(Request $req): void {
        $id = $req->param('id');
        db()->prepare("UPDATE invoices SET status='paid' WHERE id=?")->execute([$id]);
        AuditLog::fromRequest($req, 'admin.invoice.mark_paid', $id);
        Response::ok();
    }

    public function tickets(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT t.*,
                    (SELECT name  FROM accounts WHERE id=t.account_id LIMIT 1) as account_name,
                    (SELECT email FROM users    WHERE id=t.user_id    LIMIT 1) as user_email,
                    (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id=t.id) as message_count
             FROM tickets t
             ORDER BY t.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM tickets")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function bugs(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT b.*,
                    (SELECT name  FROM accounts WHERE id=b.account_id LIMIT 1) as account_name,
                    (SELECT email FROM users    WHERE id=b.user_id    LIMIT 1) as user_email
             FROM bugs b
             ORDER BY b.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM bugs")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function replyTicket(Request $req): void {
        $ticketId = $req->param('id');
        $body     = $req->body();
        $text     = $body['body'] ?? '';
        if (!$text) Response::error('Reply body required', 400);

        $stmt = db()->prepare("SELECT id, account_id, user_id, subject FROM tickets WHERE id = ?");
        $stmt->execute([$ticketId]);
        $ticket = $stmt->fetch();
        if (!$ticket) Response::error('Ticket not found', 404);

        $msgId = generateId();
        db()->prepare(
            "INSERT INTO ticket_messages (id, ticket_id, sender_role, sender_id, body, created_at)
             VALUES (?,?,?,?,?,?)"
        )->execute([$msgId, $ticketId, 'admin', $req->user['id'], $text, nowDb()]);

        db()->prepare("UPDATE tickets SET status='waiting' WHERE id=?")->execute([$ticketId]);

        // Email user
        $uStmt = db()->prepare("SELECT email, name FROM users WHERE id = ?");
        $uStmt->execute([$ticket['user_id']]);
        $u = $uStmt->fetch();
        if ($u) {
            Mailer::send($u['email'], $u['name'], 'Reply to your support ticket: ' . $ticket['subject'], 'email-ticket-reply', [
                'subject'    => $ticket['subject'],
                'from'       => Settings::get('brand.name', 'Mediview Support'),
                'message'    => $text,
                'ticket_url' => rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/tickets',
            ]);
        }

        AuditLog::fromRequest($req, 'admin.ticket.reply', $ticketId);
        Response::ok(['message_id' => $msgId]);
    }

    public function resolveTicket(Request $req): void {
        $ticketId = $req->param('id');
        $stmt = db()->prepare("SELECT id FROM tickets WHERE id = ?");
        $stmt->execute([$ticketId]);
        if (!$stmt->fetch()) Response::error('Ticket not found', 404);

        db()->prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")->execute([nowDb(), $ticketId]);
        AuditLog::fromRequest($req, 'admin.ticket.resolve', $ticketId);
        Response::ok();
    }

    public function resolveBug(Request $req): void {
        $bugId = $req->param('id');
        $body = $req->body();
        $status = $body['status'] ?? 'resolved';
        if (!in_array($status, ['open','in_progress','resolved','wontfix'], true)) Response::error('Invalid status', 400);

        $stmt = db()->prepare("SELECT id FROM bugs WHERE id = ?");
        $stmt->execute([$bugId]);
        if (!$stmt->fetch()) Response::error('Report not found', 404);

        db()->prepare("UPDATE bugs SET status=?, resolved_at=? WHERE id=?")
            ->execute([$status, in_array($status, ['resolved','wontfix'], true) ? nowDb() : null, $bugId]);
        AuditLog::fromRequest($req, 'admin.bug.status', "$bugId:$status");
        Response::ok(['status' => $status]);
    }

    public function audit(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 50;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off,   PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM audit_logs")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function getSettings(Request $req): void {
        Response::json(Settings::all(true)); // revealed for admin
    }

    public function saveSettings(Request $req): void {
        $body = $req->body();
        // Filter to allowed keys only
        $allowed = [
            'brand.name','brand.tagline','brand.support_email','brand.phone','brand.address','brand.website',
            'smtp.host','smtp.port','smtp.encryption','smtp.username','smtp.password','smtp.from_email','smtp.from_name',
            'razorpay.key_id','razorpay.key_secret','razorpay.webhook_secret','razorpay.mode',
            'google.client_id',
            'gemini.api_key','gemini.model','gemini.system_prompt',
            'pricing.monthly_inr','pricing.annual_inr','pricing.trial_days','pricing.trial_seats',
            'business.upi_id','business.bank_name','business.bank_account','business.bank_ifsc',
            'app.exe_url','app.exe_version','app.exe_changelog',
            'feature.chat_enabled','feature.referrals_enabled','feature.ai_wallet_enabled',
        ];
        $filtered = array_intersect_key($body, array_flip($allowed));
        Settings::setMany($filtered, $req->user['id']);
        Settings::invalidate();
        AuditLog::fromRequest($req, 'admin.settings.save', implode(', ', array_keys($filtered)));
        Response::ok(['saved' => count($filtered)]);
    }

    public function testSmtp(Request $req): void {
        $body = $req->body();
        $to   = $body['to'] ?? $req->user['email'];
        try {
            $sent = Mailer::send($to, 'Test', 'SMTP Test — Mediview', 'email-ticket-reply', [
                'subject' => 'SMTP Test',
                'from'    => 'Mediview Admin',
                'message' => 'If you received this email, your SMTP configuration is working correctly!',
                'ticket_url' => '',
            ]);
            $sent ? Response::ok(['message' => "Test email sent to $to"]) : Response::error('Mailer returned false', 500);
        } catch (\Throwable $e) {
            Response::error('SMTP error: ' . $e->getMessage(), 500);
        }
    }

    public function testRazorpay(Request $req): void {
        try {
            $rzp   = new RazorpayClient();
            $order = $rzp->createOrder(100, 'test_' . generateId(), ['test' => true]);
            Response::ok(['message' => 'Razorpay connected', 'order_id' => $order['id']]);
        } catch (\Throwable $e) {
            Response::error('Razorpay error: ' . $e->getMessage(), 500);
        }
    }

    public function testGemini(Request $req): void {
        try {
            $gem    = new GeminiClient();
            $result = $gem->chat([['role' => 'user', 'text' => 'Reply with exactly: "Gemini connected."']]);
            Response::ok(['message' => 'Gemini connected', 'reply' => $result['reply']]);
        } catch (\Throwable $e) {
            Response::error('Gemini error: ' . $e->getMessage(), 500);
        }
    }

    public function impersonate(Request $req): void {
        $userId = $req->param('id');

        $stmt = db()->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        if (!$user) Response::error('User not found', 404);

        $token = Auth::issueToken($user['id'], $user['account_id'], $user['role']);
        AuditLog::fromRequest($req, 'admin.impersonate', $user['email']);
        Response::json(['token' => $token, 'user' => $user, 'impersonating' => true]);
    }

    /** GET /admin/licenses/{id} — full license detail with devices, account, payments, logs */
    public function licenseDetail(Request $req): void {
        $id = $req->param('id');
        $stmt = db()->prepare(
            "SELECT l.*,
                    (SELECT name FROM accounts WHERE id=l.account_id) AS account_name,
                    (SELECT email FROM users WHERE account_id=l.account_id AND role='admin' LIMIT 1) AS owner_email,
                    (SELECT name FROM users WHERE account_id=l.account_id AND role='admin' LIMIT 1) AS owner_name
             FROM licenses l WHERE l.id = ?"
        );
        $stmt->execute([$id]);
        $license = $stmt->fetch();
        if (!$license) Response::error('License not found', 404);

        // Devices on this license
        $d = db()->prepare(
            "SELECT id, machine_name, fingerprint, os, app_version, last_ip, last_heartbeat_at, status, activated_at, deactivated_at
             FROM devices WHERE license_id = ? ORDER BY last_heartbeat_at DESC"
        );
        $d->execute([$id]);
        $devices = $d->fetchAll();

        // Payment that created this license (if any)
        $p = db()->prepare(
            "SELECT * FROM payments WHERE account_id = ? AND purpose LIKE '%license%'
             ORDER BY created_at DESC LIMIT 5"
        );
        $p->execute([$license['account_id']]);
        $payments = $p->fetchAll();

        // Audit logs for this license
        $a = db()->prepare(
            "SELECT * FROM audit_logs WHERE (target LIKE ? OR target LIKE ?)
             ORDER BY created_at DESC LIMIT 20"
        );
        $a->execute(["%$id%", "%{$license['key_code']}%"]);
        $audit = $a->fetchAll();

        // Wallet balances for the account
        $w = db()->prepare("SELECT type, balance FROM wallets WHERE account_id = ?");
        $w->execute([$license['account_id']]);
        $wallets = [];
        foreach ($w->fetchAll() as $row) $wallets[$row['type']] = (int)$row['balance'];

        Response::json([
            'license'  => $license,
            'devices'  => $devices,
            'payments' => $payments,
            'audit'    => $audit,
            'wallets'  => $wallets,
        ]);
    }

    /** POST /admin/licenses/{id}/update — update plan/seats */
    public function updateLicense(Request $req): void {
        $id = $req->param('id');
        $body = $req->body();

        $stmt = db()->prepare("SELECT id, key_code FROM licenses WHERE id = ?");
        $stmt->execute([$id]);
        $lic = $stmt->fetch();
        if (!$lic) Response::error('License not found', 404);

        $updates = [];
        $params = [];
        if (isset($body['plan'])) { $updates[] = 'plan = ?'; $params[] = $body['plan']; }
        if (isset($body['seats'])) { $updates[] = 'seats = ?'; $params[] = max(1, (int)$body['seats']); }
        if (isset($body['status'])) {
            $allowed = ['active', 'suspended', 'revoked'];
            if (in_array($body['status'], $allowed)) { $updates[] = 'status = ?'; $params[] = $body['status']; }
        }
        if (empty($updates)) Response::error('Nothing to update', 400);

        $params[] = $id;
        db()->prepare("UPDATE licenses SET " . implode(', ', $updates) . " WHERE id = ?")->execute($params);
        AuditLog::fromRequest($req, 'admin.license.update', "{$lic['key_code']}: " . implode(', ', array_keys(array_filter($body))));
        Response::ok();
    }

    /** POST /admin/licenses/{id}/quota — set per-license print quota mode.
     *  body: { enabled: bool, remaining?: int, add?: int }
     *  - enabled toggles the sell-by-print mode
     *  - remaining sets the counter directly
     *  - add increments the counter (top-up)
     *  When the quota is enabled and remaining=0, the desktop apps refuse to
     *  print until the operator tops up. */
    public function setLicenseQuota(Request $req): void {
        $this->ensureLicenseQuotaColumns();
        $id   = $req->param('id');
        $body = $req->body();

        $stmt = db()->prepare("SELECT id, key_code, quota_enabled, quota_remaining, quota_total FROM licenses WHERE id = ?");
        $stmt->execute([$id]);
        $lic = $stmt->fetch();
        if (!$lic) Response::error('License not found', 404);

        $enabled   = isset($body['enabled']) ? (int)!!$body['enabled'] : (int)$lic['quota_enabled'];
        $remaining = isset($body['remaining']) ? max(0, (int)$body['remaining']) : (int)$lic['quota_remaining'];
        if (isset($body['add'])) $remaining = max(0, $remaining + (int)$body['add']);
        $total = max((int)$lic['quota_total'], $remaining);

        db()->prepare("UPDATE licenses SET quota_enabled=?, quota_remaining=?, quota_total=? WHERE id=?")
            ->execute([$enabled, $remaining, $total, $id]);
        AuditLog::fromRequest($req, 'admin.license.quota', "{$lic['key_code']}: enabled=$enabled remaining=$remaining");
        Response::json(['ok' => true, 'enabled' => (bool)$enabled, 'remaining' => $remaining, 'total' => $total]);
    }

    /** GET /admin/wallets — list all account wallets */
    public function wallets(Request $req): void {
        $page = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT w.*,
                    a.name AS account_name,
                    (SELECT email FROM users WHERE account_id = a.id AND role='admin' LIMIT 1) AS owner_email
             FROM wallets w
             JOIN accounts a ON a.id = w.account_id
             WHERE a.id != 'acc_superadmin00'
             ORDER BY w.balance DESC
             LIMIT ? OFFSET ?"
        );
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->bindValue(2, $off, PDO::PARAM_INT);
        $stmt->execute();
        $total = (int)db()->query("SELECT COUNT(*) FROM wallets w JOIN accounts a ON a.id=w.account_id WHERE a.id != 'acc_superadmin00'")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    /** GET /admin/revenue-chart — monthly revenue data for charts */
    public function revenueChart(Request $req): void {
        $months = max(3, min(24, (int)$req->query('months', 12)));
        $data = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $start = gmdate('Y-m-01 00:00:00', strtotime("-{$i} months"));
            $end = gmdate('Y-m-t 23:59:59', strtotime("-{$i} months"));
            $label = gmdate('M Y', strtotime("-{$i} months"));

            $stmt = db()->prepare(
                "SELECT COALESCE(SUM(amount_inr), 0) FROM payments
                 WHERE status IN ('captured','manual') AND COALESCE(captured_at, created_at) BETWEEN ? AND ?"
            );
            $stmt->execute([$start, $end]);
            $revenue = (float)$stmt->fetchColumn();

            $newAcc = db()->prepare("SELECT COUNT(*) FROM accounts WHERE created_at BETWEEN ? AND ? AND id != 'acc_superadmin00'");
            $newAcc->execute([$start, $end]);
            $accounts = (int)$newAcc->fetchColumn();

            $newLic = db()->prepare("SELECT COUNT(*) FROM licenses WHERE created_at BETWEEN ? AND ?");
            $newLic->execute([$start, $end]);
            $licenses = (int)$newLic->fetchColumn();

            $data[] = ['month' => $label, 'revenue' => $revenue, 'accounts' => $accounts, 'licenses' => $licenses];
        }
        Response::json(['data' => $data]);
    }
}
