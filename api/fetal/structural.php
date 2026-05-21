<?php
/**
 * Fetal Structural Assessment API
 *
 *   GET  ?examination_id=...     - load all anatomy rows for an examination
 *   POST {examination_id, rows:[{system,anatomy_key,status,comments}]}
 *         - upsert all provided rows (batch save)
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession() && !isLocalRequest()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = getDbConnection();

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

if ($method === 'GET') {
    $examId = (int)($_GET['examination_id'] ?? 0);
    if (!$examId) jsonResponse(['success' => false, 'error' => 'examination_id required'], 400);

    $stmt = $db->prepare(
        'SELECT system, anatomy_key, status, comments
           FROM examination_structural WHERE examination_id = ?'
    );
    $stmt->bind_param('i', $examId);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $rows[] = [
            'system'     => $row['system'],
            'anatomyKey' => $row['anatomy_key'],
            'status'     => $row['status'],
            'comments'   => $row['comments'],
        ];
    }
    jsonResponse(['success' => true, 'data' => $rows]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) jsonResponse(['success' => false, 'error' => 'Invalid JSON'], 400);

    $examId = (int)($body['examination_id'] ?? 0);
    $rows = $body['rows'] ?? [];
    if (!$examId) jsonResponse(['success' => false, 'error' => 'examination_id required'], 400);
    if (!is_array($rows)) jsonResponse(['success' => false, 'error' => 'rows must be array'], 400);

    $stmt = $db->prepare(
        'INSERT INTO examination_structural
           (examination_id, system, anatomy_key, status, comments)
         VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           status=VALUES(status), comments=VALUES(comments)'
    );

    foreach ($rows as $r) {
        $system   = $r['system']     ?? '';
        $key      = $r['anatomyKey'] ?? '';
        $status   = $r['status']     ?? 'select';
        $comments = $r['comments']   ?? null;
        if ($system === '' || $key === '') continue;
        if (!in_array($status, ['normal','abnormal','not_seen','select'], true)) $status = 'select';
        $stmt->bind_param('issss', $examId, $system, $key, $status, $comments);
        $stmt->execute();
    }

    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
