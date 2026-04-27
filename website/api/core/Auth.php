<?php
declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Auth {

    private static function secret(): string {
        $s = getenv('JWT_SECRET');
        if (!$s) throw new \RuntimeException('JWT_SECRET not set');
        return $s;
    }

    /** Issue a signed JWT (7-day expiry) */
    public static function issueToken(string $userId, string $accountId, string $role): string {
        $now = time();
        $payload = [
            'sub'  => $userId,
            'aid'  => $accountId,
            'role' => $role,
            'iat'  => $now,
            'exp'  => $now + 7 * 86400,
        ];

        // Use firebase/php-jwt if available, else simple HMAC fallback
        if (class_exists('Firebase\JWT\JWT')) {
            return JWT::encode($payload, self::secret(), 'HS256');
        }
        return self::simpleEncode($payload);
    }

    /** Verify and decode a JWT — exits with 401 on failure */
    public static function verifyToken(string $jwt): array {
        try {
            if (class_exists('Firebase\JWT\JWT')) {
                $decoded = JWT::decode($jwt, new Key(self::secret(), 'HS256'));
                return (array)$decoded;
            }
            return self::simpleDecode($jwt);
        } catch (\Throwable $e) {
            Response::error('Token invalid or expired', 401);
        }
    }

    public static function passwordHash(string $password): string {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    public static function passwordVerify(string $password, string $hash): bool {
        return password_verify($password, $hash);
    }

    /** Generate a cryptographically-random hex token */
    public static function generateToken(int $bytes = 32): string {
        return bin2hex(random_bytes($bytes));
    }

    // ── Fallback JWT (works without firebase/php-jwt) ──────────────────────

    private static function simpleEncode(array $payload): string {
        $header  = self::b64url(json_encode(['alg'=>'HS256','typ'=>'JWT']));
        $body    = self::b64url(json_encode($payload));
        $sig     = self::b64url(hash_hmac('sha256', "$header.$body", self::secret(), true));
        return "$header.$body.$sig";
    }

    private static function simpleDecode(string $jwt): array {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) throw new \RuntimeException('Bad token');
        [$header, $body, $sig] = $parts;
        $expected = self::b64url(hash_hmac('sha256', "$header.$body", self::secret(), true));
        if (!hash_equals($expected, $sig)) throw new \RuntimeException('Bad signature');
        $payload = json_decode(self::b64urlDecode($body), true);
        if (!$payload || ($payload['exp'] ?? 0) < time()) throw new \RuntimeException('Expired');
        return $payload;
    }

    private static function b64url(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64urlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
