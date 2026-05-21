<?php
/**
 * Examination DST (Decision-Support-Tree) selections API.
 *
 * Reads/writes the four examination_* link tables that hold the user's
 * selected findings, syndromes, genes, and investigations for a given
 * examination.
 *
 *   GET  ?examination_id=...           - returns {findings:[], syndromes:[], genes:[], investigations:[]}
 *
 *   POST {examination_id, kind:'finding'|'syndrome'|'gene'|'investigation', id, [opts]}
 *        - add a row (idempotent — duplicate inserts are silently ignored)
 *        - opts: include_in_report (default 1), category (investigations: basic|specific),
 *                match_score_num, match_score_den (syndromes only)
 *
 *   PUT {examination_id, kind, id, include_in_report}
 *        - toggle "include in report" for an existing row
 *
 *   DELETE ?examination_id=...&kind=...&id=...
 *        - remove a single selection
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

$db     = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/** Map abstract kind → table + FK column. */
function kindTable(string $kind): array {
    return match ($kind) {
        'finding'       => ['examination_findings',        'finding_id'],
        'syndrome'      => ['examination_syndromes',       'syndrome_id'],
        'gene'          => ['examination_genes',           'gene_id'],
        'investigation' => ['examination_investigations',  'investigation_id'],
        default         => throw new InvalidArgumentException("Unknown kind: $kind"),
    };
}

try {
    if ($method === 'GET') {
        $examId = (int)($_GET['examination_id'] ?? 0);
        if (!$examId) respond(['success' => false, 'error' => 'examination_id required'], 400);

        // Findings + system
        $stmt = $db->prepare("
            SELECT f.id, f.name, f.system, ef.include_in_report
              FROM examination_findings ef
              INNER JOIN findings f ON f.id = ef.finding_id
              WHERE ef.examination_id = ?
              ORDER BY f.name
        ");
        $stmt->bind_param('i', $examId); $stmt->execute();
        $findings = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Syndromes + cached match score (if stored)
        $stmt = $db->prepare("
            SELECT s.id, s.name, s.omim_id,
                   es.match_score_num, es.match_score_den, es.include_in_report
              FROM examination_syndromes es
              INNER JOIN syndromes s ON s.id = es.syndrome_id
              WHERE es.examination_id = ?
              ORDER BY s.name
        ");
        $stmt->bind_param('i', $examId); $stmt->execute();
        $syndromes = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $stmt = $db->prepare("
            SELECT g.id, g.symbol, g.full_name, eg.include_in_report
              FROM examination_genes eg
              INNER JOIN genes g ON g.id = eg.gene_id
              WHERE eg.examination_id = ?
              ORDER BY g.symbol
        ");
        $stmt->bind_param('i', $examId); $stmt->execute();
        $genes = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        $stmt = $db->prepare("
            SELECT i.id, i.name, i.category AS catalog_category,
                   ei.category, ei.include_in_report
              FROM examination_investigations ei
              INNER JOIN investigations i ON i.id = ei.investigation_id
              WHERE ei.examination_id = ?
              ORDER BY i.name
        ");
        $stmt->bind_param('i', $examId); $stmt->execute();
        $investigations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        respond(['success' => true, 'data' => compact('findings', 'syndromes', 'genes', 'investigations')]);
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $examId = (int)($body['examination_id'] ?? 0);
        $kind   = $body['kind'] ?? '';
        $id     = (int)($body['id'] ?? 0);
        if (!$examId || !$id || !$kind) respond(['success' => false, 'error' => 'examination_id, kind, id required'], 400);

        [$table, $fk] = kindTable($kind);
        $include = isset($body['include_in_report']) ? (int)$body['include_in_report'] : 1;

        if ($kind === 'syndrome') {
            $num = isset($body['match_score_num']) ? (int)$body['match_score_num'] : null;
            $den = isset($body['match_score_den']) ? (int)$body['match_score_den'] : null;
            $stmt = $db->prepare("
                INSERT INTO examination_syndromes (examination_id, syndrome_id, match_score_num, match_score_den, include_in_report)
                VALUES (?,?,?,?,?)
                ON DUPLICATE KEY UPDATE
                  match_score_num=VALUES(match_score_num),
                  match_score_den=VALUES(match_score_den),
                  include_in_report=VALUES(include_in_report)
            ");
            $stmt->bind_param('iiiii', $examId, $id, $num, $den, $include);
        } elseif ($kind === 'investigation') {
            $category = $body['category'] ?? 'basic';
            if (!in_array($category, ['basic','specific'], true)) $category = 'basic';
            $stmt = $db->prepare("
                INSERT INTO examination_investigations (examination_id, investigation_id, category, include_in_report)
                VALUES (?,?,?,?)
                ON DUPLICATE KEY UPDATE
                  category=VALUES(category),
                  include_in_report=VALUES(include_in_report)
            ");
            $stmt->bind_param('iisi', $examId, $id, $category, $include);
        } else {
            // finding | gene — simple link with include flag
            $sql = "INSERT INTO $table (examination_id, $fk, include_in_report)
                    VALUES (?,?,?)
                    ON DUPLICATE KEY UPDATE include_in_report=VALUES(include_in_report)";
            $stmt = $db->prepare($sql);
            $stmt->bind_param('iii', $examId, $id, $include);
        }

        $stmt->execute();
        respond(['success' => true]);
    }

    if ($method === 'PUT') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $examId  = (int)($body['examination_id'] ?? 0);
        $kind    = $body['kind'] ?? '';
        $id      = (int)($body['id'] ?? 0);
        $include = (int)($body['include_in_report'] ?? 1);
        if (!$examId || !$id || !$kind) respond(['success' => false, 'error' => 'examination_id, kind, id required'], 400);

        [$table, $fk] = kindTable($kind);
        $stmt = $db->prepare("UPDATE $table SET include_in_report = ? WHERE examination_id = ? AND $fk = ?");
        $stmt->bind_param('iii', $include, $examId, $id);
        $stmt->execute();
        respond(['success' => true]);
    }

    if ($method === 'DELETE') {
        $examId = (int)($_GET['examination_id'] ?? 0);
        $kind   = $_GET['kind'] ?? '';
        $id     = (int)($_GET['id'] ?? 0);
        if (!$examId || !$id || !$kind) respond(['success' => false, 'error' => 'examination_id, kind, id required'], 400);

        [$table, $fk] = kindTable($kind);
        $stmt = $db->prepare("DELETE FROM $table WHERE examination_id = ? AND $fk = ?");
        $stmt->bind_param('ii', $examId, $id);
        $stmt->execute();
        respond(['success' => true, 'affected' => $stmt->affected_rows]);
    }

    respond(['success' => false, 'error' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}
