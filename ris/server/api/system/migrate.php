<?php
/**
 * Idempotent RIS migration runner.
 * URL: /api/system/migrate.php?secret=Prasham123%24
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';

header('Content-Type: application/json');

$secret = (string)($_GET['secret'] ?? '');
if ($secret !== 'Prasham123$') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Invalid secret']);
    exit;
}

function ris_split_sql(string $sql): array {
    $lines = preg_split('/\R/', $sql) ?: [];
    $clean = [];
    foreach ($lines as $line) {
        $trim = trim($line);
        if ($trim === '' || str_starts_with($trim, '--') || str_starts_with($trim, '/*') || str_starts_with($trim, '*')) {
            continue;
        }
        $clean[] = $line;
    }
    return array_filter(array_map('trim', explode(';', implode("\n", $clean))));
}

try {
    $db = getDbConnection();
    $dir = realpath(__DIR__ . '/../../database/migrations');
    if (!$dir) { throw new Exception('RIS migrations directory not found'); }
    $files = glob($dir . '/*.sql') ?: [];
    sort($files, SORT_NATURAL);
    $applied = [];
    foreach ($files as $file) {
        $sql = file_get_contents($file);
        if ($sql === false) { throw new Exception('Could not read ' . basename($file)); }
        foreach (ris_split_sql($sql) as $statement) {
            if ($statement !== '') {
                if (!$db->query($statement)) {
                    throw new Exception(basename($file) . ': ' . $db->error);
                }
            }
        }
        $applied[] = basename($file);
    }
    echo json_encode(['success' => true, 'data' => ['applied' => $applied]]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
