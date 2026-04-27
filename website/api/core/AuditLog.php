<?php
declare(strict_types=1);

class AuditLog {

    public static function log(
        string  $action,
        string  $target    = '',
        array   $meta      = [],
        ?string $accountId = null,
        ?string $userId    = null,
        string  $actorName = 'system',
        string  $ip        = ''
    ): void {
        try {
            db()->prepare(
                "INSERT INTO audit_logs (id, account_id, user_id, actor_name, action, target, meta, ip, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?)"
            )->execute([
                generateId(),
                $accountId,
                $userId,
                $actorName,
                $action,
                $target,
                $meta ? json_encode($meta) : null,
                $ip,
                nowDb(),
            ]);
        } catch (\Throwable $e) {
            error_log('[AuditLog] ' . $e->getMessage());
        }
    }

    /** Convenience: pull account/user/ip from a Request object */
    public static function fromRequest(Request $req, string $action, string $target = '', array $meta = []): void {
        self::log(
            $action,
            $target,
            $meta,
            $req->user['account_id'] ?? null,
            $req->user['id']         ?? null,
            $req->user['name']       ?? 'user',
            $req->clientIp()
        );
    }
}
