<?php
/**
 * Reset billing state — wipes all licenses, devices, credits, prints,
 * payments and invoices so you can start fresh and test from zero.
 *
 *   By default: ACCOUNTS and USERS are preserved so existing logins work.
 *
 * MODES
 *   ?secret=mediview2026                  → default: keep accounts+users
 *   &dry_run=1                            → show counts, delete nothing
 *   &also_accounts=1                      → ALSO wipe users + accounts
 *   &wipe_all=1                           → nuke EVERY data table and
 *                                           re-seed the super-admin so
 *                                           you can log in immediately
 *                                           (email + password from the
 *                                           original 002_seed.sql)
 *
 * USAGE (browser, both XAMPP local and GoDaddy):
 *   https://mehrgrewal.com/mediview/api/scripts/reset_billing.php?secret=mediview2026&dry_run=1
 *   https://mehrgrewal.com/mediview/api/scripts/reset_billing.php?secret=mediview2026&wipe_all=1
 *
 * USAGE (CLI):
 *   php reset_billing.php secret=mediview2026 wipe_all=1
 *
 * Returns JSON with the per-table delete counts and (when wipe_all=1) the
 * re-seeded super-admin email so you know exactly what to log in as.
 *
 * SECURITY: change the secret below (or pass via env RESET_SECRET) and
 *   DELETE THIS FILE after you're done testing.
 */
declare(strict_types=1);

// ── Auth ───────────────────────────────────────────────────────────────────
$expectedSecret = getenv('RESET_SECRET') ?: 'mediview2026';

// Support both query string (web) and key=value arg parsing (CLI).
$args = $_GET;
if (PHP_SAPI === 'cli') {
    foreach (array_slice($argv ?? [], 1) as $pair) {
        if (strpos($pair, '=') !== false) {
            [$k, $v] = explode('=', $pair, 2);
            $args[$k] = $v;
        }
    }
}

$givenSecret = (string)($args['secret'] ?? '');
if (!hash_equals($expectedSecret, $givenSecret)) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Forbidden — wrong or missing secret']);
    exit;
}

$dryRun       = !empty($args['dry_run']);
$alsoAccounts = !empty($args['also_accounts']); // dangerous — wipes users too
$wipeAll      = !empty($args['wipe_all']);      // nuke + re-seed super-admin
if ($wipeAll) $alsoAccounts = true;             // wipe_all implies also_accounts

// ── Boot the framework's DB connection ─────────────────────────────────────
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/db.php';

/** @var PDO $pdo */
$pdo = db();

/**
 * Tables in the order they should be wiped — child rows first.
 * `also_accounts=1` extends the list with users/accounts.
 *
 * Each row: [table_name, human_label]. Unknown tables are skipped silently
 * (the schema between local XAMPP and GoDaddy can drift over time).
 */
$tables = [
    // Devices reference licenses
    ['devices',                 'devices (activations)'],
    // Wallet history
    ['transactions',            'wallet transactions'],
    ['wallets',                 'wallets (print + ai credits)'],
    // Money
    ['payments',                'payments'],
    ['invoices',                'invoices'],
    // Print history (server-side mirror)
    ['print_logs',              'print logs'],
    ['daily_print_stats',       'daily aggregated print stats'],
    // Licenses themselves
    ['licenses',                'licenses (keys)'],
    // Misc state worth resetting for a clean test
    ['license_activations',     'license activations (desktop mirror)'],
    ['machine_locations',       'machine locations'],
    ['audit_logs',              'audit logs'],
    ['analytics_events',        'analytics events'],
];

if ($alsoAccounts) {
    // CAUTION: this kills logins. Only do this if you also want to re-test
    // signup. Children first.
    $tables[] = ['email_verifications', 'email verifications'];
    $tables[] = ['password_resets',     'password resets'];
    $tables[] = ['team_invites',        'team invites'];
    $tables[] = ['referrals',           'referrals'];
    $tables[] = ['users',               'users'];
    $tables[] = ['accounts',            'accounts'];
}

// ── Wipe ───────────────────────────────────────────────────────────────────
$results = [];
$totalDeleted = 0;

// Disable FK checks for the duration so we can wipe in any order.
try { $pdo->exec('SET FOREIGN_KEY_CHECKS = 0'); } catch (\Throwable $e) {}

foreach ($tables as [$table, $label]) {
    // Skip tables that don't exist on this server.
    try {
        $exists = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetchColumn();
        if (!$exists) {
            $results[] = ['table' => $table, 'label' => $label, 'status' => 'skipped (not present)'];
            continue;
        }
    } catch (\Throwable $e) {
        $results[] = ['table' => $table, 'label' => $label, 'status' => 'check failed: ' . $e->getMessage()];
        continue;
    }

    // Count before
    try {
        $countBefore = (int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    } catch (\Throwable $e) {
        $countBefore = -1;
    }

    if ($dryRun) {
        $results[] = ['table' => $table, 'label' => $label, 'rows' => $countBefore, 'status' => 'dry-run (no delete)'];
        continue;
    }

    try {
        // TRUNCATE is faster but fails when FKs point at the table even with
        // FOREIGN_KEY_CHECKS=0 on some MySQL builds, so use DELETE.
        $pdo->exec("DELETE FROM `$table`");
        $results[] = ['table' => $table, 'label' => $label, 'rows' => $countBefore, 'status' => 'deleted'];
        if ($countBefore > 0) $totalDeleted += $countBefore;
    } catch (\Throwable $e) {
        $results[] = ['table' => $table, 'label' => $label, 'rows' => $countBefore, 'status' => 'delete failed: ' . $e->getMessage()];
    }
}

// Re-seed empty wallets for any account that still exists, so the dashboard
// doesn't error when it reads from `wallets` immediately after the reset.
if (!$dryRun && !$alsoAccounts) {
    try {
        $accIds = $pdo->query("SELECT id FROM accounts")->fetchAll(PDO::FETCH_COLUMN);
        $now = gmdate('Y-m-d H:i:s');
        $ins = $pdo->prepare("INSERT IGNORE INTO wallets (account_id, type, balance, updated_at) VALUES (?,?,0,?)");
        $reseeded = 0;
        foreach ($accIds as $aid) {
            $ins->execute([$aid, 'print', $now]);
            $ins->execute([$aid, 'ai',    $now]);
            $reseeded += 2;
        }
        $results[] = ['table' => 'wallets', 'label' => 'wallets re-seeded (0 balance)', 'rows' => $reseeded, 'status' => 'seeded'];
    } catch (\Throwable $e) {
        $results[] = ['table' => 'wallets', 'label' => 'wallets re-seed', 'status' => 'failed: ' . $e->getMessage()];
    }
}

try { $pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); } catch (\Throwable $e) {}

// ── Re-seed super-admin + default settings when wipe_all=1 ────────────────
// Without this, after a full wipe nobody can log in. The hash + email
// match the canonical seed in api/sql/002_seed.sql so behaviour is
// identical to a fresh install.
$seeded = [];
if ($wipeAll && !$dryRun) {
    $now = gmdate('Y-m-d H:i:s');
    $superAccountId = 'acc_superadmin00';
    $superUserId    = 'usr_superadmin00';
    $superEmail     = 'prashamk15@gmail.com';
    $superPwHash    = '$2y$12$AsUBady.MIRKOARMPYdWF.TuEyJmNWS9xjypy4RQPdfdtz5.FnAsa';

    try {
        $pdo->prepare(
            "INSERT INTO accounts (id, name, plan, status, created_at)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE name=VALUES(name), plan=VALUES(plan), status=VALUES(status)"
        )->execute([$superAccountId, 'Mediview Internal', 'enterprise', 'active', $now]);

        $pdo->prepare(
            "INSERT INTO users (id, account_id, name, email, password_hash, role, email_verified, created_at)
             VALUES (?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE email=VALUES(email), password_hash=VALUES(password_hash), role=VALUES(role)"
        )->execute([$superUserId, $superAccountId, 'Super Admin', $superEmail, $superPwHash, 'super_admin', 1, $now]);

        $seeded['super_admin'] = [
            'email'    => $superEmail,
            'note'     => 'Password is the original hash from 002_seed.sql — use whatever password you used before this reset, or reset via /api/setup if you forgot.',
        ];
    } catch (\Throwable $e) {
        $seeded['super_admin_error'] = $e->getMessage();
    }

    // Re-apply the minimum essential settings so the dashboard doesn't 500.
    try {
        $ins = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)");
        $defaults = [
            'brand.name'           => 'One Clickz',
            'pricing.trial_days'   => '30',
            'pricing.trial_seats'  => '1',
            'admin.device_pin'     => 'Prasham123$',
        ];
        foreach ($defaults as $k => $v) $ins->execute([$k, $v]);
        $seeded['settings'] = array_keys($defaults);
    } catch (\Throwable $e) {
        $seeded['settings_error'] = $e->getMessage();
    }
}

header('Content-Type: application/json');
echo json_encode([
    'ok'             => true,
    'dry_run'        => $dryRun,
    'also_accounts'  => $alsoAccounts,
    'wipe_all'       => $wipeAll,
    'total_deleted'  => $totalDeleted,
    'tables'         => $results,
    'seeded'         => $seeded,
    'note'           => $dryRun
        ? 'Dry-run only. Re-run without dry_run=1 to actually delete.'
        : ($wipeAll
            ? 'Total wipe + super-admin re-seeded. Log in as prashamk15@gmail.com using the password you set previously (the hash in this script matches the original 002_seed.sql).'
            : 'Done. New trial keys issued from admin will start with 100 prints.'),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
