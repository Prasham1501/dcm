<?php
/**
 * TOTP Authentication Class
 * RFC 6238 compliant Time-based One-Time Password implementation
 * Compatible with Google Authenticator, Microsoft Authenticator, Authy, etc.
 */

class TotpAuth {
    private const DIGITS = 6;           // OTP length
    private const PERIOD = 30;          // Time step in seconds
    private const ALGORITHM = 'sha1';   // HMAC algorithm
    private const SECRET_LENGTH = 16;   // Secret length in bytes (before Base32 encoding)
    
    // Base32 alphabet
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    
    /**
     * Generate a new random secret key
     * @return string Base32 encoded secret
     */
    public static function generateSecret(): string {
        $randomBytes = random_bytes(self::SECRET_LENGTH);
        return self::base32Encode($randomBytes);
    }
    
    /**
     * Generate TOTP code for current time
     * @param string $secret Base32 encoded secret
     * @param int|null $timestamp Unix timestamp (defaults to current time)
     * @return string 6-digit TOTP code
     */
    public static function generateCode(string $secret, ?int $timestamp = null): string {
        $timestamp = $timestamp ?? time();
        $timeSlice = floor($timestamp / self::PERIOD);
        
        // Decode the secret from Base32
        $secretBytes = self::base32Decode($secret);
        
        // Pack time slice as 8-byte big-endian integer
        $timeBytes = pack('N*', 0) . pack('N*', $timeSlice);
        
        // Calculate HMAC
        $hash = hash_hmac(self::ALGORITHM, $timeBytes, $secretBytes, true);
        
        // Dynamic truncation
        $offset = ord(substr($hash, -1)) & 0x0F;
        $code = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % pow(10, self::DIGITS);
        
        return str_pad((string)$code, self::DIGITS, '0', STR_PAD_LEFT);
    }
    
    /**
     * Verify a TOTP code
     * @param string $secret Base32 encoded secret
     * @param string $code User-provided code
     * @param int $window Time window tolerance (number of periods before/after)
     * @return bool True if code is valid
     */
    public static function verifyCode(string $secret, string $code, int $window = 1): bool {
        // Normalize code
        $code = preg_replace('/\s+/', '', $code);
        
        if (strlen($code) !== self::DIGITS || !ctype_digit($code)) {
            return false;
        }
        
        $timestamp = time();
        
        // Check current time and adjacent time windows
        for ($i = -$window; $i <= $window; $i++) {
            $testTimestamp = $timestamp + ($i * self::PERIOD);
            $expectedCode = self::generateCode($secret, $testTimestamp);
            
            if (hash_equals($expectedCode, $code)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Generate QR code URL for authenticator apps
     * Uses QuickChart API (reliable replacement for Google Charts)
     * @param string $secret Base32 encoded secret
     * @param string $accountName User identifier (e.g., email)
     * @param string $issuer Application name
     * @return array QR code data including otpauth URI and QR URL
     */
    public static function getQRCodeData(string $secret, string $accountName, string $issuer = 'DICOM Viewer'): array {
        $otpauthUrl = sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=%s&digits=%d&period=%d',
            rawurlencode($issuer),
            rawurlencode($accountName),
            $secret,
            rawurlencode($issuer),
            strtoupper(self::ALGORITHM),
            self::DIGITS,
            self::PERIOD
        );
        
        // QuickChart API for QR code generation
        $qrUrl = 'https://quickchart.io/qr?text=' . urlencode($otpauthUrl) . '&size=200';
        
        return [
            'otpauth_url' => $otpauthUrl,
            'qr_url' => $qrUrl,
            'secret' => $secret,
            'issuer' => $issuer,
            'account_name' => $accountName
        ];
    }
    
    /**
     * Encode bytes to Base32
     * @param string $data Binary data
     * @return string Base32 encoded string
     */
    private static function base32Encode(string $data): string {
        if (empty($data)) {
            return '';
        }
        
        $binary = '';
        foreach (str_split($data) as $char) {
            $binary .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        
        $result = '';
        $chunks = str_split($binary, 5);
        
        foreach ($chunks as $chunk) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            $result .= self::BASE32_ALPHABET[bindec($chunk)];
        }
        
        return $result;
    }
    
    /**
     * Decode Base32 to bytes
     * @param string $data Base32 encoded string
     * @return string Binary data
     */
    private static function base32Decode(string $data): string {
        if (empty($data)) {
            return '';
        }
        
        $data = strtoupper($data);
        $data = preg_replace('/[^A-Z2-7]/', '', $data);
        
        $binary = '';
        foreach (str_split($data) as $char) {
            $index = strpos(self::BASE32_ALPHABET, $char);
            if ($index !== false) {
                $binary .= str_pad(decbin($index), 5, '0', STR_PAD_LEFT);
            }
        }
        
        $result = '';
        $chunks = str_split($binary, 8);
        
        foreach ($chunks as $chunk) {
            if (strlen($chunk) === 8) {
                $result .= chr(bindec($chunk));
            }
        }
        
        return $result;
    }
    
    /**
     * Format secret for display (groups of 4 characters)
     * @param string $secret Base32 encoded secret
     * @return string Formatted secret
     */
    public static function formatSecret(string $secret): string {
        return implode(' ', str_split($secret, 4));
    }
}
