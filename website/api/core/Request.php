<?php
declare(strict_types=1);

class Request {
    public ?array $user = null;
    private array $params = [];
    private ?array $parsedBody = null;

    public function method(): string {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }

    /** URI relative to this script's directory (works at any mount point) */
    public function uri(): string {
        $uri     = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $base    = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\');
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }
        return $uri ?: '/';
    }

    /** Parsed JSON request body */
    public function body(): array {
        if ($this->parsedBody !== null) return $this->parsedBody;
        $raw = file_get_contents('php://input');
        $this->parsedBody = $raw ? (json_decode($raw, true) ?? []) : [];
        return $this->parsedBody;
    }

    /** Single body field */
    public function input(string $key, mixed $default = null): mixed {
        return $this->body()[$key] ?? $default;
    }

    /** Query string param */
    public function query(string $key, mixed $default = null): mixed {
        return $_GET[$key] ?? $default;
    }

    /** Route param (e.g. {id}) */
    public function param(string $key): string {
        return $this->params[$key] ?? '';
    }

    public function setParam(string $key, string $value): void {
        $this->params[$key] = $value;
    }

    /** Bearer token from Authorization header */
    public function bearerToken(): ?string {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (str_starts_with($auth, 'Bearer ')) return substr($auth, 7);
        return null;
    }

    /** Client IP (CloudFlare / proxy aware) */
    public function clientIp(): string {
        foreach (['HTTP_CF_CONNECTING_IP','HTTP_X_FORWARDED_FOR','HTTP_X_REAL_IP','REMOTE_ADDR'] as $h) {
            if (!empty($_SERVER[$h])) return explode(',', $_SERVER[$h])[0];
        }
        return '0.0.0.0';
    }

    public function userAgent(): string {
        return $_SERVER['HTTP_USER_AGENT'] ?? '';
    }

    /** Uploaded file info */
    public function file(string $key): ?array {
        return $_FILES[$key] ?? null;
    }
}
