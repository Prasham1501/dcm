<?php
/**
 * Mediview Cron Jobs
 * ---------------------------------------------------------
 * Run every hour via cPanel Cron Jobs:
 *   php /home/<user>/public_html/api/cron.php
 *
 * Or schedule individually:
 *   0 * * * *   php .../cron.php --job=expire_licenses
 *   0 2 * * *   php .../cron.php --job=cleanup
 *   */15 * * * * php .../cron.php --job=heartbeat_check
 * ---------------------------------------------------------
 */

// Only run from CLI
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

define('CRON_START', microtime(true));

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/settings.php';
require_once __DIR__ . '/core/Mailer.php';

// Determine which job(s) to run
$opts = getopt('', ['job:']);
$job  = $opts['job'] ?? 'all';

$jobs = [
    'expire_licenses',
    'heartbeat_check',
    'cleanup',
    'send_trial_expiry_warnings',
];

$toRun = ($job === 'all') ? $jobs : [$job];

foreach ($toRun as $j) {
    if (!in_array($j, $jobs)) {
        echo "[CRON] Unknown job: $j\n";
        continue;
    }
    echo "[CRON] Running job: $j\n";
    try {
        call_user_func("job_$j");
    } catch (\Throwable $e) {
        echo "[CRON] ERROR in $j: " . $e->getMessage() . "\n";
    }
    echo "[CRON] Done: $j\n";
}

$elapsed = round(microtime(true) - CRON_START, 3);
echo "[CRON] Finished in {$elapsed}s\n";

// ─────────────────────────────────────────────────
// JOB: expire_licenses
// Sets licenses past their expires_at to 'expired'
// and logs the action.
// ─────────────────────────────────────────────────
function job_expire_licenses(): void
{
    $pdo = getDb();
    $now = gmdate('Y-m-d H:i:s');

    // Find active licenses that have expired
    $stmt = $pdo->prepare("
        SELECT id, account_id, key_code, plan, seats
        FROM licenses
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < :now
    ");
    $stmt->execute([':now' => $now]);
    $expired = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($expired)) {
        echo "  No licenses to expire.\n";
        return;
    }

    $ids = array_column($expired, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    $pdo->prepare("
        UPDATE licenses SET status = 'expired', updated_at = ?
        WHERE id IN ($placeholders)
    ")->execute(array_merge([$now], $ids));

    echo "  Expired " . count($expired) . " license(s).\n";

    // Deactivate all devices for expired licenses
    $pdo->prepare("
        UPDATE devices SET status = 'inactive', updated_at = ?
        WHERE license_id IN ($placeholders)
          AND status = 'active'
    ")->execute(array_merge([$now], $ids));

    // Log audit entries
    $logStmt = $pdo->prepare("
        INSERT INTO audit_logs
          (id, account_id, user_id, actor_name, action, target, meta, ip, created_at)
        VALUES (?, ?, NULL, 'cron', 'license.expired', ?, '{}', '127.0.0.1', ?)
    ");
    foreach ($expired as $lic) {
        $logStmt->execute([
            bin2hex(random_bytes(8)),
            $lic['account_id'],
            $lic['id'],
            $now,
        ]);
    }
}

// ─────────────────────────────────────────────────
// JOB: send_trial_expiry_warnings
// Emails users 7 days before their trial expires.
// ─────────────────────────────────────────────────
function job_send_trial_expiry_warnings(): void
{
    $pdo = getDb();
    $now = gmdate('Y-m-d H:i:s');

    // Licenses expiring in 6–8 days (band around 7 days to avoid double-send)
    $soon = gmdate('Y-m-d H:i:s', strtotime('+7 days'));
    $bandStart = gmdate('Y-m-d H:i:s', strtotime('+6 days'));
    $bandEnd   = gmdate('Y-m-d H:i:s', strtotime('+8 days'));

    $stmt = $pdo->prepare("
        SELECT l.id, l.account_id, l.key_code, l.plan, l.expires_at,
               u.email, u.name
        FROM licenses l
        JOIN accounts a ON a.id = l.account_id
        JOIN users u ON u.account_id = a.id AND u.role = 'owner'
        WHERE l.status = 'active'
          AND l.plan = 'trial'
          AND l.expires_at BETWEEN :band_start AND :band_end
          AND NOT EXISTS (
              SELECT 1 FROM audit_logs al
              WHERE al.account_id = l.account_id
                AND al.action = 'cron.trial_warning_sent'
                AND al.target = l.id
          )
        LIMIT 100
    ");
    $stmt->execute([':band_start' => $bandStart, ':band_end' => $bandEnd]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($rows)) {
        echo "  No trial expiry warnings to send.\n";
        return;
    }

    $appUrl = Settings::get('app.url', getenv('APP_URL') ?: '');
    $logStmt = $pdo->prepare("
        INSERT INTO audit_logs
          (id, account_id, user_id, actor_name, action, target, meta, ip, created_at)
        VALUES (?, ?, NULL, 'cron', 'cron.trial_warning_sent', ?, '{}', '127.0.0.1', ?)
    ");

    $count = 0;
    foreach ($rows as $row) {
        $daysLeft = (int) ceil((strtotime($row['expires_at']) - time()) / 86400);
        try {
            Mailer::send(
                $row['email'],
                $row['name'],
                'Your Mediview trial expires soon',
                'email-trial-warning',
                [
                    'name'        => $row['name'],
                    'days_left'   => $daysLeft,
                    'expires_at'  => gmdate('d M Y', strtotime($row['expires_at'])),
                    'upgrade_url' => $appUrl . '/dashboard.html#/dashboard/licenses',
                ]
            );
            $logStmt->execute([
                bin2hex(random_bytes(8)),
                $row['account_id'],
                $row['id'],
                $now,
            ]);
            $count++;
        } catch (\Throwable $e) {
            echo "  Warning: could not email {$row['email']}: " . $e->getMessage() . "\n";
        }
    }
    echo "  Sent $count trial expiry warning(s).\n";
}

// ─────────────────────────────────────────────────
// JOB: heartbeat_check
// Marks devices as inactive if they haven't sent a
// heartbeat in more than 48 hours (grace period).
// ─────────────────────────────────────────────────
function job_heartbeat_check(): void
{
    $pdo = getDb();
    $now = gmdate('Y-m-d H:i:s');
    $cutoff = gmdate('Y-m-d H:i:s', strtotime('-48 hours'));

    $stmt = $pdo->prepare("
        UPDATE devices
        SET status = 'inactive', updated_at = ?
        WHERE status = 'active'
          AND last_heartbeat_at IS NOT NULL
          AND last_heartbeat_at < ?
    ");
    $stmt->execute([$now, $cutoff]);
    $affected = $stmt->rowCount();
    echo "  Marked $affected device(s) inactive (missed heartbeat).\n";
}

// ─────────────────────────────────────────────────
// JOB: cleanup
// Prunes old rate_limit rows, expired tokens, old
// analytics events, and completed/failed jobs.
// ─────────────────────────────────────────────────
function job_cleanup(): void
{
    $pdo = getDb();
    $now = gmdate('Y-m-d H:i:s');

    // 1. Old rate limit windows (older than 1 hour)
    $cutoff1h = gmdate('Y-m-d H:i:s', strtotime('-1 hour'));
    $s = $pdo->prepare("DELETE FROM rate_limits WHERE window_start < ?");
    $s->execute([$cutoff1h]);
    echo "  Pruned {$s->rowCount()} rate_limit row(s).\n";

    // 2. Expired email verification tokens (older than 48 hours)
    $cutoff48h = gmdate('Y-m-d H:i:s', strtotime('-48 hours'));
    $s = $pdo->prepare("DELETE FROM email_verifications WHERE expires_at < ?");
    $s->execute([$now]);
    echo "  Pruned {$s->rowCount()} email_verification row(s).\n";

    // 3. Expired password reset tokens
    $s = $pdo->prepare("DELETE FROM password_resets WHERE expires_at < ?");
    $s->execute([$now]);
    echo "  Pruned {$s->rowCount()} password_reset row(s).\n";

    // 4. Expired team invites
    $s = $pdo->prepare("DELETE FROM team_invites WHERE expires_at < ? AND status = 'pending'");
    $s->execute([$now]);
    echo "  Pruned {$s->rowCount()} expired team_invite(s).\n";

    // 5. Old analytics events (keep 90 days)
    $cutoff90d = gmdate('Y-m-d H:i:s', strtotime('-90 days'));
    $s = $pdo->prepare("DELETE FROM analytics_events WHERE created_at < ?");
    $s->execute([$cutoff90d]);
    echo "  Pruned {$s->rowCount()} old analytics_event(s).\n";

    // 6. Old audit logs (keep 1 year)
    $cutoff1y = gmdate('Y-m-d H:i:s', strtotime('-365 days'));
    $s = $pdo->prepare("DELETE FROM audit_logs WHERE created_at < ?");
    $s->execute([$cutoff1y]);
    echo "  Pruned {$s->rowCount()} old audit_log(s).\n";

    // 7. Completed / failed jobs older than 7 days
    $cutoff7d = gmdate('Y-m-d H:i:s', strtotime('-7 days'));
    $s = $pdo->prepare("
        DELETE FROM jobs
        WHERE status IN ('done','failed') AND updated_at < ?
    ");
    $s->execute([$cutoff7d]);
    echo "  Pruned {$s->rowCount()} old job(s).\n";

    echo "  Cleanup complete.\n";
}
