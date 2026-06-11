<?php
/**
 * Analyzer graph assets.
 * GET ?order_id=123&scan=1 -> scans configured analyzer folders and links
 * image/PDF files whose filename matches accession/token/visit/MRN/patient tokens.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { sendErrorResponse('Forbidden', 403); }

function ris_graph_ensure_schema(mysqli $db): void {
    $db->query(
        "CREATE TABLE IF NOT EXISTS `ris_result_assets` (
          `id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
          `order_id` INT(11) UNSIGNED NOT NULL,
          `visit_id` INT(11) UNSIGNED DEFAULT NULL,
          `patient_id` INT(11) UNSIGNED DEFAULT NULL,
          `asset_type` ENUM('graph','image','pdf','other') NOT NULL DEFAULT 'graph',
          `title` VARCHAR(180) DEFAULT NULL,
          `source_path` VARCHAR(600) NOT NULL,
          `source_mtime` DATETIME DEFAULT NULL,
          `created_by` INT(11) UNSIGNED DEFAULT NULL,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          UNIQUE KEY `uq_ris_asset_order_path` (`order_id`, `source_path`),
          KEY `idx_ris_asset_order` (`order_id`),
          KEY `idx_ris_asset_patient` (`patient_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ris_setting(mysqli $db, string $key, string $default = ''): string {
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = ?");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? (string)$row['setting_value'] : $default;
}

function ris_graph_dirs(string $raw): array {
    $parts = preg_split('/[\r\n;]+/', $raw) ?: [];
    $out = [];
    foreach ($parts as $part) {
        $dir = trim($part, " \t\n\r\0\x0B\"");
        if ($dir !== '' && is_dir($dir)) { $out[] = $dir; }
    }
    return array_values(array_unique($out));
}

function ris_graph_tokens(array $order): array {
    $raw = [
        $order['accession_number'] ?? '',
        $order['token_no'] ?? '',
        $order['visit_no'] ?? '',
        $order['mrn'] ?? '',
        $order['patient_name'] ?? '',
        (string)($order['id'] ?? ''),
    ];
    $tokens = [];
    foreach ($raw as $value) {
        $parts = preg_split('/[^a-z0-9]+/i', strtolower((string)$value)) ?: [];
        foreach ($parts as $part) {
            if (strlen($part) >= 3) { $tokens[] = $part; }
        }
    }
    return array_values(array_unique($tokens));
}

function ris_asset_type(string $path): string {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if ($ext === 'pdf') return 'pdf';
    if (in_array($ext, ['png', 'jpg', 'jpeg', 'bmp', 'webp'], true)) return 'image';
    return 'graph';
}

function ris_scan_graphs(array $dirs, array $tokens, array $extensions): array {
    if (!$dirs || !$tokens) return [];
    $matches = [];
    $checked = 0;
    foreach ($dirs as $dir) {
        try {
            $it = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
            foreach ($it as $file) {
                if ($checked++ > 5000 || count($matches) >= 50) break 2;
                if (!$file->isFile()) continue;
                $path = $file->getPathname();
                $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                if (!in_array($ext, $extensions, true)) continue;
                $name = strtolower(pathinfo($path, PATHINFO_FILENAME));
                foreach ($tokens as $token) {
                    if (strpos($name, $token) !== false) {
                        $matches[$path] = [
                            'path' => $path,
                            'title' => basename($path),
                            'source_mtime' => date('Y-m-d H:i:s', $file->getMTime()),
                        ];
                        break;
                    }
                }
            }
        } catch (Throwable $e) {
            logMessage('Analyzer graph scan skipped ' . $dir . ': ' . $e->getMessage(), 'warning', 'ris.log');
        }
    }
    return array_values($matches);
}

function ris_order(mysqli $db, int $orderId): ?array {
    $stmt = $db->prepare(
        "SELECT o.*, v.visit_no, p.mrn, p.full_name AS patient_name
         FROM ris_orders o
         LEFT JOIN ris_visits v ON v.id = o.visit_id
         LEFT JOIN ris_patients p ON p.id = o.patient_id
         WHERE o.id = ?"
    );
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

function ris_assets(mysqli $db, int $orderId): array {
    $stmt = $db->prepare("SELECT * FROM ris_result_assets WHERE order_id = ? ORDER BY id DESC");
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    while ($row = $res->fetch_assoc()) {
        $row['view_url'] = '/api/results/graph-file.php?id=' . (int)$row['id'];
        $out[] = $row;
    }
    $stmt->close();
    return $out;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendErrorResponse('Method not allowed', 405); }
    $db = getDbConnection();
    ris_graph_ensure_schema($db);
    $orderId = (int)($_GET['order_id'] ?? 0);
    if ($orderId <= 0) { sendErrorResponse('order_id is required', 400); }
    $order = ris_order($db, $orderId);
    if (!$order) { sendErrorResponse('Order not found', 404); }

    $discovered = [];
    if (!empty($_GET['scan'])) {
        $dirs = ris_graph_dirs(ris_setting($db, 'analyzer_graph_source_dirs', ''));
        $extensions = array_values(array_filter(array_map('trim', explode(',', strtolower(ris_setting($db, 'analyzer_graph_extensions', 'png,jpg,jpeg,pdf,bmp'))))));
        $discovered = ris_scan_graphs($dirs, ris_graph_tokens($order), $extensions);
        $user = getCurrentUser();
        $userId = (int)($user['id'] ?? 0);
        $stmt = $db->prepare(
            "INSERT INTO ris_result_assets
              (order_id, visit_id, patient_id, asset_type, title, source_path, source_mtime, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), source_mtime = VALUES(source_mtime)"
        );
        $visitId = (int)$order['visit_id'];
        $patientId = (int)$order['patient_id'];
        foreach ($discovered as $asset) {
            $type = ris_asset_type($asset['path']);
            $title = $asset['title'];
            $path = $asset['path'];
            $mtime = $asset['source_mtime'];
            $stmt->bind_param(
                'iiissssi',
                $orderId,
                $visitId,
                $patientId,
                $type,
                $title,
                $path,
                $mtime,
                $userId
            );
            $stmt->execute();
        }
        $stmt->close();
    }

    sendSuccessResponse(['assets' => ris_assets($db, $orderId), 'discovered' => $discovered]);
} catch (Throwable $e) {
    logMessage('Analyzer graph assets error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
