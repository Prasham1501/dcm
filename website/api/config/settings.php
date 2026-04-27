<?php
declare(strict_types=1);

class Settings {
    private static array $cache = [];
    private static bool  $loaded = false;

    /** Get a single setting value (returns $default if not set) */
    public static function get(string $key, string $default = ''): string {
        self::load();
        return self::$cache[$key] ?? $default;
    }

    /** Set a single setting value */
    public static function set(string $key, string $value, ?string $updatedBy = null): void {
        try {
            db()->prepare(
                "INSERT INTO settings (`key`, `value`, updated_by, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)"
            )->execute([$key, $value, $updatedBy, nowDb()]);
        } catch (\Throwable) {}
        self::$cache[$key] = $value;
    }

    /** Set many settings at once */
    public static function setMany(array $map, ?string $updatedBy = null): void {
        foreach ($map as $k => $v) {
            self::set($k, (string)$v, $updatedBy);
        }
    }

    /** Return all settings as key=>value (secrets masked unless $reveal=true) */
    public static function all(bool $reveal = false): array {
        self::load();
        if ($reveal) return self::$cache;
        $out = [];
        $secretKeys = ['smtp.password','razorpay.key_secret','gemini.api_key','jwt_secret'];
        foreach (self::$cache as $k => $v) {
            $isSecret = in_array($k, $secretKeys, true) || str_ends_with($k, '_secret') || str_ends_with($k, '_key');
            $out[$k] = ($isSecret && strlen($v) > 4) ? '••••' . substr($v, -4) : $v;
        }
        return $out;
    }

    /** Invalidate cache (force reload on next access) */
    public static function invalidate(): void {
        self::$cache  = [];
        self::$loaded = false;
    }

    private static function load(): void {
        if (self::$loaded) return;
        try {
            $rows = db()->query("SELECT `key`, `value` FROM settings")->fetchAll();
            foreach ($rows as $row) self::$cache[$row['key']] = $row['value'];
        } catch (\Throwable) {}
        self::$loaded = true;
    }
}
