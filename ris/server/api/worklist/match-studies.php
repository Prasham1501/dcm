<?php
/**
 * Worklist — match incoming studies to scheduled orders and clean up their .wl files.
 * Intended to be polled by the doctor/reception console (or a cron) after Orthanc sync.
 * GET or POST -> { matched: N, orders: [...] }
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisUid.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistMapper.php';
require_once __DIR__ . '/../../includes/ris/RisDicomWriter.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistService.php';
require_once __DIR__ . '/../../includes/ris/RisOrthancSync.php';
require_once __DIR__ . '/../../includes/ris/RisStudyMatcher.php';
require_once __DIR__ . '/../../includes/ris/worklist_dir.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden', 403);
}

try {
    $db = getDbConnection();
    $sync = new RisOrthancSync($db);
    $syncStats = $sync->sync();
    $matched = (new RisStudyMatcher($db))->matchPending();

    $wl = new RisWorklistService($db, ris_worklist_dir($db));
    foreach ($matched as $m) {
        $wl->removeForOrder((int) $m['order_id']);
    }
    sendSuccessResponse([
        'matched' => count($matched),
        'orders' => $matched,
        'synced' => $syncStats,
        'unmatched' => $sync->unmatchedRecent(),
    ]);
} catch (Throwable $e) {
    logMessage('Worklist match error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
