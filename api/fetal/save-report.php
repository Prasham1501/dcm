<?php
/**
 * Save the composed fetal report into the medical_reports table.
 * Acts as both DRAFT (status=draft) and FINAL (status=final) writer:
 *
 *   POST { examination_id, status, html, patient_id, patient_name,
 *          study_uid?, study_date?, modality?, findings_text?,
 *          impression_text?, recommendations_text? }
 *
 * The rendered HTML goes into the `findings` text column (since
 * medical_reports has no dedicated HTML field) — the consumer renders
 * the field as HTML when the report was authored by this module.
 *
 * We upsert by (examination_id, status='draft') so editing a draft
 * doesn't proliferate rows. Finalised reports always insert a new row.
 *
 * Also: GET ?examination_id=… returns the most recent draft or final
 * for the examination so the composer can resume.
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
            SELECT id, status, findings, impression, recommendations,
                   patient_id, patient_name, study_date, modality,
                   finalized_at, printed_at, created_at, updated_at
              FROM medical_reports
             WHERE examination_id = ?
             ORDER BY updated_at DESC
             LIMIT 1
        ");
        $stmt->bind_param('i', $examId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        respond(['success' => true, 'data' => $row]);
    }

    if ($method !== 'POST') respond(['success' => false, 'error' => 'Method not allowed'], 405);

    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) respond(['success' => false, 'error' => 'Invalid JSON'], 400);

    $examId = (int)($body['examination_id'] ?? 0);
    if (!$examId) respond(['success' => false, 'error' => 'examination_id required'], 400);

    $status = $body['status'] ?? 'draft';
    if (!in_array($status, ['draft', 'final'], true)) {
        respond(['success' => false, 'error' => 'status must be draft or final'], 400);
    }

    $html              = $body['html']                 ?? '';
    $patientId         = $body['patient_id']           ?? '';
    $patientName       = $body['patient_name']         ?? null;
    $studyUid          = $body['study_uid']            ?? '';
    $studyDate         = $body['study_date']           ?? null;
    $modality          = $body['modality']             ?? 'US';
    $impression        = $body['impression_text']      ?? null;
    $recommendations   = $body['recommendations_text'] ?? null;
    $createdBy         = $_SESSION['user_id']          ?? null;

    if ($patientId === '') respond(['success' => false, 'error' => 'patient_id required'], 400);
    // study_uid is NOT NULL in the schema — use the examination ID as a stable surrogate
    if ($studyUid === '') $studyUid = 'EXAM-' . $examId;

    if ($status === 'draft') {
        // Upsert the single draft per examination
        $existing = $db->prepare("SELECT id FROM medical_reports WHERE examination_id = ? AND status = 'draft' LIMIT 1");
        $existing->bind_param('i', $examId);
        $existing->execute();
        $draftId = (int)($existing->get_result()->fetch_assoc()['id'] ?? 0);

        if ($draftId > 0) {
            $stmt = $db->prepare("
                UPDATE medical_reports
                   SET findings = ?, impression = ?, recommendations = ?,
                       patient_id = ?, patient_name = ?, study_date = ?, modality = ?
                 WHERE id = ?
            ");
            $stmt->bind_param('sssssssi', $html, $impression, $recommendations,
                              $patientId, $patientName, $studyDate, $modality, $draftId);
            $stmt->execute();
            respond(['success' => true, 'id' => $draftId, 'status' => 'draft']);
        } else {
            $stmt = $db->prepare("
                INSERT INTO medical_reports
                  (examination_id, status, study_uid, patient_id, patient_name,
                   study_date, modality, findings, impression, recommendations, created_by)
                VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->bind_param('isssssssssi', $examId, $studyUid, $patientId, $patientName,
                              $studyDate, $modality, $html, $impression, $recommendations, $createdBy);
            $stmt->execute();
            respond(['success' => true, 'id' => $stmt->insert_id, 'status' => 'draft']);
        }
    }

    // status === 'final' — always a new row, stamped finalized_at
    $stmt = $db->prepare("
        INSERT INTO medical_reports
          (examination_id, status, study_uid, patient_id, patient_name,
           study_date, modality, findings, impression, recommendations,
           created_by, finalized_by, finalized_at)
        VALUES (?, 'final', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->bind_param('isssssssssii', $examId, $studyUid, $patientId, $patientName,
                      $studyDate, $modality, $html, $impression, $recommendations,
                      $createdBy, $createdBy);
    $stmt->execute();

    // Examination → final
    $db->query("UPDATE examinations SET status = 'final' WHERE id = " . $examId);

    respond(['success' => true, 'id' => $stmt->insert_id, 'status' => 'final']);

} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}
