<?php
declare(strict_types=1);

class ContactController {

    public function submit(Request $req): void {
        RateLimiter::hit('contact:ip:' . $req->clientIp(), 5, 3600);

        $body = $req->body();
        Validator::make($body, [
            'name'    => 'required|min:2|max:100',
            'email'   => 'required|email',
            'message' => 'required|min:10',
        ])->throwIfFails();

        $id = generateId();
        db()->prepare(
            "INSERT INTO contact_submissions (id, name, email, subject, message, ip, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([$id, $body['name'], $body['email'], $body['subject'] ?? '', $body['message'], $req->clientIp(), nowDb()]);

        // Forward to support email (non-fatal)
        $adminEmail = Settings::get('brand.support_email');
        if ($adminEmail) {
            try {
                Mailer::send($adminEmail, 'Mediview Admin', '[Contact] ' . ($body['subject'] ?? 'New message from ' . $body['name']), 'email-ticket-reply', [
                    'subject' => 'Contact form: ' . ($body['subject'] ?? 'General enquiry'),
                    'from'    => $body['name'] . ' <' . $body['email'] . '>',
                    'message' => $body['message'],
                    'ticket_url' => '',
                ]);
            } catch (\Throwable $e) { error_log('[Contact] Admin email failed: ' . $e->getMessage()); }
        }

        // Auto-reply to sender (non-fatal)
        try {
            Mailer::send($body['email'], $body['name'], "We've received your message — Mediview", 'email-ticket-reply', [
                'subject' => 'We received your message',
                'from'    => Settings::get('brand.name', 'Mediview'),
                'message' => "Hi {$body['name']},\n\nThank you for reaching out! We've received your message and will get back to you within 1 business day.\n\nYour message:\n{$body['message']}",
                'ticket_url' => '',
            ]);
        } catch (\Throwable $e) { error_log('[Contact] Auto-reply failed: ' . $e->getMessage()); }

        Response::ok(['message' => 'Your message has been sent. We\'ll get back to you soon!']);
    }
}
