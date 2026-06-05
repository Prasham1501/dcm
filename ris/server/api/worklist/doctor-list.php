<?php
/**
 * Worklist — doctor console list.
 *   GET ?status=acquired,in_progress,reported&modality=US   -> worklist rows
 *   GET ?collection=1                                       -> reported (ready-to-collect) rows
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisOrderWorkflow.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'doctor', 'receptionist'])) {
    sendErrorResponse('Forbidden', 403);
}

try {
    $wf = new RisOrderWorkflow(getDbConnection());
    if (!empty($_GET['collection'])) {
        sendSuccessResponse($wf->collectionList());
    }
    $filters = [];
    if (!empty($_GET['status'])) { $filters['status'] = explode(',', $_GET['status']); }
    if (!empty($_GET['modality'])) { $filters['modality'] = $_GET['modality']; }
    sendSuccessResponse($wf->doctorList($filters));
} catch (Throwable $e) {
    logMessage('Worklist doctor-list error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
