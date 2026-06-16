<?php
/**
 * Home-visit collection agenda.
 *   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD  -> home-visit visits in the range
 *
 * Powers the RIS "Schedule" tab so field/phlebotomy staff can see where to go
 * (area + patient address) and which tests to collect, ordered by collection time.
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $db = getDbConnection();
    $from = trim((string)($_GET['from'] ?? date('Y-m-d')));
    $to = trim((string)($_GET['to'] ?? $from));
    $fromDateTime = $from . ' 00:00:00';
    $toDateTime = date('Y-m-d H:i:s', strtotime($to . ' +1 day'));

    // Only home-visit visits in the range. Ordered by the actual collection time
    // (sample_collected_at), falling back to the planned home_visit_time.
    $sql = "
        SELECT
            v.id, v.visit_no, v.visit_datetime, v.status, v.balance, v.net_amount, v.paid_amount,
            v.home_visit_area, v.home_visit_time, v.home_visit_amount, v.sample_collected_at,
            v.phlebotomy_staff, v.visit_comment, v.urgent_report,
            p.id AS patient_id, p.mrn, p.full_name, p.phone, p.age_years, p.sex,
            p.address_line1, p.address_line2, p.city,
            rd.name AS doctor_name,
            GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS test_names,
            COUNT(DISTINCT o.id) AS order_count
        FROM ris_visits v
        JOIN ris_patients p ON p.id = v.patient_id
        LEFT JOIN ris_referring_doctors rd ON rd.id = v.referring_doctor_id
        LEFT JOIN ris_orders o ON o.visit_id = v.id
        LEFT JOIN ris_services s ON s.id = o.service_id
        WHERE v.home_visit = 1
          AND v.status <> 'cancelled'
          AND v.visit_datetime >= ? AND v.visit_datetime < ?
        GROUP BY v.id
        ORDER BY COALESCE(v.sample_collected_at, v.home_visit_time) ASC, v.visit_datetime ASC, v.id ASC";

    $stmt = $db->prepare($sql);
    $stmt->bind_param('ss', $fromDateTime, $toDateTime);
    $stmt->execute();
    $res = $stmt->get_result();
    $rows = [];
    while ($row = $res->fetch_assoc()) {
        $address = trim(implode(', ', array_filter([
            $row['address_line1'] ?? '',
            $row['address_line2'] ?? '',
            $row['city'] ?? '',
        ], static fn ($part) => trim((string)$part) !== '')));
        $row['address'] = $address;
        $rows[] = $row;
    }
    $stmt->close();

    sendSuccessResponse(['rows' => $rows, 'from' => $from, 'to' => $to]);
} catch (Throwable $e) {
    logMessage('Schedule agenda API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
