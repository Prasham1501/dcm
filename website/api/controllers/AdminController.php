<?php
declare(strict_types=1);

class AdminController {

    public function overview(Request $req): void {
        $stats = [];
        $stats['total_accounts']  = (int)db()->query("SELECT COUNT(*) FROM accounts WHERE id != 'acc_superadmin00'")->fetchColumn();
        $stats['total_licenses']  = (int)db()->query("SELECT COUNT(*) FROM licenses")->fetchColumn();
        $stats['active_licenses'] = (int)db()->query("SELECT COUNT(*) FROM licenses WHERE status='active'")->fetchColumn();
        $stats['total_revenue']   = (float)db()->query("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status='captured'")->fetchColumn();
        $stats['open_tickets']    = (int)db()->query("SELECT COUNT(*) FROM tickets WHERE status='open'")->fetchColumn();
        $stats['total_devices']   = (int)db()->query("SELECT COUNT(*) FROM devices WHERE status='active'")->fetchColumn();

        // Revenue last 30d
        $rev30 = db()->prepare("SELECT COALESCE(SUM(amount_inr),0) FROM payments WHERE status='captured' AND captured_at >= ?");
        $rev30->execute([gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
        $stats['revenue_30d'] = (float)$rev30->fetchColumn();

        // New accounts last 30d
        $new30 = db()->prepare("SELECT COUNT(*) FROM accounts WHERE created_at >= ? AND id != 'acc_superadmin00'");
        $new30->execute([gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
        $stats['new_accounts_30d'] = (int)$new30->fetchColumn();

        Response::json($stats);
    }

    public function accounts(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;
        $search = $req->query('q', '');

        if ($search) {
            $stmt = db()->prepare(
                "SELECT a.*, u.email as owner_email, u.name as owner_name,
                        (SELECT COUNT(*) FROM licenses l WHERE l.account_id=a.id) as licenses,
                        (SELECT COUNT(*) FROM devices d WHERE d.account_id=a.id AND d.status='active') as active_devices
                 FROM accounts a LEFT JOIN users u ON u.account_id=a.id AND u.role='admin'
                 WHERE a.id != 'acc_superadmin00' AND (a.name LIKE ? OR u.email LIKE ?)
                 ORDER BY a.created_at DESC LIMIT ? OFFSET ?"
            );
            $like = "%$search%";
            $stmt->execute([$like, $like, $limit, $off]);
        } else {
            $stmt = db()->prepare(
                "SELECT a.*, u.email as owner_email, u.name as owner_name,
                        (SELECT COUNT(*) FROM licenses l WHERE l.account_id=a.id) as licenses,
                        (SELECT COUNT(*) FROM devices d WHERE d.account_id=a.id AND d.status='active') as active_devices
                 FROM accounts a LEFT JOIN users u ON u.account_id=a.id AND u.role='admin'
                 WHERE a.id != 'acc_superadmin00'
                 ORDER BY a.created_at DESC LIMIT ? OFFSET ?"
            );
            $stmt->execute([$limit, $off]);
        }
        $accounts = $stmt->fetchAll();

        $total = (int)db()->query("SELECT COUNT(*) FROM accounts WHERE id != 'acc_superadmin00'")->fetchColumn();
        Response::json(['data' => $accounts, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function licenses(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT l.*, a.name as account_name, u.email as owner_email,
                    (SELECT COUNT(*) FROM devices d WHERE d.license_id=l.id AND d.status='active') as seats_used
             FROM licenses l
             JOIN accounts a ON a.id=l.account_id
             LEFT JOIN users u ON u.account_id=l.account_id AND u.role='admin'
             ORDER BY l.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute([$limit, $off]);
        $licenses = $stmt->fetchAll();
        $total = (int)db()->query("SELECT COUNT(*) FROM licenses")->fetchColumn();
        Response::json(['data' => $licenses, 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function revokeLicense(Request $req): void {
        $id = $req->param('id');
        db()->prepare("UPDATE licenses SET status='revoked' WHERE id=?")->execute([$id]);
        AuditLog::fromRequest($req, 'admin.license.revoke', $id);
        Response::ok();
    }

    public function payments(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT p.*, a.name as account_name, u.email as owner_email
             FROM payments p
             JOIN accounts a ON a.id=p.account_id
             LEFT JOIN users u ON u.account_id=p.account_id AND u.role='admin'
             ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute([$limit, $off]);
        $total = (int)db()->query("SELECT COUNT(*) FROM payments")->fetchColumn();
        Response::json(['data' => $stmt->fetchAll(), 'total' => $total, 'page' => $page, 'per_page' => $limit]);
    }

    public function invoices(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 25;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare(
            "SELECT i.*, a.name as account_name, u.email as owner_email
             FROM invoices i
             JOIN accounts a ON a.id=i.account_id
             LEFT JOIN users u ON u.account_id=i.account_id AND u.role='admin'
             ORDER BY i.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute([$limit, $off]);
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
            "SELECT t.*, a.name as account_name, u.email as user_email,
                    (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id=t.id) as message_count
             FROM tickets t
             JOIN accounts a ON a.id=t.account_id
             JOIN users u ON u.id=t.user_id
             ORDER BY t.created_at DESC LIMIT ? OFFSET ?"
        );
        $stmt->execute([$limit, $off]);
        $total = (int)db()->query("SELECT COUNT(*) FROM tickets")->fetchColumn();
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

    public function audit(Request $req): void {
        $page  = max(1, (int)$req->query('page', 1));
        $limit = 50;
        $off   = ($page - 1) * $limit;

        $stmt = db()->prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->execute([$limit, $off]);
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
}
