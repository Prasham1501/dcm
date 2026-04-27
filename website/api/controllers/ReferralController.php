<?php
declare(strict_types=1);

class ReferralController {

    public function index(Request $req): void {
        $stmt = db()->prepare("SELECT * FROM referrals WHERE account_id = ?");
        $stmt->execute([$req->user['account_id']]);
        $ref = $stmt->fetch();

        if (!$ref) {
            // Auto-create referral record
            $code = strtoupper(substr($req->user['name'] ?? 'USER', 0, 4) . '-' . strtoupper(bin2hex(random_bytes(3))));
            $id   = generateId();
            try {
                db()->prepare("INSERT INTO referrals (id, account_id, code, created_at) VALUES (?,?,?,?)")
                    ->execute([$id, $req->user['account_id'], $code, nowDb()]);
            } catch (\Throwable) {
                // Duplicate code — try again with more random
                $code = strtoupper(bin2hex(random_bytes(6)));
                db()->prepare("INSERT IGNORE INTO referrals (id, account_id, code, created_at) VALUES (?,?,?,?)")
                    ->execute([$id, $req->user['account_id'], $code, nowDb()]);
            }
            $ref = ['code' => $code, 'signups' => 0, 'credits_earned' => 0];
        }

        $refUrl = rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/signup?ref=' . $ref['code'];
        Response::json([
            'code'           => $ref['code'],
            'signups'        => (int)$ref['signups'],
            'credits_earned' => (int)$ref['credits_earned'],
            'referral_url'   => $refUrl,
            'bonus_per_signup' => 200,
        ]);
    }
}
