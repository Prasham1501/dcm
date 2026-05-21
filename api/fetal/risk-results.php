<?php
/**
 * Examination risk-result persistence.
 *
 *   GET  ?examination_id=...                     - load all calculator results
 *   GET  ?examination_id=...&calculator=t21      - load a single calculator
 *   POST {examination_id, calculator, inputs, results, [include_in_report]}
 *        - upsert one calculator's row (idempotent on examination+calculator key)
 *   DELETE ?examination_id=...&calculator=...
 *
 * `inputs` and `results` are JSON-encoded by the caller — we store them
 * verbatim so the modal can re-hydrate exactly what the user entered.
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession() && !isLocalRequest()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$validCalcs = ['aneuploidy', 'preeclampsia', 'preterm'];

try {
    if ($method === 'GET') {
        $examId = (int)($_GET['examination_id'] ?? 0);
        if (!$examId) respond(['success' => false, 'error' => 'examination_id required'], 400);

        $calc = $_GET['calculator'] ?? null;
        if ($calc) {
            if (!in_array($calc, $validCalcs, true)) respond(['success' => false, 'error' => 'invalid calculator'], 400);
            $stmt = $db->prepare("SELECT calculator, inputs, results, include_in_report, computed_at FROM examination_risk_results WHERE examination_id = ? AND calculator = ?");
            $stmt->bind_param('is', $examId, $calc);
        } else {
            $stmt = $db->prepare("SELECT calculator, inputs, results, include_in_report, computed_at FROM examination_risk_results WHERE examination_id = ?");
            $stmt->bind_param('i', $examId);
        }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Decode JSON columns for the client
        foreach ($rows as &$r) {
            $r['inputs']  = $r['inputs']  ? json_decode($r['inputs'],  true) : null;
            $r['results'] = $r['results'] ? json_decode($r['results'], true) : null;
            $r['include_in_report'] = (int)$r['include_in_report'];
        }
        respond(['success' => true, 'data' => $rows]);
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $examId  = (int)($body['examination_id'] ?? 0);
        $calc    = $body['calculator'] ?? '';
        if (!$examId || !in_array($calc, $validCalcs, true)) {
            respond(['success' => false, 'error' => 'examination_id and valid calculator required'], 400);
        }
        $inputs  = isset($body['inputs'])  ? json_encode($body['inputs'])  : null;
        $results = isset($body['results']) ? json_encode($body['results']) : null;
        $include = isset($body['include_in_report']) ? (int)$body['include_in_report'] : 1;

        $stmt = $db->prepare("
            INSERT INTO examination_risk_results (examination_id, calculator, inputs, results, include_in_report)
            VALUES (?,?,?,?,?)
            ON DUPLICATE KEY UPDATE
              inputs            = VALUES(inputs),
              results           = VALUES(results),
              include_in_report = VALUES(include_in_report),
              computed_at       = CURRENT_TIMESTAMP
        ");
        $stmt->bind_param('isssi', $examId, $calc, $inputs, $results, $include);
        $stmt->execute();
        respond(['success' => true]);
    }

    if ($method === 'DELETE') {
        $examId = (int)($_GET['examination_id'] ?? 0);
        $calc   = $_GET['calculator'] ?? '';
        if (!$examId || !in_array($calc, $validCalcs, true)) respond(['success' => false, 'error' => 'examination_id + calculator required'], 400);
        $stmt = $db->prepare("DELETE FROM examination_risk_results WHERE examination_id = ? AND calculator = ?");
        $stmt->bind_param('is', $examId, $calc);
        $stmt->execute();
        respond(['success' => true, 'affected' => $stmt->affected_rows]);
    }

    respond(['success' => false, 'error' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}
