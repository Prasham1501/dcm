<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

class Mailer {

    public static function send(
        string $toEmail,
        string $toName,
        string $subject,
        string $templateName,
        array  $vars = [],
        ?string $attachmentPath = null,
        ?string $attachmentName = null
    ): bool {
        $body = self::renderTemplate($templateName, $vars);

        if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
            return self::sendViaSMTP($toEmail, $toName, $subject, $body, $attachmentPath, $attachmentName);
        }

        // Fallback: PHP mail()
        $headers  = "MIME-Version: 1.0\r\nContent-type: text/html; charset=utf-8\r\n";
        $headers .= "From: " . Settings::get('brand.name','Mediview') . " <" . Settings::get('smtp.from_email') . ">\r\n";
        return mail($toEmail, $subject, $body, $headers);
    }

    private static function sendViaSMTP(
        string  $toEmail,
        string  $toName,
        string  $subject,
        string  $body,
        ?string $attachmentPath,
        ?string $attachmentName
    ): bool {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = Settings::get('smtp.host');
            $mail->Port       = (int)Settings::get('smtp.port', '587');
            $mail->SMTPAuth   = true;
            $mail->Username   = Settings::get('smtp.username');
            $mail->Password   = Settings::get('smtp.password');
            $mail->SMTPSecure = Settings::get('smtp.encryption', 'tls');
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom(Settings::get('smtp.from_email'), Settings::get('brand.name', 'Mediview'));
            $mail->addAddress($toEmail, $toName);
            $mail->Subject = $subject;
            $mail->isHTML(true);
            $mail->Body    = $body;
            $mail->AltBody = strip_tags($body);

            if ($attachmentPath && file_exists($attachmentPath)) {
                $mail->addAttachment($attachmentPath, $attachmentName ?? basename($attachmentPath));
            }

            $mail->send();
            return true;
        } catch (MailException $e) {
            error_log('[Mailer] ' . $e->getMessage());
            return false;
        }
    }

    public static function renderTemplate(string $name, array $vars): string {
        $path = dirname(__DIR__) . "/templates/{$name}.html";
        if (!file_exists($path)) {
            // Plain fallback
            $body = "<p>" . nl2br(htmlspecialchars($vars['message'] ?? $name)) . "</p>";
            return self::wrap($vars['subject'] ?? $name, $body);
        }

        $tpl = file_get_contents($path);
        foreach ($vars as $k => $v) {
            $tpl = str_replace("{{" . $k . "}}", htmlspecialchars((string)$v, ENT_QUOTES), $tpl);
        }
        return $tpl;
    }

    private static function wrap(string $title, string $body): string {
        $brand = Settings::get('brand.name', 'Mediview');
        return <<<HTML
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>$title</title></head>
<body style="font-family:Inter,sans-serif;background:#f8fafc;padding:40px 0;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
<div style="background:#DC2626;padding:24px 32px;">
  <h1 style="color:#fff;margin:0;font-size:22px;">$brand</h1>
</div>
<div style="padding:32px;color:#0f172a;">
$body
</div>
<div style="padding:16px 32px;background:#f1f5f9;font-size:12px;color:#64748b;">
  © 2026 $brand. All rights reserved.
</div>
</div>
</body></html>
HTML;
    }
}
