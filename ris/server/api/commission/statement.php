<?php
/** Commission — a doctor's unpaid statement. GET ?doctor_id=&period=YYYY-MM -> {entries,total} */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCommissionRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin'])) { sendErrorResponse('Forbidden', 403); }

try {
    $doctorId = (int) ($_GET['doctor_id'] ?? 0);
    if ($doctorId <= 0) { sendErrorResponse('doctor_id is required', 400); }
    $period = preg_match('/^\d{4}-\d{2}$/', $_GET['period'] ?? '') ? $_GET['period'] : null;
    sendSuccessResponse((new RisCommissionRepository(getDbConnection()))->statement($doctorId, $period));
} catch (Throwable $e) {
    logMessage('Commission statement error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
