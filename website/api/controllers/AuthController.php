<?php
declare(strict_types=1);

class AuthController {

    public function signup(Request $req): void {
        RateLimiter::hit('signup:ip:' . $req->clientIp(), 10, 3600);

        $body = $req->body();
        Validator::make($body, [
            'name'     => 'required|min:2|max:100',
            'email'    => 'required|email',
            'password' => 'required|password',
        ])->throwIfFails();

        $email = strtolower(trim($body['email']));
        $name  = trim($body['name']);

        // Check existing
        $existing = db()->prepare("SELECT id FROM users WHERE email = ?");
        $existing->execute([$email]);
        if ($existing->fetch()) Response::error('Email already registered', 409);

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $accountId = generateId();
            $userId    = generateId();
            $now       = nowDb();

            // Referral handling
            $referredBy = null;
            if (!empty($body['referral_code'])) {
                $refStmt = $pdo->prepare("SELECT account_id FROM referrals WHERE code = ?");
                $refStmt->execute([$body['referral_code']]);
                $refRow = $refStmt->fetch();
                if ($refRow) $referredBy = $refRow['account_id'];
            }

            $pdo->prepare(
                "INSERT INTO accounts (id, name, plan, status, referred_by, created_at) VALUES (?,?,?,?,?,?)"
            )->execute([$accountId, $name . "'s Clinic", 'free', 'active', $referredBy, $now]);

            $pdo->prepare(
                "INSERT INTO users (id, account_id, name, email, password_hash, role, email_verified, created_at) VALUES (?,?,?,?,?,?,?,?)"
            )->execute([$userId, $accountId, $name, $email, Auth::passwordHash($body['password']), 'admin', 0, $now]);

            // Email verification token
            $verifToken = Auth::generateToken(32);
            $pdo->prepare(
                "INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?,?,?,?)"
            )->execute([generateId(), $userId, $verifToken, gmdate('Y-m-d H:i:s', time() + 86400)]);

            // Referral record for this new account
            $pdo->prepare(
                "INSERT INTO referrals (id, account_id, code, created_at) VALUES (?,?,?,?)"
            )->execute([generateId(), $accountId, strtoupper(substr($name, 0, 4) . '-' . strtoupper(bin2hex(random_bytes(3)))), $now]);

            // Issue trial license
            $keyCode = LicenseKey::generate();
            $trialDays = (int)Settings::get('pricing.trial_days', '30');
            $trialSeats= (int)Settings::get('pricing.trial_seats', '1');
            $licId     = generateId();
            $expires   = gmdate('Y-m-d H:i:s', time() + $trialDays * 86400);
            $hmac      = LicenseKey::sign($keyCode, ['plan' => 'trial', 'account' => $accountId]);

            $pdo->prepare(
                "INSERT INTO licenses (id, account_id, key_code, plan, seats, status, starts_at, expires_at, hmac_signature, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            )->execute([$licId, $accountId, $keyCode, 'trial', $trialSeats, 'active', $now, $expires, $hmac, $now]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            error_log('[Auth/signup] ' . $e->getMessage());
            Response::error('Registration failed. Please try again.', 500);
        }

        AuditLog::log('auth.signup', $email, [], $accountId, $userId, $name, $req->clientIp());

        // Send verification email (non-fatal — user is already registered)
        try {
            $verifyUrl = rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/verify-email?token=' . $verifToken;
            Mailer::send($email, $name, 'Verify your Mediview email', 'email-verify', [
                'name'       => $name,
                'verify_url' => $verifyUrl,
            ]);
        } catch (\Throwable $e) {
            error_log('[Auth/signup] Verify email failed: ' . $e->getMessage());
        }

        // Send welcome + trial key (non-fatal)
        try {
            Mailer::send($email, $name, 'Welcome to Mediview — your trial license key', 'email-license', [
                'name'         => $name,
                'key_code'     => $keyCode,
                'plan'         => 'Trial',
                'seats'        => $trialSeats,
                'expires_at'   => date('d M Y', strtotime($expires)),
                'download_url' => rtrim(getenv('APP_URL'), '/') . '/api/download/exe',
            ]);
        } catch (\Throwable $e) {
            error_log('[Auth/signup] License email failed: ' . $e->getMessage());
        }

        // Reward referrer
        if ($referredBy) {
            try {
                $bonus = 200;
                $pdo->prepare("UPDATE referrals SET signups = signups+1, credits_earned = credits_earned+? WHERE account_id=?")
                    ->execute([$bonus, $referredBy]);
                $pdo->prepare("INSERT INTO wallets (account_id, type, balance) VALUES (?,?,?) ON DUPLICATE KEY UPDATE balance=balance+?")
                    ->execute([$referredBy, 'print', $bonus, $bonus]);
            } catch (\Throwable) {}
        }

        $token = Auth::issueToken($userId, $accountId, 'admin');

        $uStmt = db()->prepare("SELECT * FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $user = $uStmt->fetch();

        Response::json(['token' => $token, 'user' => $this->safeUser($user)], 201);
    }

    public function login(Request $req): void {
        RateLimiter::hit('login:ip:' . $req->clientIp(), 20, 900);

        $body = $req->body();
        Validator::make($body, [
            'email'    => 'required|email',
            'password' => 'required',
        ])->throwIfFails();

        $email = strtolower(trim($body['email']));

        $stmt = db()->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !Auth::passwordVerify($body['password'], $user['password_hash'] ?? '')) {
            Response::error('Invalid email or password', 401);
        }

        db()->prepare("UPDATE users SET last_login_at=?, last_login_ip=? WHERE id=?")
            ->execute([nowDb(), $req->clientIp(), $user['id']]);

        AuditLog::log('auth.login', $email, [], $user['account_id'], $user['id'], $user['name'], $req->clientIp());

        $token = Auth::issueToken($user['id'], $user['account_id'], $user['role']);
        Response::json(['token' => $token, 'user' => $this->safeUser($user)]);
    }

    public function google(Request $req): void {
        $body    = $req->body();
        $idToken = $body['id_token'] ?? '';
        if (!$idToken) Response::error('id_token required', 400);

        try {
            $info = GoogleAuth::verify($idToken);
        } catch (\Throwable $e) {
            Response::error('Google sign-in failed: ' . $e->getMessage(), 401);
        }

        $email = strtolower($info['email']);

        $stmt = db()->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        $pdo = db();
        if (!$user) {
            // Auto-register
            $pdo->beginTransaction();
            try {
                $accountId = generateId();
                $userId    = generateId();
                $name      = $info['name'];
                $now       = nowDb();

                $pdo->prepare("INSERT INTO accounts (id, name, plan, status, created_at) VALUES (?,?,?,?,?)")
                    ->execute([$accountId, $name . "'s Clinic", 'free', 'active', $now]);

                $pdo->prepare("INSERT INTO users (id, account_id, name, email, password_hash, role, google_sub, email_verified, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
                    ->execute([$userId, $accountId, $name, $email, null, 'admin', $info['sub'], 1, $now]);

                $pdo->prepare("INSERT INTO referrals (id, account_id, code, created_at) VALUES (?,?,?,?)")
                    ->execute([generateId(), $accountId, strtoupper(substr($name,0,4) . '-' . strtoupper(bin2hex(random_bytes(3)))), $now]);

                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                Response::error('Registration failed', 500);
            }

            $stmt2 = db()->prepare("SELECT * FROM users WHERE id = ?");
            $stmt2->execute([$userId]);
            $user = $stmt2->fetch();
        } else {
            $userId    = $user['id'];
            $accountId = $user['account_id'];
            db()->prepare("UPDATE users SET google_sub=?, email_verified=1, last_login_at=?, last_login_ip=? WHERE id=?")
                ->execute([$info['sub'], nowDb(), $req->clientIp(), $userId]);
        }

        AuditLog::log('auth.google', $email, [], $user['account_id'], $user['id'], $user['name'], $req->clientIp());
        $token = Auth::issueToken($user['id'], $user['account_id'], $user['role']);
        Response::json(['token' => $token, 'user' => $this->safeUser($user)]);
    }

    public function logout(Request $req): void {
        // JWT is stateless — client just drops the token.
        // Log it for audit trail.
        AuditLog::fromRequest($req, 'auth.logout');
        Response::ok();
    }

    public function me(Request $req): void {
        // Refresh user from DB
        $stmt = db()->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$req->user['id']]);
        $user = $stmt->fetch();
        Response::json(['user' => $this->safeUser($user ?: $req->user)]);
    }

    public function updateProfile(Request $req): void {
        $body = $req->body();
        $name = trim($body['name'] ?? '');
        if ($name) {
            db()->prepare("UPDATE users SET name=?, updated_at=? WHERE id=?")
                ->execute([$name, nowDb(), $req->user['id']]);
        }
        Response::ok(['name' => $name]);
    }

    public function changePassword(Request $req): void {
        $body = $req->body();
        Validator::make($body, [
            'current_password' => 'required',
            'new_password'     => 'required|password',
        ])->throwIfFails();

        $stmt = db()->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$req->user['id']]);
        $user = $stmt->fetch();

        if (!Auth::passwordVerify($body['current_password'], $user['password_hash'] ?? '')) {
            Response::error('Current password is incorrect', 400);
        }

        db()->prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?")
            ->execute([Auth::passwordHash($body['new_password']), nowDb(), $req->user['id']]);

        AuditLog::fromRequest($req, 'auth.change_password');
        Response::ok();
    }

    public function forgot(Request $req): void {
        $body  = $req->body();
        $email = strtolower(trim($body['email'] ?? ''));
        if (!$email) Response::ok(); // Always 200

        $stmt = db()->prepare("SELECT id, name FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user) {
            $token   = Auth::generateToken(32);
            $expires = gmdate('Y-m-d H:i:s', time() + 3600);

            db()->prepare("DELETE FROM password_resets WHERE email = ?")->execute([$email]);
            db()->prepare("INSERT INTO password_resets (id, email, token, expires_at) VALUES (?,?,?,?)")
                ->execute([generateId(), $email, $token, $expires]);

            $resetUrl = rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/reset?token=' . $token;
            try {
                Mailer::send($email, $user['name'], 'Reset your Mediview password', 'email-reset', [
                    'name'      => $user['name'],
                    'reset_url' => $resetUrl,
                ]);
            } catch (\Throwable $e) {
                error_log('[Auth/forgot] Reset email failed: ' . $e->getMessage());
            }
        }

        Response::ok(['message' => 'If that email exists, a reset link has been sent.']);
    }

    public function reset(Request $req): void {
        $body  = $req->body();
        $token = trim($body['token'] ?? '');
        $pw    = $body['password'] ?? '';

        Validator::make(['password' => $pw], ['password' => 'required|password'])->throwIfFails();

        $stmt = db()->prepare("SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > NOW()");
        $stmt->execute([$token]);
        $reset = $stmt->fetch();
        if (!$reset) Response::error('Reset link is invalid or expired', 400);

        $uStmt = db()->prepare("SELECT id FROM users WHERE email = ?");
        $uStmt->execute([$reset['email']]);
        $user = $uStmt->fetch();
        if (!$user) Response::error('User not found', 404);

        db()->prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?")
            ->execute([Auth::passwordHash($pw), nowDb(), $user['id']]);
        db()->prepare("UPDATE password_resets SET used_at=? WHERE id=?")
            ->execute([nowDb(), $reset['id']]);

        Response::ok(['message' => 'Password updated. You can now sign in.']);
    }

    public function verifyEmail(Request $req): void {
        $body  = $req->body();
        $token = trim($body['token'] ?? '');

        $stmt = db()->prepare("SELECT * FROM email_verifications WHERE token = ? AND used_at IS NULL AND expires_at > NOW()");
        $stmt->execute([$token]);
        $ev = $stmt->fetch();
        if (!$ev) Response::error('Verification link is invalid or expired', 400);

        db()->prepare("UPDATE users SET email_verified=1, updated_at=? WHERE id=?")
            ->execute([nowDb(), $ev['user_id']]);
        db()->prepare("UPDATE email_verifications SET used_at=? WHERE id=?")
            ->execute([nowDb(), $ev['id']]);

        Response::ok(['message' => 'Email verified.']);
    }

    public function resendVerify(Request $req): void {
        RateLimiter::hit('resend:user:' . $req->user['id'], 3, 3600);

        $token   = Auth::generateToken(32);
        $expires = gmdate('Y-m-d H:i:s', time() + 86400);

        db()->prepare("DELETE FROM email_verifications WHERE user_id = ?")->execute([$req->user['id']]);
        db()->prepare("INSERT INTO email_verifications (id, user_id, token, expires_at) VALUES (?,?,?,?)")
            ->execute([generateId(), $req->user['id'], $token, $expires]);

        $verifyUrl = rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/verify-email?token=' . $token;
        try {
            Mailer::send($req->user['email'], $req->user['name'], 'Verify your Mediview email', 'email-verify', [
                'name'       => $req->user['name'],
                'verify_url' => $verifyUrl,
            ]);
        } catch (\Throwable $e) {
            error_log('[Auth/resend-verify] Email failed: ' . $e->getMessage());
        }

        Response::ok(['message' => 'Verification email sent.']);
    }

    private function safeUser(array $user): array {
        unset($user['password_hash']);
        return $user;
    }
}
