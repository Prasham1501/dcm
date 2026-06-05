<?php
/**
 * Console simulator — scheduled RIS orders that a modality would pull by MWL.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    $res = $db->query(
        "SELECT o.id, o.accession_number, o.study_instance_uid, o.modality, o.status,
                p.mrn, p.dicom_patient_id, p.full_name AS patient_name, p.age_years, p.sex,
                s.name AS service_name
         FROM ris_orders o
         LEFT JOIN ris_patients p ON p.id = o.patient_id
         LEFT JOIN ris_services s ON s.id = o.service_id
         WHERE o.status IN ('scheduled','arrived','in_progress')
           AND o.linked_study_uid IS NULL
         ORDER BY o.created_at DESC
         LIMIT 100"
    );
    $rows = [];
    while ($res && $row = $res->fetch_assoc()) { $rows[] = $row; }
    sendSuccessResponse($rows);
} catch (Throwable $e) {
    logMessage('Console simulator orders error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
