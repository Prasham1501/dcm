<?php
/**
 * Machine GRAPH/IMAGE ingest for analyzers / reporting software.
 * No user session — API key (Settings -> Integrations). The machine bridge
 * uploads the graph file; it is auto-attached to the visit and shows in Result
 * Entry + on the printed report. No folder configuration needed.
 *
 * POST multipart/form-data with header `X-API-Key: <key>` (or api_key field):
 *   - visit_no | accession_number | visit_id   (identify the visit)
 *   - file                                       (the image/PDF)
 *   - title (optional)
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }

try {
    $db = getDbConnection();

    // ---- API key ----
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = 'integration_api_key' LIMIT 1");
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $configured = $row ? (string)$row['setting_value'] : '';
    $provided = (string)($_SERVER['HTTP_X_API_KEY'] ?? $_POST['api_key'] ?? '');
    if ($configured === '' || $provided === '' || !hash_equals($configured, $provided)) {
        sendErrorResponse('Invalid or missing API key', 401);
    }

    // ---- Resolve visit + first order ----
    $visitId = (int)($_POST['visit_id'] ?? 0);
    $visitNo = trim((string)($_POST['visit_no'] ?? ''));
    $accession = trim((string)($_POST['accession_number'] ?? ''));
    $orderId = 0;
    if ($accession !== '') {
        $s = $db->prepare('SELECT id, visit_id, patient_id FROM ris_orders WHERE accession_number = ? LIMIT 1');
        $s->bind_param('s', $accession); $s->execute();
        $r = $s->get_result()->fetch_assoc(); $s->close();
        if ($r) { $orderId = (int)$r['id']; $visitId = (int)$r['visit_id']; }
    }
    if ($visitId <= 0 && $visitNo !== '') {
        $s = $db->prepare('SELECT id FROM ris_visits WHERE visit_no = ? LIMIT 1');
        $s->bind_param('s', $visitNo); $s->execute();
        $r = $s->get_result()->fetch_assoc(); $s->close();
        $visitId = $r ? (int)$r['id'] : 0;
    }
    if ($visitId <= 0) { sendErrorResponse('Visit not found', 404); }
    if ($orderId === 0) {
        $r = $db->query('SELECT id, patient_id FROM ris_orders WHERE visit_id = ' . (int)$visitId . ' ORDER BY id LIMIT 1');
        $o = $r ? $r->fetch_assoc() : null;
        if (!$o) { sendErrorResponse('No order on this visit to attach the graph to', 404); }
        $orderId = (int)$o['id'];
    }
    $pr = $db->query('SELECT patient_id FROM ris_orders WHERE id = ' . (int)$orderId);
    $patientId = ($pr && ($p = $pr->fetch_assoc())) ? (int)$p['patient_id'] : 0;

    // ---- Save the uploaded file ----
    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        sendErrorResponse('file is required (multipart upload)', 400);
    }
    $orig = $_FILES['file']['name'];
    $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    if (!in_array($ext, ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'pdf'], true)) {
        sendErrorResponse('Unsupported file type', 400);
    }
    $dir = __DIR__ . '/../../data/ris_graphs';
    if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
    if (!is_dir($dir) || !is_writable($dir)) { sendErrorResponse('Graph storage folder is not writable', 500); }
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $orig ?: ('graph.' . $ext));
    $dest = $dir . '/' . $visitId . '_' . time() . '_' . $safe;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
        sendErrorResponse('Could not store the uploaded file', 500);
    }
    $assetType = $ext === 'pdf' ? 'pdf' : 'image';
    $title = trim((string)($_POST['title'] ?? '')) ?: $orig;

    $stmt = $db->prepare(
        "INSERT INTO ris_result_assets (order_id, visit_id, patient_id, asset_type, title, source_path, source_mtime)
         VALUES (?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE title = VALUES(title), source_mtime = NOW()"
    );
    $stmt->bind_param('iiisss', $orderId, $visitId, $patientId, $assetType, $title, $dest);
    $stmt->execute();
    $assetId = $stmt->insert_id;
    $stmt->close();

    logMessage("Graph ingest: visit $visitId order $orderId file $title", 'info', 'ris.log');
    sendSuccessResponse(['visit_id' => $visitId, 'order_id' => $orderId, 'asset_id' => $assetId, 'title' => $title], 'Graph attached');
} catch (Throwable $e) {
    logMessage('Graph ingest error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
