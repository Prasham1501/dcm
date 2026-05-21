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

// Config
$plan  = 'testing';
$seats = 100;
$days  = 30;

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

header('Content-Type: application/json');
echo json_encode([
    'success'    => true,
    'key_code'   => $keyCode,
    'plan'       => $plan,
    'seats'      => $seats,
    'expires_at' => $expires,
    'days'       => $days,
    'license_id' => $licId,
], JSON_PRETTY_PRINT);
