<?php
/**
 * Machine-to-machine report status hook for a SEPARATE reporting PC/software.
 * No user session — authenticated with an API key (Settings -> Integrations).
 * Works whether the DB is local or on a central/cloud server.
 *
 * POST (JSON or form) with header `X-API-Key: <key>` (or api_key field):
 *   { visit_no | accession_number | visit_id, status: printed|emailed|delivered|ready|not_ready }
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

    // ---- API key check ----
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = 'integration_api_key' LIMIT 1");
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $configured = $row ? (string)$row['setting_value'] : '';

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) { $input = $_POST; }

    $provided = (string)($_SERVER['HTTP_X_API_KEY'] ?? $input['api_key'] ?? '');
    if ($configured === '' || $provided === '' || !hash_equals($configured, $provided)) {
        sendErrorResponse('Invalid or missing API key', 401);
    }

    // ---- Resolve the visit ----
    $visitId = (int)($input['visit_id'] ?? 0);
    $visitNo = trim((string)($input['visit_no'] ?? ''));
    $accession = trim((string)($input['accession_number'] ?? ''));
    if ($visitId <= 0 && $visitNo !== '') {
        $s = $db->prepare('SELECT id FROM ris_visits WHERE visit_no = ? LIMIT 1');
        $s->bind_param('s', $visitNo);
        $s->execute();
        $r = $s->get_result()->fetch_assoc();
        $s->close();
        $visitId = $r ? (int)$r['id'] : 0;
    }
    if ($visitId <= 0 && $accession !== '') {
        $s = $db->prepare('SELECT visit_id FROM ris_orders WHERE accession_number = ? LIMIT 1');
        $s->bind_param('s', $accession);
        $s->execute();
        $r = $s->get_result()->fetch_assoc();
        $s->close();
        $visitId = $r ? (int)$r['visit_id'] : 0;
    }
    if ($visitId <= 0) { sendErrorResponse('Visit not found (provide visit_no, accession_number, or visit_id)', 404); }

    // ---- Apply the status (same effect as the reception "Mark report ..." menu) ----
    $status = strtolower(trim((string)($input['status'] ?? '')));
    $vid = $visitId;
    switch ($status) {
        case 'emailed':
            $db->query("UPDATE ris_orders SET report_emailed_at = NOW() WHERE visit_id = $vid AND report_emailed_at IS NULL");
            $db->query("UPDATE ris_visits SET dispatch_mode='email', dispatch_note=TRIM(CONCAT(COALESCE(dispatch_note,''), IF(COALESCE(dispatch_note,'')='','','\n'),'Report emailed (auto)')) WHERE id=$vid");
            break;
        case 'printed':
        case 'delivered':
            $db->query("UPDATE ris_orders SET report_printed_at = COALESCE(report_printed_at, NOW()) WHERE visit_id = $vid");
            $label = $status === 'delivered' ? 'Report delivered (auto)' : 'Report printed (auto)';
            $db->query("UPDATE ris_visits SET dispatch_note=TRIM(CONCAT(COALESCE(dispatch_note,''), IF(COALESCE(dispatch_note,'')='','','\n'),'$label')) WHERE id=$vid");
            break;
        case 'ready':
            $db->query("UPDATE ris_orders SET result_status='authenticated', authenticated_at=COALESCE(authenticated_at, NOW()) WHERE visit_id = $vid AND result_status <> 'printed'");
            break;
        case 'not_ready':
            $db->query("UPDATE ris_orders SET report_emailed_at=NULL, report_printed_at=NULL, authenticated_at=NULL, result_status='registered' WHERE visit_id = $vid");
            $db->query("UPDATE ris_visits SET dispatch_mode=NULL, dispatch_note=NULL WHERE id=$vid");
            break;
        default:
            sendErrorResponse('status must be one of: printed, emailed, delivered, ready, not_ready', 400);
    }

    logMessage("Integration report-status: visit $vid -> $status", 'info', 'ris.log');
    sendSuccessResponse(['visit_id' => $vid, 'status' => $status], 'Report status updated');
} catch (Throwable $e) {
    logMessage('Integration report-status error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
