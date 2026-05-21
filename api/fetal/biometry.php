<?php
/**
 * Fetal Biometry API
 *
 *   GET  ?examination_id=...     - load all field values for an examination
 *   POST {examination_id, fields:[{field_key,value,unit,reference_author,percentile,z_score,is_abnormal}]}
 *         - upsert all provided fields (batch save)
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
        'SELECT field_key, value, unit, reference_author_code, percentile, z_score, is_abnormal
           FROM examination_biometry WHERE examination_id = ?'
    );
    $stmt->bind_param('i', $examId);
    $stmt->execute();
    $res = $stmt->get_result();
    $fields = [];
    while ($row = $res->fetch_assoc()) {
        $fields[$row['field_key']] = [
            'value'            => $row['value'] !== null ? (float)$row['value'] : null,
            'unit'             => $row['unit'],
            'referenceAuthor'  => $row['reference_author_code'],
            'percentile'       => $row['percentile'] !== null ? (float)$row['percentile'] : null,
            'zScore'           => $row['z_score'] !== null ? (float)$row['z_score'] : null,
            'isAbnormal'       => (bool)$row['is_abnormal'],
        ];
    }
    jsonResponse(['success' => true, 'data' => $fields]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) jsonResponse(['success' => false, 'error' => 'Invalid JSON'], 400);

    $examId = (int)($body['examination_id'] ?? 0);
    $fields = $body['fields'] ?? [];
    if (!$examId) jsonResponse(['success' => false, 'error' => 'examination_id required'], 400);
    if (!is_array($fields)) jsonResponse(['success' => false, 'error' => 'fields must be array'], 400);

    $stmt = $db->prepare(
        'INSERT INTO examination_biometry
           (examination_id, field_key, value, unit, reference_author_code, percentile, z_score, is_abnormal)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           value=VALUES(value), unit=VALUES(unit), reference_author_code=VALUES(reference_author_code),
           percentile=VALUES(percentile), z_score=VALUES(z_score), is_abnormal=VALUES(is_abnormal)'
    );

    foreach ($fields as $f) {
        $key      = $f['field_key']        ?? '';
        $val      = isset($f['value'])       ? (float)$f['value']      : null;
        $unit     = $f['unit']              ?? 'mm';
        $author   = $f['referenceAuthor']   ?? null;
        $pct      = isset($f['percentile']) ? (float)$f['percentile']  : null;
        $z        = isset($f['zScore'])     ? (float)$f['zScore']      : null;
        $abnormal = (int)(!empty($f['isAbnormal']));
        if ($key === '') continue;
        $stmt->bind_param('isdssddi', $examId, $key, $val, $unit, $author, $pct, $z, $abnormal);
        $stmt->execute();
    }

    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
