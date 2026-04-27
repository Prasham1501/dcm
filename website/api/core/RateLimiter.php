<?php
declare(strict_types=1);

class RateLimiter {

    /**
     * Record a hit for $key. Throws a 429 Response if $maxHits is exceeded
     * within the last $windowSeconds.
     */
    public static function hit(string $key, int $maxHits, int $windowSeconds): void {
        try {
            $pdo = db();
            $now = time();
            $windowStart = $now - $windowSeconds;

            // Upsert: increment hit count; reset if window expired
            $pdo->prepare(
                "INSERT INTO rate_limits (`key`, hits, window_start)
                 VALUES (?, 1, ?)
                 ON DUPLICATE KEY UPDATE
                   hits = IF(window_start < ?, 1, hits + 1),
                   window_start = IF(window_start < ?, VALUES(window_start), window_start)"
            )->execute([$key, $now, $windowStart, $windowStart]);

            $stmt = $pdo->prepare("SELECT hits FROM rate_limits WHERE `key` = ?");
            $stmt->execute([$key]);
            $hits = (int)($stmt->fetchColumn() ?: 0);

            if ($hits > $maxHits) {
                http_response_code(429);
                header('Retry-After: ' . $windowSeconds);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Too many requests. Please slow down.']);
                exit;
            }
        } catch (\Throwable) {
            // DB unavailable or table missing — rate limiting is non-critical, continue
        }
    }

    /** Clean up old entries (call from cron) */
    public static function clean(): void {
        try {
            db()->prepare("DELETE FROM rate_limits WHERE window_start < ?")->execute([time() - 86400]);
        } catch (\Throwable) {}
    }
}
