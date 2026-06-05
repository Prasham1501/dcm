<?php
/** Set an order's target console AE/room before regenerating MWL. */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $orderId = (int)($input['order_id'] ?? 0);
    $nodeId = (int)($input['node_id'] ?? 0);
    if ($orderId <= 0 || $nodeId <= 0) { sendErrorResponse('order_id and node_id are required', 400); }

    $db = getDbConnection();
    $nodeStmt = $db->prepare('SELECT name, ae_title FROM dicom_nodes WHERE id = ?');
    $nodeStmt->bind_param('i', $nodeId);
    $nodeStmt->execute();
    $node = $nodeStmt->get_result()->fetch_assoc();
    $nodeStmt->close();
    if (!$node) { sendErrorResponse('Destination node not found', 404); }

    $col = $db->query("SHOW COLUMNS FROM ris_orders LIKE 'room_title'");
    if (!$col || $col->num_rows === 0) {
        $db->query("ALTER TABLE ris_orders ADD COLUMN room_title VARCHAR(120) DEFAULT NULL AFTER scheduled_station_ae");
    }
    $ae = (string)$node['ae_title'];
    $room = (string)$node['name'];
    $stmt = $db->prepare('UPDATE ris_orders SET scheduled_station_ae = ?, room_title = ? WHERE id = ?');
    $stmt->bind_param('ssi', $ae, $room, $orderId);
    $stmt->execute();
    $stmt->close();

    $rowStmt = $db->prepare('SELECT * FROM ris_orders WHERE id = ?');
    $rowStmt->bind_param('i', $orderId);
    $rowStmt->execute();
    $order = $rowStmt->get_result()->fetch_assoc();
    $rowStmt->close();
    sendSuccessResponse($order, 'Destination updated');
} catch (Throwable $e) {
    logMessage('RIS update destination error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
