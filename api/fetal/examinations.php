<?php
/**
 * Fetal Examinations API - CRUD over the `examinations` table.
 *
 *   GET    /api/fetal/examinations.php?patient_id=...        - list for a patient
 *   GET    /api/fetal/examinations.php?id=...                - get a single examination
 *   POST   /api/fetal/examinations.php                       - create
 *   PUT    /api/fetal/examinations.php?id=...                - update
 *   DELETE /api/fetal/examinations.php?id=...                - delete
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession() && !isLocalRequest()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $mysqli = getDbConnection();

    switch ($method) {
        case 'GET':    handleGet($mysqli);    break;
        case 'POST':   handlePost($mysqli);   break;
        case 'PUT':    handlePut($mysqli);    break;
        case 'DELETE': handleDelete($mysqli); break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => 'Examinations API failed',
        'details' => (defined('APP_ENV') && APP_ENV === 'development') ? $e->getMessage() : null,
    ]);
}

// -------------------- handlers --------------------

function handleGet(mysqli $mysqli): void {
    $id        = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $patientId = $_GET['patient_id'] ?? '';

    if ($id > 0) {
        $stmt = $mysqli->prepare('SELECT * FROM examinations WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Examination not found']);
            return;
        }
        echo json_encode(['success' => true, 'data' => mapExamRow($row)]);
        return;
    }

    if ($patientId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'patient_id is required']);
        return;
    }

    $stmt = $mysqli->prepare(
        'SELECT * FROM examinations WHERE patient_id = ? ORDER BY exam_date DESC, id DESC'
    );
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = [];
    while ($r = $result->fetch_assoc()) { $rows[] = mapExamRow($r); }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $rows]);
}

function handlePost(mysqli $mysqli): void {
    $body = readJsonBody();
    $patientId = trim($body['patient_id'] ?? '');
    if ($patientId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'patient_id is required']);
        return;
    }

    $studyUid    = $body['study_uid']             ?? null;
    $examLabel   = $body['exam_label']            ?? null;
    $examType    = $body['exam_type']             ?? 'FTS';
    $examDate    = $body['exam_date']             ?? date('Y-m-d');
    $lmpDate     = $body['lmp_date']              ?? null;
    $gaWeeks     = isset($body['gestational_age_weeks']) ? floatval($body['gestational_age_weeks']) : null;
    $edd         = $body['edd']                   ?? null;
    $obHistory   = jsonOrNull($body['obstetric_history']    ?? null);
    $maternal    = jsonOrNull($body['maternal_assessment']  ?? null);
    $family      = jsonOrNull($body['family_history']       ?? null);
    $createdBy   = $_SESSION['user_id'] ?? null;

    if (!$examLabel) {
        // Auto-name as "Examination N"
        $countStmt = $mysqli->prepare('SELECT COUNT(*) AS c FROM examinations WHERE patient_id = ?');
        $countStmt->bind_param('s', $patientId);
        $countStmt->execute();
        $count = (int)$countStmt->get_result()->fetch_assoc()['c'];
        $countStmt->close();
        $examLabel = 'Examination ' . ($count + 1);
    }

    $stmt = $mysqli->prepare(
        'INSERT INTO examinations
         (patient_id, study_uid, exam_label, exam_type, exam_date, lmp_date,
          gestational_age_weeks, edd, obstetric_history, maternal_assessment,
          family_history, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->bind_param(
        'sssssssdsssi',  // patient_id, study_uid, label, type, date, lmp,
                         // ga, edd, obHistory, maternal, family, createdBy ...
                         // we use 'd' for ga (decimal) and 'i' for createdBy
        $patientId, $studyUid, $examLabel, $examType, $examDate, $lmpDate,
        $gaWeeks, $edd, $obHistory, $maternal, $family, $createdBy
    );
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Insert failed: ' . $stmt->error]);
        $stmt->close();
        return;
    }
    $newId = $stmt->insert_id;
    $stmt->close();

    $sel = $mysqli->prepare('SELECT * FROM examinations WHERE id = ?');
    $sel->bind_param('i', $newId);
    $sel->execute();
    $row = $sel->get_result()->fetch_assoc();
    $sel->close();

    http_response_code(201);
    echo json_encode(['success' => true, 'data' => mapExamRow($row)]);
}

function handlePut(mysqli $mysqli): void {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'id query param required']);
        return;
    }
    $body = readJsonBody();

    $allowed = [
        'study_uid'             => 's',
        'exam_label'            => 's',
        'exam_type'             => 's',
        'exam_date'             => 's',
        'lmp_date'              => 's',
        'gestational_age_weeks' => 'd',
        'edd'                   => 's',
        'obstetric_history'     => 'json',
        'maternal_assessment'   => 'json',
        'family_history'        => 'json',
        'status'                => 's',
    ];

    $sets = []; $types = ''; $params = [];
    foreach ($allowed as $col => $kind) {
        if (!array_key_exists($col, $body)) continue;
        $sets[] = "`$col` = ?";
        if ($kind === 'json') {
            $params[] = jsonOrNull($body[$col]);
            $types   .= 's';
        } else {
            $params[] = $body[$col];
            $types   .= $kind;
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No updatable fields provided']);
        return;
    }

    $sql = 'UPDATE examinations SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $types  .= 'i';
    $params[] = $id;

    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param($types, ...$params);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Update failed: ' . $stmt->error]);
        $stmt->close();
        return;
    }
    $stmt->close();

    $sel = $mysqli->prepare('SELECT * FROM examinations WHERE id = ?');
    $sel->bind_param('i', $id);
    $sel->execute();
    $row = $sel->get_result()->fetch_assoc();
    $sel->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Examination not found after update']);
        return;
    }
    echo json_encode(['success' => true, 'data' => mapExamRow($row)]);
}

function handleDelete(mysqli $mysqli): void {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'id query param required']);
        return;
    }

    // Cascade-delete dependent rows (no FKs declared, so do it manually).
    $tables = [
        'examination_biometry',
        'examination_structural',
        'examination_findings',
        'examination_syndromes',
        'examination_genes',
        'examination_investigations',
        'examination_risk_results',
    ];
    foreach ($tables as $t) {
        $stmt = $mysqli->prepare("DELETE FROM `$t` WHERE examination_id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
    }

    $stmt = $mysqli->prepare('DELETE FROM examinations WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Examination not found']);
        return;
    }
    echo json_encode(['success' => true]);
}

// -------------------- helpers --------------------

function readJsonBody(): array {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function jsonOrNull($value): ?string {
    if ($value === null || $value === '') return null;
    if (is_string($value)) {
        // Already a JSON string? Keep it. Otherwise wrap.
        json_decode($value);
        return (json_last_error() === JSON_ERROR_NONE) ? $value : json_encode($value);
    }
    return json_encode($value);
}

function mapExamRow(array $row): array {
    foreach (['obstetric_history', 'maternal_assessment', 'family_history'] as $jsonCol) {
        if (isset($row[$jsonCol]) && is_string($row[$jsonCol]) && $row[$jsonCol] !== '') {
            $decoded = json_decode($row[$jsonCol], true);
            $row[$jsonCol] = (json_last_error() === JSON_ERROR_NONE) ? $decoded : null;
        } else {
            $row[$jsonCol] = null;
        }
    }
    if (isset($row['gestational_age_weeks']) && $row['gestational_age_weeks'] !== null) {
        $row['gestational_age_weeks'] = (float)$row['gestational_age_weeks'];
    }
    return $row;
}
