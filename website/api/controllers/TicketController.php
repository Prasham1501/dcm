<?php
declare(strict_types=1);

class TicketController {

    public function index(Request $req): void {
        $stmt = db()->prepare(
            "SELECT t.*, (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id=t.id) AS message_count
             FROM tickets t WHERE t.account_id = ? ORDER BY t.created_at DESC LIMIT 50"
        );
        $stmt->execute([$req->user['account_id']]);
        $tickets = $stmt->fetchAll();

        foreach ($tickets as &$t) {
            $mStmt = db()->prepare("SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC");
            $mStmt->execute([$t['id']]);
            $t['messages'] = $mStmt->fetchAll();
        }
        Response::json($tickets);
    }

    public function create(Request $req): void {
        $body = $req->body();
        Validator::make($body, [
            'category' => 'required',
            'subject'  => 'required|min:5|max:255',
            'body'     => 'required|min:10',
        ])->throwIfFails();

        $ticketId = generateId();
        $msgId    = generateId();
        $now      = nowDb();

        db()->prepare(
            "INSERT INTO tickets (id, account_id, user_id, category, subject, status, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([$ticketId, $req->user['account_id'], $req->user['id'], $body['category'], $body['subject'], 'open', $now]);

        db()->prepare(
            "INSERT INTO ticket_messages (id, ticket_id, sender_role, sender_id, body, attachments, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([$msgId, $ticketId, 'user', $req->user['id'], $body['body'], json_encode($body['attachments'] ?? []), $now]);

        AuditLog::fromRequest($req, 'ticket.create', $body['subject']);

        $adminEmail = Settings::get('brand.support_email');
        if ($adminEmail) {
            try {
                Mailer::send($adminEmail, 'Mediview Admin', '[New Ticket] ' . $body['subject'], 'email-ticket-reply', [
                    'subject'    => $body['subject'],
                    'from'       => $req->user['name'],
                    'message'    => $body['body'],
                    'ticket_url' => rtrim(getenv('APP_URL'), '/') . '/admin.html#/admin/tickets',
                ]);
            } catch (\Throwable $e) { error_log('[Ticket/create] Email failed: ' . $e->getMessage()); }
        }

        $ts = db()->prepare("SELECT * FROM tickets WHERE id = ?");
        $ts->execute([$ticketId]);
        $ticket = $ts->fetch();
        $ticket['messages'] = [['id' => $msgId, 'sender_role' => 'user', 'body' => $body['body'], 'created_at' => $now]];
        Response::json($ticket, 201);
    }

    public function reply(Request $req): void {
        $ticketId = $req->param('id');
        $body     = $req->body();
        $text     = $body['body'] ?? '';
        if (!$text) Response::error('Reply body required', 400);

        $stmt = db()->prepare("SELECT id, account_id, status, subject FROM tickets WHERE id = ?");
        $stmt->execute([$ticketId]);
        $ticket = $stmt->fetch();
        if (!$ticket || $ticket['account_id'] !== $req->user['account_id']) Response::error('Ticket not found', 404);
        if ($ticket['status'] === 'closed') Response::error('Cannot reply to a closed ticket', 400);

        $msgId = generateId();
        db()->prepare(
            "INSERT INTO ticket_messages (id, ticket_id, sender_role, sender_id, body, attachments, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([$msgId, $ticketId, 'user', $req->user['id'], $text, json_encode($body['attachments'] ?? []), nowDb()]);
        db()->prepare("UPDATE tickets SET status='open', closed_at=NULL WHERE id=?")->execute([$ticketId]);

        $adminEmail = Settings::get('brand.support_email');
        if ($adminEmail) {
            try {
                Mailer::send($adminEmail, 'Mediview Admin', '[Ticket Reply] ' . $ticket['subject'], 'email-ticket-reply', [
                    'subject'    => $ticket['subject'],
                    'from'       => $req->user['name'],
                    'message'    => $text,
                    'ticket_url' => rtrim(getenv('APP_URL'), '/') . '/admin.html#/admin/tickets',
                ]);
            } catch (\Throwable $e) { error_log('[Ticket/reply] Email failed: ' . $e->getMessage()); }
        }

        Response::ok(['message_id' => $msgId]);
    }

    public function close(Request $req): void {
        $ticketId = $req->param('id');
        $stmt = db()->prepare("SELECT id, account_id FROM tickets WHERE id = ?");
        $stmt->execute([$ticketId]);
        $ticket = $stmt->fetch();
        if (!$ticket || $ticket['account_id'] !== $req->user['account_id']) Response::error('Not found', 404);

        db()->prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")->execute([nowDb(), $ticketId]);
        AuditLog::fromRequest($req, 'ticket.close', $ticketId);
        Response::ok();
    }
}
