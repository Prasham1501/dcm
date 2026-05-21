<?php
/**
 * Fetal Intervention API — procedures log + counselling notes.
 *
 *   GET  ?examination_id=...                  - { procedures: [...], counselling: "..." }
 *   POST {examination_id, procedure}          - create (procedure object below)
 *   PUT  {id, ...fields}                      - update one procedure
 *   DELETE ?id=...                            - delete one procedure
 *   PUT  /?counselling=1 {examination_id, notes}
 *                                             - set the free-text counselling notes
 *
 * Procedure shape:
 *   { procedure_type, procedure_date?, operator?, indication?, findings?,
 *     complications?, outcome?, include_in_report? }
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

try {
    if ($method === 'GET') {
        $examId = (int)($_GET['examination_id'] ?? 0);
        if (!$examId) respond(['success' => false, 'error' => 'examination_id required'], 400);

        $stmt = $db->prepare("
            SELECT id, examination_id, procedure_type, procedure_date, operator,
                   indication, findings, complications, outcome, include_in_report,
                   created_at, updated_at
              FROM examination_interventions
             WHERE examination_id = ?
             ORDER BY procedure_date DESC, id DESC
        ");
        $stmt->bind_param('i', $examId);
        $stmt->execute();
        $procedures = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $stmt = $db->prepare("SELECT counselling_notes FROM examinations WHERE id = ?");
        $stmt->bind_param('i', $examId);
        $stmt->execute();
        $counselling = $stmt->get_result()->fetch_assoc()['counselling_notes'] ?? '';

        respond(['success' => true, 'data' => ['procedures' => $procedures, 'counselling' => $counselling]]);
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $examId = (int)($body['examination_id'] ?? 0);
        $p      = $body['procedure'] ?? [];
        if (!$examId || empty($p['procedure_type'])) respond(['success' => false, 'error' => 'examination_id + procedure.procedure_type required'], 400);

        $type    = $p['procedure_type'];
        $date    = $p['procedure_date']    ?? null;
        $op      = $p['operator']          ?? null;
        $ind     = $p['indication']        ?? null;
        $find    = $p['findings']          ?? null;
        $comp    = $p['complications']     ?? null;
        $out     = $p['outcome']           ?? null;
        $include = isset($p['include_in_report']) ? (int)$p['include_in_report'] : 1;

        $stmt = $db->prepare("
            INSERT INTO examination_interventions
              (examination_id, procedure_type, procedure_date, operator,
               indication, findings, complications, outcome, include_in_report)
            VALUES (?,?,?,?,?,?,?,?,?)
        ");
        $stmt->bind_param('isssssssi', $examId, $type, $date, $op, $ind, $find, $comp, $out, $include);
        $stmt->execute();
        respond(['success' => true, 'id' => $stmt->insert_id]);
    }

    if ($method === 'PUT') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];

        // Variant: update counselling notes
        if (isset($_GET['counselling'])) {
            $examId = (int)($body['examination_id'] ?? 0);
            $notes  = $body['notes'] ?? '';
            if (!$examId) respond(['success' => false, 'error' => 'examination_id required'], 400);
            $stmt = $db->prepare("UPDATE examinations SET counselling_notes = ? WHERE id = ?");
            $stmt->bind_param('si', $notes, $examId);
            $stmt->execute();
            respond(['success' => true]);
        }

        // Variant: update a single procedure row by id
        $id = (int)($body['id'] ?? 0);
        if (!$id) respond(['success' => false, 'error' => 'id required'], 400);

        $type    = $body['procedure_type']     ?? null;
        $date    = $body['procedure_date']     ?? null;
        $op      = $body['operator']           ?? null;
        $ind     = $body['indication']         ?? null;
        $find    = $body['findings']           ?? null;
        $comp    = $body['complications']      ?? null;
        $out     = $body['outcome']            ?? null;
        $include = isset($body['include_in_report']) ? (int)$body['include_in_report'] : 1;

        $stmt = $db->prepare("
            UPDATE examination_interventions
               SET procedure_type = COALESCE(?, procedure_type),
                   procedure_date = ?,
                   operator       = ?,
                   indication     = ?,
                   findings       = ?,
                   complications  = ?,
                   outcome        = ?,
                   include_in_report = ?
             WHERE id = ?
        ");
        $stmt->bind_param('sssssssii', $type, $date, $op, $ind, $find, $comp, $out, $include, $id);
        $stmt->execute();
        respond(['success' => true]);
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) respond(['success' => false, 'error' => 'id required'], 400);
        $stmt = $db->prepare("DELETE FROM examination_interventions WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        respond(['success' => true, 'affected' => $stmt->affected_rows]);
    }

    respond(['success' => false, 'error' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}
