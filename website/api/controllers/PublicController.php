<?php
declare(strict_types=1);

class PublicController {

    public function health(Request $req): void {
        try {
            db()->query('SELECT 1');
            $dbOk = true;
        } catch (\Throwable) {
            $dbOk = false;
        }
        Response::json([
            'ok'    => $dbOk,
            'env'   => getenv('APP_ENV') ?: 'production',
            'php'   => PHP_VERSION,
            'db'    => $dbOk ? 'connected' : 'error',
            'ts'    => time(),
        ]);
    }

    public function config(Request $req): void {
        Response::json([
            'brand_name'       => Settings::get('brand.name', 'Mediview'),
            'brand_tagline'    => Settings::get('brand.tagline', ''),
            'support_email'    => Settings::get('brand.support_email', ''),
            'rzp_key_id'       => Settings::get('razorpay.key_id', ''),
            'razorpay_mode'    => Settings::get('razorpay.mode', 'test'),
            'google_client_id' => Settings::get('google.client_id', ''),
            'chat_enabled'     => Settings::get('feature.chat_enabled', '1') === '1',
            'referrals_enabled'=> Settings::get('feature.referrals_enabled', '1') === '1',
            'pricing'          => [
                'monthly_inr' => (int)Settings::get('pricing.monthly_inr', '8000'),
                'annual_inr'  => (int)Settings::get('pricing.annual_inr', '100000'),
                'trial_days'  => (int)Settings::get('pricing.trial_days', '30'),
            ],
        ]);
    }

    /** GET /setup — show setup form (one-time) */
    public function setupForm(Request $req): void {
        // Only allow if setup token file exists
        $tokenFile = __DIR__ . '/../.setup_token';
        if (!file_exists($tokenFile)) {
            Response::error('Setup already completed', 403);
        }

        header('Content-Type: text/html; charset=utf-8');
        echo <<<HTML
<!DOCTYPE html><html><head><title>Mediview First-Time Setup</title>
<style>body{font-family:sans-serif;max-width:440px;margin:80px auto;padding:24px;background:#f8fafc;}
input{width:100%;padding:10px;margin:8px 0;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;}
button{background:#DC2626;color:#fff;border:none;padding:12px 24px;border-radius:6px;cursor:pointer;width:100%;font-size:16px;}
h1{color:#DC2626;}</style>
</head><body>
<h1>Mediview Setup</h1>
<p>Set your super-admin password. This page self-destructs after first use.</p>
<form method="POST">
  <input type="password" name="password"  placeholder="New password (min 8 chars)" required/>
  <input type="password" name="password2" placeholder="Confirm password" required/>
  <button type="submit">Set Password &amp; Complete Setup</button>
</form>
</body></html>
HTML;
        exit;
    }

    /** POST /setup — set super-admin password */
    public function setup(Request $req): void {
        $tokenFile = __DIR__ . '/../.setup_token';
        if (!file_exists($tokenFile)) {
            Response::error('Setup already completed', 403);
        }

        $pw  = $_POST['password']  ?? '';
        $pw2 = $_POST['password2'] ?? '';

        if (strlen($pw) < 8)  { $this->setupError('Password must be at least 8 characters.'); }
        if ($pw !== $pw2)      { $this->setupError('Passwords do not match.'); }

        $hash = Auth::passwordHash($pw);
        db()->prepare("UPDATE users SET password_hash = ? WHERE role = 'super_admin' LIMIT 1")
            ->execute([$hash]);

        unlink($tokenFile);

        header('Content-Type: text/html; charset=utf-8');
        echo '<html><body style="font-family:sans-serif;max-width:440px;margin:80px auto;padding:24px;">
              <h1 style="color:#16a34a;">✓ Setup complete!</h1>
              <p>You can now <a href="/dashboard.html#/dashboard/login">sign in</a> with your email and new password.</p>
              </body></html>';
        exit;
    }

    private function setupError(string $msg): never {
        header('Content-Type: text/html; charset=utf-8');
        echo "<html><body style='font-family:sans-serif;max-width:440px;margin:80px auto;padding:24px;'>
              <p style='color:red;'>$msg</p><a href='/api/setup'>Back</a></body></html>";
        exit;
    }
}
