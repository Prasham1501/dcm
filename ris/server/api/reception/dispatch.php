<?php
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $db = getDbConnection();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $visitId = (int)($input['visit_id'] ?? 0);
    if ($visitId <= 0) {
        sendErrorResponse('Missing visit id', 400);
    }
    $mode = trim((string)($input['dispatch_mode'] ?? 'patient_pickup'));
    $destination = trim((string)($input['delivery_destination'] ?? 'patient'));
    if (!in_array($destination, ['center', 'home', 'patient', 'other'], true)) {
        $destination = 'patient';
    }
    $note = trim((string)($input['dispatch_note'] ?? 'Report given'));
    $stamp = date('Y-m-d H:i:s');
    $note = $note . " ({$stamp})";

    $columns = [
        'dispatch_mode' => "ALTER TABLE ris_visits ADD COLUMN dispatch_mode VARCHAR(80) DEFAULT NULL",
        'dispatch_note' => "ALTER TABLE ris_visits ADD COLUMN dispatch_note TEXT DEFAULT NULL",
        'delivery_destination' => "ALTER TABLE ris_visits ADD COLUMN delivery_destination ENUM('center','home','patient','other') NOT NULL DEFAULT 'patient'",
    ];
    foreach ($columns as $column => $sql) {
        $safe = $db->real_escape_string($column);
        $res = $db->query("SHOW COLUMNS FROM ris_visits LIKE '{$safe}'");
        if (!$res || $res->num_rows === 0) {
            $db->query($sql);
        }
    }

    $stmt = $db->prepare(
        "UPDATE ris_visits
         SET dispatch_mode = ?, delivery_destination = ?,
             dispatch_note = TRIM(CONCAT(COALESCE(dispatch_note, ''), IF(COALESCE(dispatch_note, '') = '', '', '\n'), ?))
         WHERE id = ?"
    );
    $stmt->bind_param('sssi', $mode, $destination, $note, $visitId);
    $stmt->execute();
    $stmt->close();

    // Stamp the report lifecycle so the reception grid indicators light up.
    $noteLc = strtolower($mode . ' ' . $note);
    if (strpos($noteLc, 'email') !== false) {
        $db->query("UPDATE ris_orders SET report_emailed_at = NOW() WHERE visit_id = " . (int)$visitId . " AND report_emailed_at IS NULL");
    }
    if (strpos($noteLc, 'deliver') !== false || strpos($noteLc, 'given') !== false || strpos($noteLc, 'pickup') !== false || strpos($noteLc, 'print') !== false) {
        $db->query("UPDATE ris_orders SET report_printed_at = COALESCE(report_printed_at, NOW()) WHERE visit_id = " . (int)$visitId);
    }

    $res = $db->prepare("SELECT * FROM ris_visits WHERE id = ?");
    $res->bind_param('i', $visitId);
    $res->execute();
    $row = $res->get_result()->fetch_assoc();
    $res->close();
    sendSuccessResponse($row, 'Dispatch updated');
} catch (Throwable $e) {
    logMessage('Reception dispatch API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
