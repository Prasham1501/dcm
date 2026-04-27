<?php
declare(strict_types=1);

class LicenseKey {

    // Unambiguous alphabet: no 0, O, 1, I, L
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    /** Generate MV-XXXX-XXXX-XXXX-XXXX */
    public static function generate(): string {
        $parts = [];
        for ($i = 0; $i < 4; $i++) {
            $part = '';
            for ($j = 0; $j < 4; $j++) {
                $part .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $parts[] = $part;
        }
        return 'MV-' . implode('-', $parts);
    }

    /** HMAC-sign a key with a payload (for offline tamper-check) */
    public static function sign(string $keyCode, array $payload): string {
        $secret = self::hmacSecret();
        return hash_hmac('sha256', $keyCode . ':' . json_encode($payload, JSON_UNESCAPED_UNICODE), $secret);
    }

    /** Verify an HMAC signature */
    public static function verify(string $keyCode, array $payload, string $sig): bool {
        return hash_equals(self::sign($keyCode, $payload), $sig);
    }

    /** Validate key format: MV-XXXX-XXXX-XXXX-XXXX */
    public static function isValidFormat(string $key): bool {
        return (bool)preg_match('/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/', $key);
    }

    private static function hmacSecret(): string {
        $secret = Settings::get('license.hmac_secret');
        if (!$secret) {
            $secret = bin2hex(random_bytes(32));
            Settings::set('license.hmac_secret', $secret);
        }
        return $secret;
    }
}
