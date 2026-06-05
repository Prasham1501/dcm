<?php
/**
 * RIS DICOM node management.
 * Uses the viewer's dicom_nodes table but returns JSON through the RIS server
 * so Settings never falls back to an HTML/PHP warning response.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    ris_ensure_dicom_nodes($db);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($input['id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        $aeTitle = trim((string)($input['ae_title'] ?? ''));
        $host = trim((string)($input['host_name'] ?? ''));
        $port = (int)($input['port'] ?? 0);
        $isDefault = !empty($input['is_default']) ? 1 : 0;

        if ($name === '' || $aeTitle === '' || $host === '' || $port <= 0 || $port > 65535) {
            sendErrorResponse('Name, AE title, host/IP, and valid port are required', 400);
        }
        if ($isDefault) {
            $db->query("UPDATE dicom_nodes SET is_default = 0");
        }

        if ($id > 0) {
            $stmt = $db->prepare("UPDATE dicom_nodes SET name = ?, ae_title = ?, host_name = ?, port = ?, is_default = ? WHERE id = ?");
            $stmt->bind_param('sssiii', $name, $aeTitle, $host, $port, $isDefault, $id);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $db->prepare("INSERT INTO dicom_nodes (name, ae_title, host_name, port, is_default) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param('sssii', $name, $aeTitle, $host, $port, $isDefault);
            $stmt->execute();
            $id = (int)$stmt->insert_id;
            $stmt->close();
        }

        sendSuccessResponse(['id' => $id]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) { sendErrorResponse('Node id is required', 400); }
        $stmt = $db->prepare("DELETE FROM dicom_nodes WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        sendSuccessResponse(['deleted' => $id]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendErrorResponse('Method not allowed', 405); }

    $res = $db->query("SELECT id, name, ae_title, host_name, port, is_default FROM dicom_nodes ORDER BY is_default DESC, name ASC");
    $nodes = [];
    while ($res && $row = $res->fetch_assoc()) {
        $row['id'] = (int) $row['id'];
        $row['port'] = (int) $row['port'];
        $row['is_default'] = (int) ($row['is_default'] ?? 0);
        $nodes[] = $row;
    }
    sendSuccessResponse(['nodes' => $nodes]);
} catch (Throwable $e) {
    logMessage('RIS nodes error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function ris_ensure_dicom_nodes(mysqli $db): void
{
    $db->query(
        "CREATE TABLE IF NOT EXISTS dicom_nodes (
            id INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(120) NOT NULL,
            ae_title VARCHAR(64) NOT NULL,
            host_name VARCHAR(255) NOT NULL,
            port INT(11) NOT NULL DEFAULT 104,
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $columns = [
        'name' => "ALTER TABLE dicom_nodes ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT '' AFTER id",
        'ae_title' => "ALTER TABLE dicom_nodes ADD COLUMN ae_title VARCHAR(64) NOT NULL DEFAULT '' AFTER name",
        'host_name' => "ALTER TABLE dicom_nodes ADD COLUMN host_name VARCHAR(255) NOT NULL DEFAULT '' AFTER ae_title",
        'port' => "ALTER TABLE dicom_nodes ADD COLUMN port INT(11) NOT NULL DEFAULT 104 AFTER host_name",
        'is_default' => "ALTER TABLE dicom_nodes ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER port",
    ];
    foreach ($columns as $column => $sql) {
        $safe = $db->real_escape_string($column);
        $res = $db->query("SHOW COLUMNS FROM dicom_nodes LIKE '{$safe}'");
        if (!$res || $res->num_rows === 0) {
            $db->query($sql);
        }
    }
}
