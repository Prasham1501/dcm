<?php
declare(strict_types=1);

/**
 * One Clickz website installer for shared hosting.
 * Run once after uploading website/:
 *   /mediview/api/install.php?secret=Prasham123%24
 *
 * The script is idempotent: schema uses CREATE TABLE IF NOT EXISTS and seeds use
 * INSERT IGNORE / ON DUPLICATE KEY. Delete or rename this file after a successful
 * production install.
 */
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';

header('Content-Type: application/json; charset=utf-8');

if ((string)($_GET['secret'] ?? '') !== 'Prasham123$') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Invalid secret']);
    exit;
}

function install_split_sql(string $sql): array {
    $lines = preg_split('/\R/', $sql) ?: [];
    $clean = [];
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || str_starts_with($trim, '--')) {
            continue;
        }
        $clean[] = $line;
    }
    return array_filter(array_map('trim', explode(';', implode("\n", $clean))));
}

try {
    $pdo = db();
    $files = [
        __DIR__ . '/sql/001_schema.sql',
        __DIR__ . '/sql/002_seed.sql',
    ];
    $applied = [];
    foreach ($files as $file) {
        if (!is_file($file)) { throw new RuntimeException('Missing SQL file: ' . basename($file)); }
        $sql = file_get_contents($file);
        if ($sql === false) { throw new RuntimeException('Could not read SQL file: ' . basename($file)); }
        foreach (install_split_sql($sql) as $statement) {
            if ($statement !== '') { $pdo->exec($statement); }
        }
        $applied[] = basename($file);
    }

    $columns = $pdo->query("SHOW COLUMNS FROM licenses LIKE 'product'")->fetchAll();
    if (!$columns) {
        $pdo->exec("ALTER TABLE licenses ADD COLUMN product VARCHAR(20) NOT NULL DEFAULT 'viewer' AFTER plan, ADD INDEX idx_product (product)");
    }

    $quotaColumns = [
        'quota_enabled' => "ALTER TABLE licenses ADD COLUMN quota_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER notes",
        'quota_remaining' => "ALTER TABLE licenses ADD COLUMN quota_remaining INT NOT NULL DEFAULT 0 AFTER quota_enabled",
        'quota_total' => "ALTER TABLE licenses ADD COLUMN quota_total INT NOT NULL DEFAULT 0 AFTER quota_remaining",
    ];
    foreach ($quotaColumns as $column => $ddl) {
        if (!$pdo->query("SHOW COLUMNS FROM licenses LIKE " . $pdo->quote($column))->fetchAll()) {
            $pdo->exec($ddl);
        }
    }

    $settings = [
        'pricing.bridge_monthly_inr' => '3000',
        'pricing.bridge_annual_inr' => '30000',
        'pricing.ris_monthly_inr' => '3000',
        'pricing.ris_annual_inr' => '30000',
    ];
    $stmt = $pdo->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    foreach ($settings as $key => $value) {
        $stmt->execute([$key, $value]);
    }

    echo json_encode(['success' => true, 'data' => ['applied' => $applied, 'settings' => array_keys($settings)]]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
