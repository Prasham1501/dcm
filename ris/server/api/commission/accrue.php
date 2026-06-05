<?php
/** Commission — accrue for one order (idempotent). POST { order_id } -> entry|null */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCommissionRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'doctor'])) { sendErrorResponse('Forbidden', 403); }

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = (int) ($input['order_id'] ?? 0);
    if ($orderId <= 0) { sendErrorResponse('order_id is required', 400); }
    $entry = (new RisCommissionRepository(getDbConnection()))->accrueForOrder($orderId);
    sendSuccessResponse($entry);
} catch (Throwable $e) {
    logMessage('Commission accrue error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
