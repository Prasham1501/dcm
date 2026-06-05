<?php
/**
 * Worklist — (re)generate .wl files for all pending orders.
 * Useful after enabling worklists or recovering a cleared folder.
 * POST { order_id? } -> { generated: N }
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
require_once __DIR__ . '/../../includes/ris/worklist_dir.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) {
    sendErrorResponse('Forbidden', 403);
}

try {
    $db = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = (int)($input['order_id'] ?? 0);
    $wl = new RisWorklistService($db, ris_worklist_dir($db));
    $n = 0;
    if ($orderId > 0) {
        if ($wl->writeForOrder($orderId)) { $n = 1; }
    } else {
        $res = $db->query("SELECT id FROM ris_orders WHERE linked_study_uid IS NULL AND status IN ('scheduled','arrived')");
        while ($res && $row = $res->fetch_assoc()) {
            if ($wl->writeForOrder((int) $row['id'])) { $n++; }
        }
    }
    sendSuccessResponse(['generated' => $n]);
} catch (Throwable $e) {
    logMessage('Worklist generate error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
