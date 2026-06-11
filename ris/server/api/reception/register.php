<?php
/**
 * Reception — Register a visit (creates a visit + orders with accession + StudyInstanceUID).
 * POST { patient_id, services:[{service_id,price?,modality?,scheduled_station_ae?,scheduled_datetime?,clinical_notes?}],
 *        referring_doctor_id?, discount?, tax?, scheduled_station_ae? }
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisUid.php';
require_once __DIR__ . '/../../includes/ris/RisRegistrationRepository.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistMapper.php';
require_once __DIR__ . '/../../includes/ris/RisDicomWriter.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistService.php';
require_once __DIR__ . '/../../includes/ris/worklist_dir.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

ob_start();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
    if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
    if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
        sendErrorResponse('Forbidden - reception access required', 403);
    }

    $user = getCurrentUser();
    $db = getDbConnection();

    // UID root from settings (falls back to a sane default).
    $uidRoot = '1.2.826.0.1.3680043.10.1338';
    $res = $db->query("SELECT setting_value FROM hospital_settings WHERE setting_key='dicom_uid_root'");
    if ($res && ($row = $res->fetch_assoc()) && $row['setting_value'] !== '') {
        $uidRoot = $row['setting_value'];
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $input['created_by'] = $user['id'];

    $reg = new RisRegistrationRepository($db, new RisCounters($db), $uidRoot);
    try {
        $result = $reg->register($input);
    } catch (InvalidArgumentException $e) {
        sendErrorResponse($e->getMessage(), 400);
    }

    // Write a DICOM Modality Worklist entry per order so the machine auto-fills
    // patient demographics. Best-effort: never fail a registration over this.
    try {
        $wl = new RisWorklistService($db, ris_worklist_dir($db));
        foreach ($result['orders'] as &$o) {
            $p = $wl->writeForOrder((int) $o['id']);
            if ($p) { $o['mwl_path'] = $p; }
        }
        unset($o);
    } catch (Throwable $we) {
        logMessage('Worklist write failed during registration: ' . $we->getMessage(), 'warning', 'ris.log');
    }

    logAuditEvent(
        $user['id'], 'create', 'ris_visit', $result['visit']['id'],
        'Registered visit ' . $result['visit']['visit_no'] . ' with ' . count($result['orders']) . ' order(s)'
    );
    if (ob_get_length()) { ob_clean(); }
    sendSuccessResponse($result, 'Visit registered');
} catch (Throwable $e) {
    logMessage('Reception register error: ' . $e->getMessage(), 'error', 'ris.log');
    if (ob_get_length()) { ob_clean(); }
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
