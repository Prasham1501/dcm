<?php
/**
 * One-time script to issue a test license key.
 * DELETE this file after use.
 * Usage: GET /api/issue_test_key.php?secret=mediview2026
 */
declare(strict_types=1);

if (($_GET['secret'] ?? '') !== 'mediview2026') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/settings.php';
require_once __DIR__ . '/lib/LicenseKey.php';

// Config — override via query string for ad-hoc testing.
$plan        = $_GET['plan']   ?? 'testing';   // pass plan=trial to seed 10 prints
$seats       = (int)($_GET['seats'] ?? 100);
$days        = (int)($_GET['days']  ?? 30);
$trialPrints = (int)($_GET['prints'] ?? 10);

// Make sure the quota columns exist before we try to seed them — the
// columns are added lazily by AdminController, so a fresh DB might not
// have them yet.
try {
    $cols = db()->query("SHOW COLUMNS FROM licenses")->fetchAll(PDO::FETCH_COLUMN);
    $alter = [];
    if (!in_array('quota_enabled',   $cols, true)) $alter[] = "ADD COLUMN quota_enabled TINYINT(1) NOT NULL DEFAULT 0";
    if (!in_array('quota_remaining', $cols, true)) $alter[] = "ADD COLUMN quota_remaining INT NOT NULL DEFAULT 0";
    if (!in_array('quota_total',     $cols, true)) $alter[] = "ADD COLUMN quota_total INT NOT NULL DEFAULT 0";
    if ($alter) db()->exec("ALTER TABLE licenses " . implode(', ', $alter));
} catch (\Throwable $e) {
    error_log('[issue_test_key] quota column ensure failed: ' . $e->getMessage());
}

// Use the super_admin account
$stmt = db()->prepare("SELECT id FROM accounts WHERE id = 'acc_superadmin00' LIMIT 1");
$stmt->execute();
$acc = $stmt->fetch();
$accountId = $acc ? $acc['id'] : null;

if (!$accountId) {
    // fallback: first account
    $stmt2 = db()->prepare("SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1");
    $stmt2->execute();
    $accountId = $stmt2->fetchColumn();
}

if (!$accountId) {
    echo json_encode(['error' => 'No accounts found']);
    exit;
}

$keyCode = LicenseKey::generate();
$now     = nowDb();
$expires = gmdate('Y-m-d H:i:s', time() + $days * 86400);
$hmac    = LicenseKey::sign($keyCode, ['plan' => $plan, 'seats' => $seats, 'account' => $accountId]);
$licId   = generateId();

db()->prepare(
    "INSERT INTO licenses (id, account_id, key_code, plan, seats, status, starts_at, expires_at, hmac_signature, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)"
)->execute([$licId, $accountId, $keyCode, $plan, $seats, 'active', $now, $expires, $hmac, $now]);

// Free-trial seeding: a trial-plan key starts with 10 prints (or whatever
// the operator passed via ?prints=N) and quota mode ON.
if ($plan === 'trial') {
    db()->prepare(
        "UPDATE licenses
            SET quota_enabled   = 1,
                quota_remaining = ?,
                quota_total     = GREATEST(quota_total, ?)
          WHERE id = ?"
    )->execute([$trialPrints, $trialPrints, $licId]);
}

header('Content-Type: application/json');
echo json_encode([
    'success'         => true,
    'key_code'        => $keyCode,
    'plan'            => $plan,
    'seats'           => $seats,
    'expires_at'      => $expires,
    'days'            => $days,
    'license_id'      => $licId,
    'quota_enabled'   => $plan === 'trial',
    'quota_remaining' => $plan === 'trial' ? $trialPrints : 0,
], JSON_PRETTY_PRINT);
