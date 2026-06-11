<?php
/**
 * Test parameter master: the analytes/rows under a test, with reference ranges.
 *   GET    ?service_id=<id>            -> parameters (each with `ranges`)
 *   POST   { service_id, name, ... , ranges:[...] }  -> create/update (id present = update)
 *   DELETE ?id=<id>                    -> delete a parameter (cascades ranges/results)
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
ini_set('display_errors', '0');
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { sendErrorResponse('Forbidden', 403); }

function rp_str($v): ?string { $s = trim((string)($v ?? '')); return $s === '' ? null : $s; }
function rp_num($v) { return ($v === '' || $v === null) ? null : (float)$v; }

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) { sendErrorResponse('id is required', 400); }
        $stmt = $db->prepare('DELETE FROM ris_test_parameters WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        sendSuccessResponse(['id' => $id], 'Parameter deleted');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($input['id'] ?? 0);
        $serviceId = (int)($input['service_id'] ?? 0);
        $name = trim((string)($input['name'] ?? ''));
        if ($serviceId <= 0 || $name === '') { sendErrorResponse('service_id and name are required', 400); }
        $unit = rp_str($input['unit'] ?? null);
        $inputType = (string)($input['input_type'] ?? 'numeric');
        if (!in_array($inputType, ['numeric', 'text', 'select'], true)) { $inputType = 'numeric'; }
        $options = rp_str($input['options'] ?? null);
        $decimals = (int)($input['decimals'] ?? 2);
        $formula = rp_str($input['formula'] ?? null);
        $defaultValue = rp_str($input['default_value'] ?? null);
        $sortOrder = (int)($input['sort_order'] ?? 0);
        $isHeading = !empty($input['is_heading']) ? 1 : 0;

        if ($id > 0) {
            $stmt = $db->prepare('UPDATE ris_test_parameters SET service_id=?, name=?, unit=?, input_type=?, options=?, decimals=?, formula=?, default_value=?, sort_order=?, is_heading=? WHERE id=?');
            $stmt->bind_param('issssisssii', $serviceId, $name, $unit, $inputType, $options, $decimals, $formula, $defaultValue, $sortOrder, $isHeading, $id);
        } else {
            $stmt = $db->prepare('INSERT INTO ris_test_parameters (service_id, name, unit, input_type, options, decimals, formula, default_value, sort_order, is_heading) VALUES (?,?,?,?,?,?,?,?,?,?)');
            $stmt->bind_param('issssissii', $serviceId, $name, $unit, $inputType, $options, $decimals, $formula, $defaultValue, $sortOrder, $isHeading);
        }
        $stmt->execute();
        $paramId = $id > 0 ? $id : $stmt->insert_id;
        $stmt->close();

        // Replace ranges if provided.
        if (isset($input['ranges']) && is_array($input['ranges'])) {
            $del = $db->prepare('DELETE FROM ris_test_ref_ranges WHERE parameter_id = ?');
            $del->bind_param('i', $paramId);
            $del->execute();
            $del->close();
            $ins = $db->prepare('INSERT INTO ris_test_ref_ranges (parameter_id, sex, age_min_days, age_max_days, low, high, normal_text) VALUES (?,?,?,?,?,?,?)');
            foreach ($input['ranges'] as $r) {
                $sex = in_array(($r['sex'] ?? 'any'), ['any', 'male', 'female'], true) ? $r['sex'] : 'any';
                $amin = (int)($r['age_min_days'] ?? 0);
                $amax = (int)($r['age_max_days'] ?? 54750);
                $low = rp_num($r['low'] ?? null);
                $high = rp_num($r['high'] ?? null);
                $normal = rp_str($r['normal_text'] ?? null);
                $ins->bind_param('isiidds', $paramId, $sex, $amin, $amax, $low, $high, $normal);
                $ins->execute();
            }
            $ins->close();
        }

        sendSuccessResponse(rp_get_parameter($db, $paramId), 'Parameter saved');
    }

    // GET
    $serviceId = (int)($_GET['service_id'] ?? 0);
    if ($serviceId <= 0) { sendErrorResponse('service_id is required', 400); }
    sendSuccessResponse(rp_list_parameters($db, $serviceId));
} catch (Throwable $e) {
    logMessage('RIS test-parameters API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function rp_list_parameters(mysqli $db, int $serviceId): array
{
    $stmt = $db->prepare('SELECT * FROM ris_test_parameters WHERE service_id = ? AND is_active = 1 ORDER BY sort_order, id');
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $res = $stmt->get_result();
    $params = [];
    while ($row = $res->fetch_assoc()) { $row['ranges'] = []; $params[$row['id']] = $row; }
    $stmt->close();
    if ($params) {
        $ids = implode(',', array_map('intval', array_keys($params)));
        $rres = $db->query("SELECT * FROM ris_test_ref_ranges WHERE parameter_id IN ($ids) ORDER BY id");
        while ($r = $rres->fetch_assoc()) {
            $params[$r['parameter_id']]['ranges'][] = $r;
        }
    }
    return array_values($params);
}

function rp_get_parameter(mysqli $db, int $id): ?array
{
    $stmt = $db->prepare('SELECT * FROM ris_test_parameters WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) { return null; }
    $row['ranges'] = [];
    $rstmt = $db->prepare('SELECT * FROM ris_test_ref_ranges WHERE parameter_id = ? ORDER BY id');
    $rstmt->bind_param('i', $id);
    $rstmt->execute();
    $rres = $rstmt->get_result();
    while ($r = $rres->fetch_assoc()) { $row['ranges'][] = $r; }
    $rstmt->close();
    return $row;
}
