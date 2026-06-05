<?php
/**
 * Reception — Referring doctors.
 *   GET  ?q=<query>   -> search (or list active when q is empty)
 *   POST { name, phone?, registration_no?, commission_type?, commission_value?, ... } -> create
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisReferringDoctorRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $repo = new RisReferringDoctorRepository(getDbConnection());

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $q = trim((string) ($_GET['q'] ?? ''));
        $data = $q !== '' ? $repo->search($q) : $repo->listActive();
        sendSuccessResponse($data);
    }

    // POST = create (receptionists/admins only).
    if (!hasRole(['admin', 'super_admin', 'receptionist'])) {
        sendErrorResponse('Forbidden', 403);
    }
    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    try {
        $doctor = $repo->create($input);
    } catch (InvalidArgumentException $e) {
        sendErrorResponse($e->getMessage(), 400);
    }
    logAuditEvent($user['id'], 'create', 'ris_referring_doctor', $doctor['id'], 'Added referring doctor ' . $doctor['name']);
    sendSuccessResponse($doctor, 'Referring doctor added');
} catch (Throwable $e) {
    logMessage('Reception referring-doctors error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
