<?php
/**
 * Reception service/test catalogue.
 * GET ?active=1 lists active services for reception.
 * GET ?active=0 lists the full catalogue.
 * POST creates or updates a service row.
 * DELETE ?id= removes a service row from the catalogue.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Service id is required', 400);
        }

        $stmt = $db->prepare('DELETE FROM ris_services WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $deleted = $stmt->affected_rows;
        $stmt->close();

        if ($deleted <= 0) {
            sendErrorResponse('Service not found', 404);
        }

        sendSuccessResponse(['deleted' => $id], 'Service deleted');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($input['id'] ?? 0);
        $code = strtoupper(trim((string)($input['code'] ?? '')));
        $name = trim((string)($input['name'] ?? ''));
        $modality = strtoupper(trim((string)($input['modality'] ?? '')));
        $bodyPart = trim((string)($input['body_part'] ?? ''));
        $price = (float)($input['price'] ?? 0);
        $duration = (int)($input['default_duration_min'] ?? 20);
        $active = !empty($input['is_active']) ? 1 : 0;

        if ($name === '' || $modality === '' || $price < 0) {
            sendErrorResponse('Test name, modality, and valid price are required', 400);
        }
        if ($duration <= 0) { $duration = 20; }
        if ($code === '') {
            $code = preg_replace('/[^A-Z0-9]+/', '-', strtoupper($modality . '-' . $name));
            $code = trim(substr($code, 0, 40), '-');
        }

        if ($id > 0) {
            $stmt = $db->prepare(
                'UPDATE ris_services SET code = ?, name = ?, modality = ?, body_part = ?, price = ?, default_duration_min = ?, is_active = ? WHERE id = ?'
            );
            $stmt->bind_param('ssssdiii', $code, $name, $modality, $bodyPart, $price, $duration, $active, $id);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $db->prepare(
                'INSERT INTO ris_services (code, name, modality, body_part, price, default_duration_min, is_active) VALUES (?,?,?,?,?,?,?)'
            );
            $stmt->bind_param('ssssdii', $code, $name, $modality, $bodyPart, $price, $duration, $active);
            $stmt->execute();
            $id = (int)$stmt->insert_id;
            $stmt->close();
        }

        $stmt = $db->prepare('SELECT id, code, name, modality, body_part, price, default_duration_min, is_active FROM ris_services WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        sendSuccessResponse($row, 'Service saved');
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') { sendErrorResponse('Method not allowed', 405); }

    $onlyActive = ($_GET['active'] ?? '1') !== '0';
    $sql = 'SELECT id, code, name, modality, body_part, price, default_duration_min, is_active
            FROM ris_services' . ($onlyActive ? ' WHERE is_active = 1' : '') . ' ORDER BY name';
    $res = $db->query($sql);
    $out = [];
    while ($res && $row = $res->fetch_assoc()) { $out[] = $row; }
    sendSuccessResponse($out);
} catch (Throwable $e) {
    logMessage('Reception services error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
