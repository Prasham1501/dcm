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

    public function order(Request $req): void {
        $body = $req->body();
        $plan = $body['plan'] ?? '';
        if (!in_array($plan, ['monthly','annual','enterprise'], true)) Response::error('Invalid plan', 400);

        $prices = [
            'monthly'    => (int)Settings::get('pricing.monthly_inr', '8000'),
            'annual'     => (int)Settings::get('pricing.annual_inr', '100000'),
            'enterprise' => (int)($body['custom_amount'] ?? 0),
        ];
        $amountInr = $prices[$plan];
        if ($amountInr < 1) Response::error('Invalid amount', 400);

        $rzp     = new RazorpayClient();
        $receipt = 'lic_' . generateId();
        $order   = $rzp->createOrder(Money::toPaise($amountInr), $receipt, ['plan' => $plan]);

        db()->prepare(
            "INSERT INTO payments (id, account_id, purpose, rzp_order_id, amount_inr, status, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([generateId(), $req->user['account_id'], 'license', $order['id'], $amountInr, 'created', nowDb()]);

        Response::json(['order_id' => $order['id'], 'rzp_key' => $rzp->getPublicKey(), 'amount' => $amountInr, 'plan' => $plan]);
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

        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $name = trim($body['machine_name'] ?? 'Unknown');
        $os   = $body['os']          ?? '';
        $ver  = $body['app_version'] ?? '';

        if (!$key || !$fp) Response::error('license_key and fingerprint required', 400);
        if (!LicenseKey::isValidFormat($key)) Response::error('Invalid license key format', 400);

        $stmt = db()->prepare("SELECT * FROM licenses WHERE key_code = ? AND status = 'active'");
        $stmt->execute([$key]);
        $lic = $stmt->fetch();
        if (!$lic) Response::error('License key not found or revoked', 404);

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
                Response::ok(['message' => 'Already activated', 'device_id' => $existing['id'], 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan']]);
            }
            db()->prepare("UPDATE devices SET status='active', deactivated_at=NULL, last_heartbeat_at=?, last_ip=?, app_version=? WHERE id=?")
                ->execute([nowDb(), $req->clientIp(), $ver, $existing['id']]);
            Response::ok(['message' => 'Device reactivated', 'device_id' => $existing['id'], 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan']]);
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
        Response::ok(['device_id' => $devId, 'expires_at' => $lic['expires_at'], 'plan' => $lic['plan'], 'seats' => $lic['seats']]);
    }

    public function validate(Request $req): void {
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        if (!$key || !$fp) Response::error('license_key and fingerprint required', 400);

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
        if (!$row['device_id'])           Response::json(['valid' => false, 'reason' => 'not_activated']);
        if ($row['device_status'] !== 'active') Response::json(['valid' => false, 'reason' => 'deactivated']);

        Response::json(['valid' => true, 'plan' => $row['plan'], 'expires_at' => $row['expires_at'], 'seats' => $row['seats']]);
    }

    public function heartbeat(Request $req): void {
        $body = $req->body();
        $key  = trim($body['license_key'] ?? '');
        $fp   = trim($body['fingerprint']  ?? '');
        $ver  = $body['app_version'] ?? '';
        if (!$key || !$fp) Response::error('Required fields missing', 400);

        db()->prepare(
            "UPDATE devices d JOIN licenses l ON d.license_id=l.id
             SET d.last_heartbeat_at=?, d.last_ip=?, d.app_version=?
             WHERE l.key_code=? AND d.fingerprint=? AND d.status='active'"
        )->execute([nowDb(), $req->clientIp(), $ver, $key, $fp]);

        Response::ok(['ts' => time()]);
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
}
