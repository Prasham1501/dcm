<?php
/**
 * Reversible encryption for sensitive stored values (PCPNDT portal passwords).
 * AES-256-CBC with a key derived from the OCZ_SECRET env var.
 * Set OCZ_SECRET to a strong random value in production.
 */
class RisCrypto
{
    private const CIPHER = 'aes-256-cbc';

    private static function key(): string
    {
        $secret = getenv('OCZ_SECRET') ?: 'oneclickz-default-key-change-me';
        return hash('sha256', $secret, true);
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(16);
        $cipher = openssl_encrypt($plain, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv);
        return $cipher === false ? '' : base64_encode($iv . $cipher);
    }

    public static function decrypt(string $enc): string
    {
        $raw = base64_decode($enc, true);
        if ($raw === false || strlen($raw) <= 16) { return ''; }
        $iv = substr($raw, 0, 16);
        $plain = openssl_decrypt(substr($raw, 16), self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv);
        return $plain === false ? '' : $plain;
    }
}
