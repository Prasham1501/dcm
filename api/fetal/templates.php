<?php
/**
 * Fetal report templates API.
 *
 *   GET                              - list all active fetal templates
 *   GET ?exam_type=FTS              - filter by exam_type
 *   GET ?id=NNN                      - single template (incl. body)
 *   POST {template_key, template_name, exam_type, template_content}  - create / upsert
 *   PUT  {id, ...}                   - update
 *   DELETE ?id=NNN                   - soft-delete (sets is_active=0)
 *
 * Fetal templates are stored in the existing `report_templates` table
 * with `template_category = 'Ultrasound'` and `placeholders_supported = 1`.
 * The `exam_type` column distinguishes FTS / 2T / 3T / FETAL_ECHO / NEURO.
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

// Only return placeholder-aware Ultrasound templates — i.e. templates that
// were authored against the fetal medicine module.
$baseWhere = "template_category = 'Ultrasound' AND placeholders_supported = 1 AND is_active = 1";

try {
    if ($method === 'GET') {
        $id = (int)($_GET['id'] ?? 0);

        if ($id > 0) {
            $stmt = $db->prepare("
                SELECT id, template_key, template_name, exam_type,
                       template_content, placeholders_supported, is_active,
                       created_at, updated_at
                  FROM report_templates
                 WHERE id = ?
                 LIMIT 1
            ");
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            if (!$row) respond(['success' => false, 'error' => 'Not found'], 404);
            // The `template_content` column has a CHECK(json_valid(...)) constraint —
            // we store fetal templates as `{"body": "<html>"}` and surface the body
            // string directly to the client.
            $decoded = json_decode($row['template_content'], true);
            $row['body'] = is_array($decoded) && isset($decoded['body']) ? $decoded['body']
                          : (is_string($decoded) ? $decoded : '');
            unset($row['template_content']);
            respond(['success' => true, 'data' => $row]);
        }

        $examType = trim($_GET['exam_type'] ?? '');
        if ($examType !== '') {
            // Show templates that match the active exam type OR have no exam_type (i.e. universal).
            $stmt = $db->prepare("
                SELECT id, template_key, template_name, exam_type
                  FROM report_templates
                 WHERE $baseWhere
                   AND (exam_type = ? OR exam_type IS NULL OR exam_type = '')
                 ORDER BY (exam_type = ?) DESC, template_name
            ");
            $stmt->bind_param('ss', $examType, $examType);
        } else {
            $stmt = $db->prepare("
                SELECT id, template_key, template_name, exam_type
                  FROM report_templates
                 WHERE $baseWhere
                 ORDER BY template_name
            ");
        }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        respond(['success' => true, 'data' => $rows]);
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $key      = trim($body['template_key']     ?? '');
        $name     = trim($body['template_name']    ?? '');
        $examType = $body['exam_type']             ?? null;
        // Accept either a raw `body` string (we wrap it) or a pre-built
        // `template_content` JSON string (passed through unchanged).
        $content  = $body['template_content']
                    ?? json_encode(['body' => (string)($body['body'] ?? '')]);
        if ($key === '' || $name === '') respond(['success' => false, 'error' => 'template_key and template_name required'], 400);

        $stmt = $db->prepare("
            INSERT INTO report_templates
              (template_key, template_name, template_category, template_content,
               placeholders_supported, exam_type, is_active)
            VALUES (?, ?, 'Ultrasound', ?, 1, ?, 1)
            ON DUPLICATE KEY UPDATE
              template_name           = VALUES(template_name),
              template_content        = VALUES(template_content),
              exam_type               = VALUES(exam_type),
              placeholders_supported  = 1,
              is_active               = 1
        ");
        $stmt->bind_param('ssss', $key, $name, $content, $examType);
        $stmt->execute();
        $id = $stmt->insert_id > 0 ? $stmt->insert_id : (int)$db->query("SELECT id FROM report_templates WHERE template_key = '" . $db->real_escape_string($key) . "'")->fetch_assoc()['id'];
        respond(['success' => true, 'id' => $id]);
    }

    if ($method === 'PUT') {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($body['id'] ?? 0);
        if (!$id) respond(['success' => false, 'error' => 'id required'], 400);
        $name     = trim($body['template_name'] ?? '');
        $content  = $body['template_content']
                    ?? json_encode(['body' => (string)($body['body'] ?? '')]);
        $examType = $body['exam_type']          ?? null;
        $stmt = $db->prepare("
            UPDATE report_templates
               SET template_name = ?, template_content = ?, exam_type = ?
             WHERE id = ?
        ");
        $stmt->bind_param('sssi', $name, $content, $examType, $id);
        $stmt->execute();
        respond(['success' => true]);
    }

    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) respond(['success' => false, 'error' => 'id required'], 400);
        $db->query("UPDATE report_templates SET is_active = 0 WHERE id = " . $id);
        respond(['success' => true]);
    }

    respond(['success' => false, 'error' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}
