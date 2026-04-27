<?php
declare(strict_types=1);

class GoogleAuth {

    /**
     * Verify a Google id_token using Google's tokeninfo endpoint.
     * Returns decoded user info or throws on failure.
     */
    public static function verify(string $idToken): array {
        $clientId = Settings::get('google.client_id');

        $url  = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
        $resp = @file_get_contents($url);

        if ($resp === false) {
            throw new \RuntimeException('Failed to reach Google token endpoint');
        }

        $data = json_decode($resp, true);

        if (!$data || isset($data['error'])) {
            throw new \RuntimeException('Invalid Google token: ' . ($data['error_description'] ?? 'unknown'));
        }

        // Validate audience
        if ($clientId && ($data['aud'] ?? '') !== $clientId) {
            throw new \RuntimeException('Token audience mismatch');
        }

        // Validate expiry
        if (($data['exp'] ?? 0) < time()) {
            throw new \RuntimeException('Google token has expired');
        }

        return [
            'sub'            => $data['sub'],
            'email'          => $data['email'],
            'name'           => $data['name'] ?? $data['email'],
            'picture'        => $data['picture'] ?? null,
            'email_verified' => ($data['email_verified'] ?? 'false') === 'true',
        ];
    }
}
