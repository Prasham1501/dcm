<?php
declare(strict_types=1);

class WalletController {

    public function index(Request $req): void {
        $type = $req->query('type', 'print');
        if (!in_array($type, ['print','ai'], true)) Response::error('Invalid wallet type', 400);

        $stmt = db()->prepare("SELECT * FROM wallets WHERE account_id = ? AND type = ?");
        $stmt->execute([$req->user['account_id'], $type]);
        $wallet = $stmt->fetch() ?: ['balance' => 0, 'threshold' => 200, 'auto_recharge' => 0, 'auto_amount' => 1000];

        $txStmt = db()->prepare(
            "SELECT * FROM transactions WHERE account_id = ? AND wallet_type = ? ORDER BY created_at DESC LIMIT 50"
        );
        $txStmt->execute([$req->user['account_id'], $type]);
        $wallet['txns'] = $txStmt->fetchAll();

        Response::json($wallet);
    }

    public function topup(Request $req): void {
        $body    = $req->body();
        $type    = $body['type']    ?? 'print';
        $credits = (int)($body['credits'] ?? 0);

        if (!in_array($type, ['print','ai'], true)) Response::error('Invalid wallet type', 400);
        if ($credits < 1) Response::error('Invalid credits amount', 400);

        $amountInr = (float)($body['amount'] ?? 0);
        if ($amountInr <= 0) $amountInr = $credits; // fallback: 1 credit = Rs 1

        // No Razorpay configured → credit the wallet immediately.
        if (!RazorpayClient::isConfigured()) {
            $result = $this->autoProvisionTopup($req, $type, $credits, $amountInr);
            Response::json($result + ['auto_provisioned' => true]);
        }

        $rzp     = new RazorpayClient();
        $receipt = $type . '_' . generateId();
        $order   = $rzp->createOrder(Money::toPaise($amountInr), $receipt, ['type' => $type, 'credits' => $credits]);

        db()->prepare(
            "INSERT INTO payments (id, account_id, purpose, rzp_order_id, amount_inr, status, meta, created_at)
             VALUES (?,?,?,?,?,?,?,?)"
        )->execute([generateId(), $req->user['account_id'], $type . '_topup', $order['id'], $amountInr, 'created', json_encode(['credits' => $credits, 'type' => $type]), nowDb()]);

        Response::json(['order_id' => $order['id'], 'rzp_key' => $rzp->getPublicKey(), 'amount' => $amountInr, 'credits' => $credits, 'type' => $type]);
    }

    /** Credit the wallet without Razorpay (used when not configured). */
    private function autoProvisionTopup(Request $req, string $type, int $credits, float $amountInr): array {
        $pdo = db();
        $pdo->beginTransaction();
        try {
            $now   = nowDb();
            $payId = generateId();
            $invId = generateId();
            $invNumber = $this->nextInvoiceNumber($pdo);

            $pdo->prepare(
                "INSERT INTO wallets (account_id, type, balance) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE balance = balance + ?"
            )->execute([$req->user['account_id'], $type, $credits, $credits]);

            $wStmt = $pdo->prepare("SELECT balance FROM wallets WHERE account_id = ? AND type = ?");
            $wStmt->execute([$req->user['account_id'], $type]);
            $newBalance = (int)$wStmt->fetchColumn();

            $items = [['name' => ucfirst($type) . " credits × $credits (manual provisioning)", 'qty' => $credits, 'rate' => round($amountInr / max(1,$credits), 2), 'amount' => $amountInr]];
            $pdo->prepare(
                "INSERT INTO invoices (id, account_id, number, payment_id, subtotal_inr, gst_inr, total_inr, items_json, status, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$invId, $req->user['account_id'], $invNumber, $payId, $amountInr, 0, $amountInr, json_encode($items), 'paid', $now]);

            $pdo->prepare(
                "INSERT INTO payments (id, account_id, purpose, rzp_order_id, amount_inr, status, invoice_id, meta, captured_at, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$payId, $req->user['account_id'], $type . '_topup', 'manual_' . $payId, $amountInr, 'manual', $invId, json_encode(['credits' => $credits, 'type' => $type]), $now, $now]);

            $pdo->prepare(
                "INSERT INTO transactions (id, account_id, wallet_type, kind, credits_delta, balance_after, amount_inr, payment_id, invoice_id, meta, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([generateId(), $req->user['account_id'], $type, 'topup', $credits, $newBalance, $amountInr, $payId, $invId, 'Top-up (manual / no payment gateway)', $now]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Wallet/autoProvision] ' . $e->getMessage());
            Response::error('Failed to credit wallet. Contact support.', 500);
        }

        AuditLog::fromRequest($req, 'wallet.topup.manual', "$type:$credits credits");

        $ifs = db()->prepare("SELECT * FROM invoices WHERE id = ?");
        $ifs->execute([$invId]);
        return [
            'balance'    => $newBalance,
            'invoice_id' => $invId,
            'invoice'    => $ifs->fetch(),
            'credits'    => $credits,
            'amount'     => $amountInr,
            'type'       => $type,
        ];
    }

    public function verify(Request $req): void {
        $body    = $req->body();
        $orderId = $body['order_id']   ?? '';
        $payId   = $body['payment_id'] ?? '';
        $sig     = $body['signature']  ?? '';

        if (!$orderId || !$payId || !$sig) Response::error('Payment details required', 400);

        $rzp = new RazorpayClient();
        if (!$rzp->verifySignature($orderId, $payId, $sig)) Response::error('Payment signature invalid', 400);

        $existStmt = db()->prepare("SELECT id, meta, amount_inr FROM payments WHERE rzp_order_id = ?");
        $existStmt->execute([$orderId]);
        $payment = $existStmt->fetch();
        if (!$payment) Response::error('Order not found', 404);

        $meta    = json_decode($payment['meta'] ?? '{}', true);
        $type    = $meta['type']    ?? 'print';
        $credits = (int)($meta['credits'] ?? 0);

        // Idempotency
        $capStmt = db()->prepare("SELECT id FROM payments WHERE rzp_order_id = ? AND status = 'captured'");
        $capStmt->execute([$orderId]);
        if ($capStmt->fetch()) {
            $wStmt = db()->prepare("SELECT balance FROM wallets WHERE account_id = ? AND type = ?");
            $wStmt->execute([$req->user['account_id'], $type]);
            Response::json(['balance' => (int)$wStmt->fetchColumn(), 'already_processed' => true]);
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO wallets (account_id, type, balance) VALUES (?,?,?)
                 ON DUPLICATE KEY UPDATE balance = balance + ?"
            )->execute([$req->user['account_id'], $type, $credits, $credits]);

            $wStmt = $pdo->prepare("SELECT balance FROM wallets WHERE account_id = ? AND type = ?");
            $wStmt->execute([$req->user['account_id'], $type]);
            $newBalance = (int)$wStmt->fetchColumn();

            $invId     = generateId();
            $invNumber = $this->nextInvoiceNumber($pdo);
            $amount    = (float)$payment['amount_inr'];
            $items     = [['name' => ucfirst($type) . " credits × $credits", 'qty' => $credits, 'rate' => round($amount / max(1,$credits), 2), 'amount' => $amount]];

            $pdo->prepare(
                "INSERT INTO invoices (id, account_id, number, payment_id, subtotal_inr, gst_inr, total_inr, items_json, status, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$invId, $req->user['account_id'], $invNumber, $orderId, $amount, 0, $amount, json_encode($items), 'paid', nowDb()]);

            $pdo->prepare(
                "INSERT INTO transactions (id, account_id, wallet_type, kind, credits_delta, balance_after, amount_inr, payment_id, invoice_id, meta, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([generateId(), $req->user['account_id'], $type, 'topup', $credits, $newBalance, $amount, $payment['id'], $invId, 'Top-up via Razorpay', nowDb()]);

            $pdo->prepare("UPDATE payments SET status='captured', rzp_payment_id=?, rzp_signature=?, invoice_id=?, captured_at=? WHERE rzp_order_id=?")
                ->execute([$payId, $sig, $invId, nowDb(), $orderId]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Wallet/verify] ' . $e->getMessage());
            Response::error('Failed to credit wallet. Contact support with order ID: ' . $orderId, 500);
        }

        AuditLog::fromRequest($req, 'wallet.topup', "$type:$credits credits");

        // Email invoice
        $uStmt = db()->prepare("SELECT email, name FROM users WHERE id = ?");
        $uStmt->execute([$req->user['id']]);
        $u = $uStmt->fetch();
        if ($u) {
            Mailer::send($u['email'], $u['name'], "Invoice #{$invNumber} — Mediview", 'email-invoice', [
                'name'           => $u['name'],
                'invoice_number' => $invNumber,
                'amount'         => '₹' . number_format($amount, 2),
            ]);
        }

        $ifs = db()->prepare("SELECT * FROM invoices WHERE id = ?");
        $ifs->execute([$invId]);
        Response::json(['balance' => $newBalance, 'invoice_id' => $invId, 'invoice' => $ifs->fetch()]);
    }

    public function auto(Request $req): void {
        $body = $req->body();
        $type = $body['type'] ?? 'print';
        if (!in_array($type, ['print','ai'], true)) Response::error('Invalid type', 400);

        $fields = []; $vals = [];
        if (isset($body['auto_recharge'])) { $fields[] = 'auto_recharge = ?'; $vals[] = (int)(bool)$body['auto_recharge']; }
        if (isset($body['threshold']))     { $fields[] = 'threshold = ?';     $vals[] = (int)$body['threshold']; }
        if (isset($body['auto_amount']))   { $fields[] = 'auto_amount = ?';   $vals[] = (int)$body['auto_amount']; }
        if (!$fields) Response::error('Nothing to update', 400);

        $vals[] = $req->user['account_id'];
        $vals[] = $type;
        db()->prepare("UPDATE wallets SET " . implode(', ', $fields) . " WHERE account_id = ? AND type = ?")->execute($vals);
        Response::ok();
    }

    /** EXE endpoint — no JWT, uses license_key + fingerprint */
    /**
     * GET /wallet/balance?license_key=...&fingerprint=...&type=print|ai
     * No JWT — authenticated by license_key + fingerprint pair just like /wallet/spend.
     * Lets the desktop app and any non-browser client read the same balance the
     * dashboard shows, so the two are always in sync.
     */
    public function balance(Request $req): void {
        $key  = trim((string)$req->query('license_key', ''));
        $fp   = trim((string)$req->query('fingerprint', ''));
        $type = (string)$req->query('type', 'print');

        if (!$key || !$fp)                                   Response::error('license_key and fingerprint required', 400);
        if (!in_array($type, ['print','ai'], true))          Response::error('Invalid wallet type', 400);

        // Resolve the account that owns this license key + device pair.
        $stmt = db()->prepare(
            "SELECT l.account_id, l.status as license_status, d.status as device_status
             FROM licenses l JOIN devices d ON d.license_id=l.id
             WHERE l.key_code=? AND d.fingerprint=? LIMIT 1"
        );
        $stmt->execute([$key, $fp]);
        $row = $stmt->fetch();
        if (!$row)                                Response::error('License or device not found', 404);
        if ($row['license_status'] !== 'active')  Response::error('License is ' . $row['license_status'], 403);
        if ($row['device_status']  !== 'active')  Response::error('Device is ' . $row['device_status'],  403);

        $wStmt = db()->prepare("SELECT balance FROM wallets WHERE account_id=? AND type=?");
        $wStmt->execute([$row['account_id'], $type]);
        $balance = (int)($wStmt->fetchColumn() ?: 0);

        Response::json(['balance' => $balance, 'type' => $type]);
    }

    public function spend(Request $req): void {
        RateLimiter::hit('spend:ip:' . $req->clientIp(), 60, 60);

        $body    = $req->body();
        $key     = trim($body['license_key'] ?? '');
        $fp      = trim($body['fingerprint']  ?? '');
        $type    = $body['type']    ?? 'print';
        $credits = (int)($body['credits'] ?? 0);
        $meta    = $body['meta']    ?? '';

        if (!$key || !$fp || $credits < 1) Response::error('Required fields missing', 400);

        $stmt = db()->prepare(
            "SELECT l.account_id FROM licenses l JOIN devices d ON d.license_id=l.id
             WHERE l.key_code=? AND d.fingerprint=? AND d.status='active' AND l.status='active' LIMIT 1"
        );
        $stmt->execute([$key, $fp]);
        $row = $stmt->fetch();
        if (!$row) Response::error('License or device not valid', 403);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $wStmt = $pdo->prepare("SELECT balance FROM wallets WHERE account_id=? AND type=? FOR UPDATE");
            $wStmt->execute([$row['account_id'], $type]);
            $balance = (int)$wStmt->fetchColumn();

            if ($balance < $credits) {
                $pdo->rollBack();
                Response::error('Insufficient credits', 402, ['balance' => $balance, 'required' => $credits]);
            }

            $newBalance = $balance - $credits;
            $pdo->prepare("UPDATE wallets SET balance=? WHERE account_id=? AND type=?")->execute([$newBalance, $row['account_id'], $type]);
            $pdo->prepare(
                "INSERT INTO transactions (id, account_id, wallet_type, kind, credits_delta, balance_after, meta, created_at)
                 VALUES (?,?,?,?,?,?,?,?)"
            )->execute([generateId(), $row['account_id'], $type, 'spend', -$credits, $newBalance, $meta, nowDb()]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Wallet/spend] ' . $e->getMessage());
            Response::error('Failed to debit wallet', 500);
        }

        Response::json(['ok' => true, 'balance' => $newBalance]);
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
