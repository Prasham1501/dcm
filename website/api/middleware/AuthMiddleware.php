<?php
declare(strict_types=1);

class AuthMiddleware {

    public static function handle(Request $req): void {
        $token = $req->bearerToken();

        // Fallback: accept token from query string (for direct browser downloads like PDF)
        if (!$token && !empty($_GET['token'])) {
            $token = $_GET['token'];
        }

        if (!$token) {
            Response::error('Authentication required', 401);
        }

        // API key path
        if (str_starts_with($token, 'mv_live_') || str_starts_with($token, 'mv_test_')) {
            self::handleApiKey($req, $token);
            return;
        }

        // JWT path
        $payload = Auth::verifyToken($token);

        $stmt = db()->prepare(
            "SELECT u.*, a.id as account_id FROM users u
             JOIN accounts a ON a.id = u.account_id
             WHERE u.id = ? AND u.account_id IS NOT NULL"
        );
        $stmt->execute([$payload['sub']]);
        $user = $stmt->fetch();

        if (!$user) Response::error('User not found', 401);

        // Auto-refresh token if over 24h old
        if (($payload['iat'] ?? 0) < time() - 86400) {
            $fresh = Auth::issueToken($user['id'], $user['account_id'], $user['role']);
            header('X-Refreshed-Token: ' . $fresh);
        }

        $req->user = $user;
    }

    private static function handleApiKey(Request $req, string $plainKey): void {
        $prefix = substr($plainKey, 0, 12);

        $stmt = db()->prepare(
            "SELECT k.*, u.id as user_id, u.name, u.role, u.account_id
             FROM api_keys k JOIN users u ON u.id = k.user_id
             WHERE k.prefix = ? AND k.revoked_at IS NULL"
        );
        $stmt->execute([$prefix]);
        $row = $stmt->fetch();

        if (!$row || !Auth::passwordVerify($plainKey, $row['key_hash'])) {
            Response::error('Invalid API key', 401);
        }

        db()->prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
            ->execute([nowDb(), $row['id']]);

        $req->user = [
            'id'         => $row['user_id'],
            'name'       => $row['name'],
            'role'       => $row['role'],
            'account_id' => $row['account_id'],
        ];
    }
}
