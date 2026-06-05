<?php
/**
 * RIS counter settings.
 * GET returns current prefixes/next numbers.
 * POST { accession_start?, accession_prefix?, token_start?, token_prefix? } updates counters.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

function ris_counter_rows(mysqli $db): array {
    $res = $db->query("SELECT name, current_value, prefix FROM app_counters WHERE name IN ('accession','token','receipt','visit','mrn') ORDER BY name");
    $out = [];
    while ($res && $row = $res->fetch_assoc()) {
        $out[$row['name']] = [
            'prefix' => (string)$row['prefix'],
            'current_value' => (int)$row['current_value'],
            'next_number' => ((int)$row['current_value']) + 1,
        ];
    }
    return $out;
}

function ris_update_counter(mysqli $db, string $name, ?string $prefix, $nextNumber): void {
    $updates = [];
    $types = '';
    $vals = [];
    if ($prefix !== null) {
        $updates[] = 'prefix = ?';
        $types .= 's';
        $vals[] = strtoupper(trim($prefix));
    }
    if ($nextNumber !== null && $nextNumber !== '') {
        $next = max(1, (int)$nextNumber);
        $updates[] = 'current_value = ?';
        $types .= 'i';
        $vals[] = $next - 1;
    }
    if (!$updates) { return; }
    $types .= 's';
    $vals[] = $name;
    $stmt = $db->prepare('UPDATE app_counters SET ' . implode(', ', $updates) . ' WHERE name = ?');
    $stmt->bind_param($types, ...$vals);
    $stmt->execute();
    $stmt->close();
}

try {
    $db = getDbConnection();
    $db->query("INSERT INTO app_counters (name, current_value, prefix) VALUES ('token', 0, 'T') ON DUPLICATE KEY UPDATE name = name");

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        sendSuccessResponse(ris_counter_rows($db));
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    ris_update_counter($db, 'accession', $input['accession_prefix'] ?? null, $input['accession_start'] ?? null);
    ris_update_counter($db, 'token', $input['token_prefix'] ?? null, $input['token_start'] ?? null);
    sendSuccessResponse(ris_counter_rows($db), 'Counters updated');
} catch (Throwable $e) {
    logMessage('RIS counters error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
