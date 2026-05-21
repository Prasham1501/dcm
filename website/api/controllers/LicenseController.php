<?php
declare(strict_types=1);

class LicenseController {

    // ── Dashboard endpoints (JWT required) ─────────────────────────────────

    public function index(Request $req): void {
        $stmt = db()->prepare(
            "SELECT l.*, (SELECT COUNT(*) FROM devices d WHERE d.license_id=l.id AND d.status='active') AS seats_used
             FROM licenses l WHERE l.account_id = ? ORDER BY l.created_at DESC"
        );
        $stmt->execute([$req->user['account_id']]);
        Response::json($stmt->fetchAll());
    }

    /** Ensure `licenses.product` exists. Idempotent — only adds the column once. */
    private function ensureProductColumn(): void {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        try {
            $col = db()->query("SHOW COLUMNS FROM licenses LIKE 'product'")->fetch();
            if (!$col) {
                db()->exec("ALTER TABLE licenses ADD COLUMN product VARCHAR(20) NOT NULL DEFAULT 'viewer' AFTER plan, ADD INDEX idx_product (product)");
            }
        } catch (\Throwable $e) { error_log('[ensureProductColumn] ' . $e->getMessage()); }
    }

    /** Price matrix per product+plan. Bridge is ₹3k/mo, ₹30k/yr. */
    private function priceFor(string $product, string $plan, array $body = []): int {
        $product = in_array($product, ['viewer','bridge'], true) ? $product : 'viewer';
        if ($product === 'bridge') {
            return [
                'monthly'    => (int)Settings::get('pricing.bridge_monthly_inr', '3000'),
                'annual'     => (int)Settings::get('pricing.bridge_annual_inr',  '30000'),
                'enterprise' => (int)($body['custom_amount'] ?? 0),
            ][$plan] ?? 0;
        }
        return [
            'monthly'    => (int)Settings::get('pricing.monthly_inr', '8000'),
            'annual'     => (int)Settings::get('pricing.annual_inr',  '100000'),
            'enterprise' => (int)($body['custom_amount'] ?? 0),
        ][$plan] ?? 0;
    }

    public function order(Request $req): void {
        $this->ensureProductColumn();
        $body    = $req->body();
        $plan    = $body['plan']    ?? '';
        $product = (string)($body['product'] ?? 'viewer');
        if (!in_array($plan, ['monthly','annual','enterprise'], true))  Response::error('Invalid plan', 400);
        if (!in_array($product, ['viewer','bridge'], true))             Response::error('Invalid product', 400);
        $seats     = max(1, (int)($body['seats'] ?? 1));
        $amountInr = $this->priceFor($product, $plan, $body);
        if ($amountInr < 1) Response::error('Invalid amount', 400);

        // No Razorpay configured → auto-provision the license + invoice immediately.
        if (!RazorpayClient::isConfigured()) {
            $result = $this->autoProvisionLicense($req, $plan, $seats, $amountInr, $product);
            Response::json($result + ['auto_provisioned' => true]);
        }

        $rzp     = new RazorpayClient();
        $receipt = 'lic_' . generateId();
        $order   = $rzp->createOrder(Money::toPaise($amountInr), $receipt, ['plan' => $plan, 'product' => $product]);

        db()->prepare(
            "INSERT INTO payments (id, account_id, purpose, rzp_order_id, amount_inr, status, meta, created_at)
             VALUES (?,?,?,?,?,?,?,?)"
        )->execute([generateId(), $req->user['account_id'], 'license', $order['id'], $amountInr, 'created', json_encode(['product'=>$product,'plan'=>$plan]), nowDb()]);

        Response::json(['order_id' => $order['id'], 'rzp_key' => $rzp->getPublicKey(), 'amount' => $amountInr, 'plan' => $plan, 'product' => $product]);
    }

    /** Create license + invoice without going through Razorpay (used when not configured). */
    private function autoProvisionLicense(Request $req, string $plan, int $seats, int $amountInr, string $product = 'viewer'): array {
        $this->ensureProductColumn();
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $now     = nowDb();
            $expires = match($plan) {
                'monthly'    => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
                'annual'     => gmdate('Y-m-d H:i:s', time() + 365 * 86400),
                'enterprise' => null,
                default      => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
            };
            $keyCode = LicenseKey::generate();
            $hmac    = LicenseKey::sign($keyCode, ['plan' => $plan, 'product' => $product, 'seats' => $seats, 'account' => $req->user['account_id']]);
            $licId   = generateId();
            $invId   = generateId();
            $payId   = generateId();
            $invNumber = $this->nextInvoiceNumber($pdo);

            $pdo->prepare(
                "INSERT INTO licenses (id, account_id, key_code, product, plan, seats, status, starts_at, expires_at, hmac_signature, invoice_id, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([$licId, $req->user['account_id'], $keyCode, $product, $plan, $seats, 'active', $now, $expires, $hmac, $invId, $now]);

            $items = [['name' => "Mediview $plan license (manual provisioning)", 'qty' => 1, 'rate' => $amountInr, 'amount' => $amountInr]];
            $pdo->prepare(
                "INSERT INTO invoices (id, account_id, number, payment_id, subtotal_inr, gst_inr, total_inr, items_json, status, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$invId, $req->user['account_id'], $invNumber, $payId, $amountInr, 0, $amountInr, json_encode($items), 'paid', $now]);

            $pdo->prepare(
                "INSERT INTO payments (id, account_id, purpose, rzp_order_id, amount_inr, status, invoice_id, captured_at, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)"
            )->execute([$payId, $req->user['account_id'], 'license', 'manual_' . $payId, $amountInr, 'manual', $invId, $now, $now]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[License/autoProvision] ' . $e->getMessage());
            Response::error('Failed to provision license. Contact support.', 500);
        }

        AuditLog::fromRequest($req, 'license.purchase.manual', "$plan / $seats seats");

        $uStmt = db()->prepare("SELECT email, name FROM users WHERE id = ?");
        $uStmt->execute([$req->user['id']]);
        $u = $uStmt->fetch();
        if ($u) {
            try {
                Mailer::send($u['email'], $u['name'], 'Your Mediview License Key', 'email-license', [
                    'name'         => $u['name'],
                    'key_code'     => $keyCode,
                    'plan'         => ucfirst($plan),
                    'seats'        => $seats,
                    'expires_at'   => $expires ? date('d M Y', strtotime($expires)) : 'Perpetual',
                    'download_url' => rtrim((string)getenv('APP_URL'), '/') . '/api/download/exe',
                ]);
            } catch (\Throwable $e) { error_log('[License/autoProvision] email: ' . $e->getMessage()); }
        }

        $ifs = db()->prepare("SELECT * FROM invoices WHERE id = ?");
        $ifs->execute([$invId]);
        return [
            'license_key' => $keyCode,
            'invoice_id'  => $invId,
            'invoice'     => $ifs->fetch(),
            'plan'        => $plan,
            'amount'      => $amountInr,
        ];
    }

    public function verify(Request $req): void {
        $body      = $req->body();
        $orderId   = $body['order_id']   ?? '';
        $paymentId = $body['payment_id'] ?? '';
        $signature = $body['signature']  ?? '';
        $plan      = $body['plan']       ?? '';
        $seats     = max(1, (int)($body['seats'] ?? 1));

        if (!$orderId || !$paymentId || !$signature) Response::error('Payment details required', 400);

        $rzp = new RazorpayClient();
        if (!$rzp->verifySignature($orderId, $paymentId, $signature)) {
            Response::error('Payment signature invalid', 400);
        }

        $pdo = db();
        // Idempotency
        $existStmt = $pdo->prepare("SELECT id, invoice_id FROM payments WHERE rzp_order_id = ? AND status = 'captured'");
        $existStmt->execute([$orderId]);
        $existPay = $existStmt->fetch();
        if ($existPay) {
            $ifs = $pdo->prepare("SELECT * FROM invoices WHERE id = ?");
            $ifs->execute([$existPay['invoice_id']]);
            Response::json(['already_processed' => true, 'invoice' => $ifs->fetch()]);
        }

        $pdo->beginTransaction();
        try {
            $prices = [
                'monthly' => (int)Settings::get('pricing.monthly_inr', '8000'),
                'annual'  => (int)Settings::get('pricing.annual_inr', '100000'),
            ];
            $amountInr = $prices[$plan] ?? 0;
            $now       = nowDb();
            $expires   = match($plan) {
                'monthly'    => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
                'annual'     => gmdate('Y-m-d H:i:s', time() + 365 * 86400),
                'enterprise' => null,
                default      => gmdate('Y-m-d H:i:s', time() + 30 * 86400),
            };

            $keyCode = LicenseKey::generate();
            $hmac    = LicenseKey::sign($keyCode, ['plan' => $plan, 'seats' => $seats, 'account' => $req->user['account_id']]);
            $licId   = generateId();
            $invId   = generateId();

            $pdo->prepare(
                "INSERT INTO licenses (id, account_id, key_code, plan, seats, status, starts_at, expires_at, hmac_signature, invoice_id, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([$licId, $req->user['account_id'], $keyCode, $plan, $seats, 'active', $now, $expires, $hmac, $invId, $now]);

            $invNumber = $this->nextInvoiceNumber($pdo);
            $items     = [['name' => "Mediview $plan license", 'qty' => 1, 'rate' => $amountInr, 'amount' => $amountInr]];

            $pdo->prepare(
                "INSERT INTO invoices (id, account_id, number, payment_id, subtotal_inr, gst_inr, total_inr, items_json, status, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$invId, $req->user['account_id'], $invNumber, $orderId, $amountInr, 0, $amountInr, json_encode($items), 'paid', $now]);

            $pdo->prepare(
                "UPDATE payments SET status='captured', rzp_payment_id=?, rzp_signature=?, invoice_id=?, captured_at=? WHERE rzp_order_id=?"
            )->execute([$paymentId, $signature, $invId, $now, $orderId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[License/verify] ' . $e->getMessage());
            Response::error('Failed to process license. Contact support.', 500);
        }

        AuditLog::fromRequest($req, 'license.purchase', "$plan / $seats seats");

        // Email license key
        $uStmt = db()->prepare("SELECT email, name FROM users WHERE id = ?");
        $uStmt->execute([$req->user['id']]);
        $u = $uStmt->fetch();
        if ($u) {
            Mailer::send($u['email'], $u['name'], 'Your Mediview License Key', 'email-license', [
                'name'         => $u['name'],
                'key_code'     => $keyCode,
                'plan'         => ucfirst($plan),
                'seats'        => $seats,
                'expires_at'   => $expires ? date('d M Y', strtotime($expires)) : 'Perpetual',
                'download_url' => rtrim(getenv('APP_URL'), '/') . '/api/download/exe',
            ]);
        }

        $ifs = db()->prepare("SELECT * FROM invoices WHERE id = ?");
        $ifs->execute([$invId]);
        Response::json(['license_key' => $keyCode, 'invoice_id' => $invId, 'invoice' => $ifs->fetch()]);
    }

    // ── EXE endpoints (no JWT) ──────────────────────────────────────────────

    public function activate(Request $req): void {
        RateLimiter::hit('activate:ip:' . $req->clientIp(), 30, 60);
        $this->ensureProductColumn();

        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $name = trim($body['machine_name'] ?? 'Unknown');
        $os   = $body['os']          ?? '';
        $ver  = $body['app_version'] ?? '';
        // Which product is asking — Viewer & Bridge are separate SKUs and
        // a key issued for one must not activate the other.
        $app  = (string)($body['app']         ?? 'viewer');
        if (!in_array($app, ['viewer','bridge'], true)) Response::error('Invalid app', 400);

        if (!$key || !$fp) Response::error('license_key and fingerprint required', 400);
        if (!LicenseKey::isValidFormat($key)) Response::error('Invalid license key format', 400);

        $stmt = db()->prepare("SELECT * FROM licenses WHERE key_code = ? AND status = 'active'");
        $stmt->execute([$key]);
        $lic = $stmt->fetch();
        if (!$lic) Response::error('License key not found or revoked', 404);

        // Cross-product key reject: a Viewer key won't unlock Bridge and vice versa.
        $licProduct = $lic['product'] ?? 'viewer';
        if ($licProduct !== $app) {
            Response::error("This key is for Mediview {$licProduct}, not {$app}. Buy a {$app} license to activate this app.", 403);
        }

        if ($lic['expires_at'] && strtotime($lic['expires_at']) < time()) {
            db()->prepare("UPDATE licenses SET status='expired' WHERE id=?")->execute([$lic['id']]);
            Response::error('License has expired', 402);
        }

        // Existing device?
        $devStmt = db()->prepare("SELECT id, status FROM devices WHERE license_id = ? AND fingerprint = ?");
        $devStmt->execute([$lic['id'], $fp]);
        $existing = $devStmt->fetch();

        if ($existing) {
            if ($existing['status'] === 'active') {
                db()->prepare("UPDATE devices SET last_heartbeat_at=?,last_ip=?,app_version=?,machine_name=? WHERE id=?")
                    ->execute([nowDb(), $req->clientIp(), $ver, $name, $existing['id']]);
                Response::ok(['message' => 'Already activated', 'device_id' => $existing['id'], 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan'], 'wallet_balances' => $this->walletBalances($lic['account_id'])]);
            }
            db()->prepare("UPDATE devices SET status='active', deactivated_at=NULL, last_heartbeat_at=?, last_ip=?, app_version=? WHERE id=?")
                ->execute([nowDb(), $req->clientIp(), $ver, $existing['id']]);
            Response::ok(['message' => 'Device reactivated', 'device_id' => $existing['id'], 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan'], 'wallet_balances' => $this->walletBalances($lic['account_id'])]);
        }

        // Check seat count
        $countStmt = db()->prepare("SELECT COUNT(*) FROM devices WHERE license_id = ? AND status = 'active'");
        $countStmt->execute([$lic['id']]);
        if ((int)$countStmt->fetchColumn() >= $lic['seats']) {
            Response::error("All {$lic['seats']} seat(s) in use. Deactivate a device first.", 403);
        }

        $devId = generateId();
        db()->prepare(
            "INSERT INTO devices (id, license_id, account_id, fingerprint, machine_name, os, app_version, status, activated_at, last_heartbeat_at, last_ip)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        )->execute([$devId, $lic['id'], $lic['account_id'], $fp, $name, $os, $ver, 'active', nowDb(), nowDb(), $req->clientIp()]);

        AuditLog::log('device.activate', $name, ['fp' => substr($fp,0,8).'...'], $lic['account_id'], null, 'desktop', $req->clientIp());
        Response::ok(['device_id' => $devId, 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan'], 'seats' => $lic['seats'], 'wallet_balances' => $this->walletBalances($lic['account_id'])]);
    }

    public function validate(Request $req): void {
        $this->ensureProductColumn();
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $app  = (string)($body['app'] ?? 'viewer');
        if (!$key || !$fp) Response::error('license_key and fingerprint required', 400);
        if (!in_array($app, ['viewer','bridge'], true)) Response::error('Invalid app', 400);

        $stmt = db()->prepare(
            "SELECT l.*, d.id as device_id, d.status as device_status
             FROM licenses l LEFT JOIN devices d ON d.license_id=l.id AND d.fingerprint=?
             WHERE l.key_code=?"
        );
        $stmt->execute([$fp, $key]);
        $row = $stmt->fetch();

        if (!$row)                        Response::json(['valid' => false, 'reason' => 'not_found']);
        if ($row['status'] === 'revoked') Response::json(['valid' => false, 'reason' => 'revoked']);
        if ($row['status'] === 'expired') Response::json(['valid' => false, 'reason' => 'expired']);
        if ($row['expires_at'] && strtotime($row['expires_at']) < time()) Response::json(['valid' => false, 'reason' => 'expired']);
        if (($row['product'] ?? 'viewer') !== $app) Response::json(['valid' => false, 'reason' => 'wrong_product', 'expected_product' => $row['product'] ?? 'viewer']);
        if (!$row['device_id'])           Response::json(['valid' => false, 'reason' => 'not_activated']);
        if ($row['device_status'] !== 'active') Response::json(['valid' => false, 'reason' => 'deactivated']);

        // Surface print-quota info so desktop apps can show the counter and
        // enforce the "stop at 0" rule client-side too.
        $quotaEnabled   = isset($row['quota_enabled'])   ? (int)$row['quota_enabled']   : 0;
        $quotaRemaining = isset($row['quota_remaining']) ? (int)$row['quota_remaining'] : 0;
        $quotaTotal     = isset($row['quota_total'])     ? (int)$row['quota_total']     : 0;

        Response::json([
            'valid'           => true,
            'product'         => $row['product'] ?? 'viewer',
            'plan'            => $row['plan'],
            'expires_at'      => $row['expires_at'],
            'seats'           => $row['seats'],
            'quota_enabled'   => (bool)$quotaEnabled,
            'quota_remaining' => $quotaRemaining,
            'quota_total'     => $quotaTotal,
            'wallet_balances' => $this->walletBalances($row['account_id']),
        ]);
    }

    /** POST /license/quota — desktop apps read/decrement their print quota.
     *  body: { license_key, fingerprint, app, decrement?: int }
     *  Returns the current quota_enabled/remaining/total. When decrement>0,
     *  it's subtracted atomically (and clamped at 0).  */
    public function quota(Request $req): void {
        $this->ensureProductColumn();
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $app  = (string)($body['app'] ?? 'viewer');
        $dec  = max(0, (int)($body['decrement'] ?? 0));
        // Desktop apps may flip the quota mode after the user clears the
        // local password gate. We require the same admin_pin defined in
        // settings (`admin.device_pin`, defaults to "Prasham123$") so a
        // device can't toggle without operator consent.
        $devicePin   = trim((string)($body['admin_pin']  ?? ''));
        $setEnabled  = isset($body['set_enabled']) ? (int)!!$body['set_enabled'] : null;
        $setRemaining = isset($body['set_remaining']) ? max(0, (int)$body['set_remaining']) : null;
        if (!$key || !$fp) Response::error('license_key and fingerprint required', 400);

        // Verify the key+device is active for this product.
        $stmt = db()->prepare(
            "SELECT l.id, l.status, l.product, l.expires_at, d.status as device_status
             FROM licenses l LEFT JOIN devices d ON d.license_id=l.id AND d.fingerprint=?
             WHERE l.key_code=?"
        );
        $stmt->execute([$fp, $key]);
        $row = $stmt->fetch();
        if (!$row)                                              Response::json(['ok'=>false,'reason'=>'not_found']);
        if ($row['status']    !== 'active')                     Response::json(['ok'=>false,'reason'=>$row['status']]);
        if (($row['product'] ?? 'viewer') !== $app)             Response::json(['ok'=>false,'reason'=>'wrong_product']);
        if ($row['device_status'] !== 'active')                 Response::json(['ok'=>false,'reason'=>'deactivated']);

        if ($dec > 0) {
            db()->prepare("UPDATE licenses SET quota_remaining = GREATEST(0, quota_remaining - ?) WHERE id = ? AND quota_enabled = 1")
                ->execute([$dec, $row['id']]);
        }

        // Device-side toggle (requires admin_pin). Lets the user flip
        // sell-by-print mode straight from the desktop app's quota modal.
        if ($setEnabled !== null || $setRemaining !== null) {
            $expectedPin = \Settings::get('admin.device_pin', 'Prasham123$');
            if ($devicePin !== $expectedPin) Response::error('Invalid admin pin', 403);
            $updates = []; $params = [];
            if ($setEnabled   !== null) { $updates[] = 'quota_enabled = ?';   $params[] = $setEnabled; }
            if ($setRemaining !== null) { $updates[] = 'quota_remaining = ?'; $params[] = $setRemaining; $updates[] = 'quota_total = GREATEST(quota_total, ?)'; $params[] = $setRemaining; }
            $params[] = $row['id'];
            db()->prepare("UPDATE licenses SET " . implode(', ', $updates) . " WHERE id = ?")->execute($params);
        }
        $q = db()->prepare("SELECT quota_enabled, quota_remaining, quota_total FROM licenses WHERE id = ?");
        $q->execute([$row['id']]);
        $cur = $q->fetch();

        Response::ok([
            'enabled'   => (bool)(int)$cur['quota_enabled'],
            'remaining' => (int)$cur['quota_remaining'],
            'total'     => (int)$cur['quota_total'],
        ]);
    }

    public function heartbeat(Request $req): void {
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $ver  = $body['app_version'] ?? '';
        if (!$key || !$fp) Response::error('Required fields missing', 400);

        // Update only when BOTH the license and the device are still active.
        $stmt = db()->prepare(
            "UPDATE devices d JOIN licenses l ON d.license_id=l.id
             SET d.last_heartbeat_at=?, d.last_ip=?, d.app_version=?
             WHERE l.key_code=? AND d.fingerprint=? AND d.status='active' AND l.status='active'"
        );
        $stmt->execute([nowDb(), $req->clientIp(), $ver, $key, $fp]);

        // If no row was updated, the license/device is no longer active.
        // Surface the reason so the desktop app can refuse to keep running.
        if ($stmt->rowCount() === 0) {
            $diag = db()->prepare(
                "SELECT l.status as license_status, l.expires_at, d.status as device_status
                 FROM licenses l LEFT JOIN devices d ON d.license_id=l.id AND d.fingerprint=?
                 WHERE l.key_code=?"
            );
            $diag->execute([$fp, $key]);
            $row = $diag->fetch();

            $reason = 'not_found';
            if ($row) {
                if ($row['license_status'] === 'revoked')                                    $reason = 'revoked';
                elseif ($row['license_status'] === 'expired')                                 $reason = 'expired';
                elseif ($row['expires_at'] && strtotime($row['expires_at']) < time())         $reason = 'expired';
                elseif (!$row['device_status'])                                               $reason = 'not_activated';
                elseif ($row['device_status'] !== 'active')                                   $reason = 'deactivated';
            }
            Response::json(['ok' => false, 'valid' => false, 'reason' => $reason, 'ts' => time()]);
        }

        $acct = db()->prepare("SELECT l.account_id FROM licenses l JOIN devices d ON d.license_id=l.id WHERE l.key_code=? AND d.fingerprint=? LIMIT 1");
        $acct->execute([$key, $fp]);
        $accountId = (string)$acct->fetchColumn();

        Response::ok(['valid' => true, 'ts' => time(), 'wallet_balances' => $accountId ? $this->walletBalances($accountId) : ['print' => 0, 'ai' => 0]]);
    }

    public function deactivateKey(Request $req): void {
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');

        db()->prepare(
            "UPDATE devices d JOIN licenses l ON d.license_id=l.id
             SET d.status='deactivated', d.deactivated_at=?
             WHERE l.key_code=? AND d.fingerprint=?"
        )->execute([nowDb(), $key, $fp]);

        Response::ok();
    }

    private function nextInvoiceNumber(PDO $pdo): string {
        $year = gmdate('Y');
        $stmt = $pdo->prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE");
        $stmt->execute(["MV-$year-%"]);
        $last = $stmt->fetchColumn();
        $seq  = $last ? ((int)substr($last, -4) + 1) : 1;
        return "MV-$year-" . str_pad((string)$seq, 4, '0', STR_PAD_LEFT);
    }

    private function walletBalances(string $accountId): array {
        $stmt = db()->prepare("SELECT type, balance FROM wallets WHERE account_id=? AND type IN ('print','ai')");
        $stmt->execute([$accountId]);
        $balances = ['print' => 0, 'ai' => 0];
        foreach ($stmt->fetchAll() as $row) {
            $balances[$row['type']] = (int)$row['balance'];
        }
        return $balances;
    }
}
