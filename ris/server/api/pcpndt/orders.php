<?php
/**
 * List RIS orders that can be used to create or reopen PCPNDT Form F records.
 * GET ?q=<patient/mrn/accession>&limit=100
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (function_exists('hasRole') && !hasRole(['admin', 'super_admin', 'doctor', 'receptionist'])) {
    sendErrorResponse('Forbidden', 403);
}

function risPcpndtTableExists(mysqli $db, string $table): bool
{
    $res = $db->query("SHOW TABLES LIKE '" . $db->real_escape_string($table) . "'");
    return $res && $res->num_rows > 0;
}

function risPcpndtRefs(array &$arr): array
{
    $refs = [];
    foreach ($arr as $key => &$value) { $refs[$key] = &$value; }
    return $refs;
}

try {
    $db = getDbConnection();
    $q = trim((string) ($_GET['q'] ?? ''));
    $limit = max(10, min(200, (int) ($_GET['limit'] ?? 100)));
    $hasPcpndt = risPcpndtTableExists($db, 'pcpndt_form_f');
    $pcpSelect = $hasPcpndt
        ? "pf.status AS form_status, pf.updated_at AS form_updated_at"
        : "NULL AS form_status, NULL AS form_updated_at";
    $pcpJoin = $hasPcpndt
        ? "LEFT JOIN pcpndt_form_f pf ON pf.study_uid = COALESCE(o.linked_study_uid, o.study_instance_uid)"
        : "";

    $sql = "SELECT o.id, o.visit_id, o.patient_id, o.accession_number, o.study_instance_uid,
                   o.linked_study_uid, o.modality, o.status, o.scheduled_datetime,
                   o.token_no, o.room_title, o.price,
                   p.mrn, p.full_name AS patient_name, p.sex, p.age_years, p.phone,
                   s.name AS service_name,
                   v.visit_no, v.visit_datetime, v.net_amount, v.paid_amount, v.balance,
                   rd.name AS referring_doctor,
                   $pcpSelect
            FROM ris_orders o
            LEFT JOIN ris_patients p ON p.id = o.patient_id
            LEFT JOIN ris_services s ON s.id = o.service_id
            LEFT JOIN ris_visits v ON v.id = o.visit_id
            LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
            $pcpJoin";

    $params = [];
    $types = '';
    if ($q !== '') {
        $like = '%' . $q . '%';
        $sql .= " WHERE p.full_name LIKE ? OR p.mrn LIKE ? OR p.phone LIKE ? OR o.accession_number LIKE ? OR v.visit_no LIKE ?";
        $params = [$like, $like, $like, $like, $like];
        $types = 'sssss';
    }
    $sql .= " ORDER BY o.id DESC LIMIT ?";
    $params[] = $limit;
    $types .= 'i';

    $stmt = $db->prepare($sql);
    if (!$stmt) { throw new RuntimeException($db->error); }
    $stmt->bind_param($types, ...risPcpndtRefs($params));
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendSuccessResponse($rows);
} catch (Throwable $e) {
    logMessage('PCPNDT orders error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
