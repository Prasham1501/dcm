<?php
/**
 * Worklist — manually correct an order accession number.
 * POST { order_id, accession_number }
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
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = (int)($input['order_id'] ?? 0);
    $accession = strtoupper(trim((string)($input['accession_number'] ?? '')));
    if ($orderId <= 0 || $accession === '') {
        sendErrorResponse('Order and accession number are required', 400);
    }
    if (!preg_match('/^[A-Z0-9_-]{3,32}$/', $accession)) {
        sendErrorResponse('Use only letters, numbers, dash, or underscore', 400);
    }

    $stmt = $db->prepare('SELECT id, linked_study_uid FROM ris_orders WHERE id = ?');
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$order) { sendErrorResponse('Order not found', 404); }

    $stmt = $db->prepare('SELECT id FROM ris_orders WHERE accession_number = ? AND id <> ? LIMIT 1');
    $stmt->bind_param('si', $accession, $orderId);
    $stmt->execute();
    $exists = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($exists) { sendErrorResponse('Accession already exists', 409); }

    $stmt = $db->prepare('UPDATE ris_orders SET accession_number = ? WHERE id = ?');
    $stmt->bind_param('si', $accession, $orderId);
    $stmt->execute();
    $stmt->close();

    if (empty($order['linked_study_uid'])) {
        (new RisWorklistService($db, ris_worklist_dir($db)))->writeForOrder($orderId);
    }

    $stmt = $db->prepare('SELECT * FROM ris_orders WHERE id = ?');
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $updated = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    sendSuccessResponse($updated, 'Accession updated');
} catch (Throwable $e) {
    logMessage('Worklist accession update error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
