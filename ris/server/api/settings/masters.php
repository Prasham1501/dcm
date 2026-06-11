<?php
/**
 * Master data CRUD for centers, PROs, and generic lookups (staff, areas, groups, etc.).
 *   GET    ?entity=centers|pros|lookups [&category=phlebotomy_staff] [&active=1]
 *   POST   { entity, ...fields }                 -> create or update (when id present)
 *   DELETE ?entity=...&id=<id>                    -> deactivate (soft) / delete lookup
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
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

const RIS_MASTER_ENTITIES = ['centers', 'pros', 'lookups'];

function ris_master_entity(): string
{
    $input = $_SERVER['REQUEST_METHOD'] === 'POST'
        ? (json_decode(file_get_contents('php://input'), true) ?: [])
        : [];
    $entity = strtolower(trim((string)($_GET['entity'] ?? $input['entity'] ?? '')));
    if (!in_array($entity, RIS_MASTER_ENTITIES, true)) {
        sendErrorResponse('Unknown master entity', 400);
    }
    return $entity;
}

function ris_master_str($value): ?string
{
    $s = trim((string)($value ?? ''));
    return $s === '' ? null : $s;
}

try {
    $db = getDbConnection();
    $entity = ris_master_entity();
    $method = $_SERVER['REQUEST_METHOD'];

    // ---------- DELETE ----------
    if ($method === 'DELETE') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) { sendErrorResponse('id is required', 400); }
        if ($entity === 'lookups') {
            $stmt = $db->prepare('DELETE FROM ris_lookups WHERE id = ?');
        } elseif ($entity === 'centers') {
            $stmt = $db->prepare('UPDATE ris_centers SET is_active = 0 WHERE id = ?');
        } else {
            $stmt = $db->prepare('UPDATE ris_pros SET is_active = 0 WHERE id = ?');
        }
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
        sendSuccessResponse(['id' => $id], 'Removed');
    }

    // ---------- POST (create/update) ----------
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = (int)($input['id'] ?? 0);

        if ($entity === 'centers') {
            $code = strtoupper(trim((string)($input['code'] ?? '')));
            $name = trim((string)($input['name'] ?? ''));
            if ($name === '') { sendErrorResponse('Center name is required', 400); }
            if ($code === '') { $code = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'CTR', 0, 8)) . rand(10, 99); }
            $billing = (string)($input['billing_type'] ?? 'debit');
            if (!in_array($billing, ['credit', 'debit'], true)) { $billing = 'debit'; }
            $contact = ris_master_str($input['contact_person'] ?? null);
            $phone = ris_master_str($input['phone'] ?? null);
            $email = ris_master_str($input['email'] ?? null);
            $address = ris_master_str($input['address'] ?? null);
            $discount = max(0, (float)($input['discount_percent'] ?? 0));
            $active = isset($input['is_active']) ? (!empty($input['is_active']) ? 1 : 0) : 1;
            if ($id > 0) {
                $stmt = $db->prepare('UPDATE ris_centers SET code=?, name=?, billing_type=?, contact_person=?, phone=?, email=?, address=?, discount_percent=?, is_active=? WHERE id=?');
                $stmt->bind_param('sssssssdii', $code, $name, $billing, $contact, $phone, $email, $address, $discount, $active, $id);
            } else {
                $stmt = $db->prepare('INSERT INTO ris_centers (code, name, billing_type, contact_person, phone, email, address, discount_percent, is_active) VALUES (?,?,?,?,?,?,?,?,?)');
                $stmt->bind_param('sssssssdi', $code, $name, $billing, $contact, $phone, $email, $address, $discount, $active);
            }
            $stmt->execute();
            $newId = $id > 0 ? $id : $stmt->insert_id;
            $stmt->close();
            $res = $db->prepare('SELECT * FROM ris_centers WHERE id = ?');
            $res->bind_param('i', $newId);
            $res->execute();
            $row = $res->get_result()->fetch_assoc();
            $res->close();
            sendSuccessResponse($row, 'Center saved');
        }

        if ($entity === 'pros') {
            $name = trim((string)($input['name'] ?? ''));
            if ($name === '') { sendErrorResponse('PRO name is required', 400); }
            $phone = ris_master_str($input['phone'] ?? null);
            $ctype = (string)($input['commission_type'] ?? 'none');
            if (!in_array($ctype, ['none', 'percent', 'flat'], true)) { $ctype = 'none'; }
            $cval = max(0, (float)($input['commission_value'] ?? 0));
            $active = isset($input['is_active']) ? (!empty($input['is_active']) ? 1 : 0) : 1;
            if ($id > 0) {
                $stmt = $db->prepare('UPDATE ris_pros SET name=?, phone=?, commission_type=?, commission_value=?, is_active=? WHERE id=?');
                $stmt->bind_param('sssdii', $name, $phone, $ctype, $cval, $active, $id);
            } else {
                $stmt = $db->prepare('INSERT INTO ris_pros (name, phone, commission_type, commission_value, is_active) VALUES (?,?,?,?,?)');
                $stmt->bind_param('sssdi', $name, $phone, $ctype, $cval, $active);
            }
            $stmt->execute();
            $newId = $id > 0 ? $id : $stmt->insert_id;
            $stmt->close();
            $res = $db->prepare('SELECT * FROM ris_pros WHERE id = ?');
            $res->bind_param('i', $newId);
            $res->execute();
            $row = $res->get_result()->fetch_assoc();
            $res->close();
            sendSuccessResponse($row, 'PRO saved');
        }

        // lookups
        $category = trim((string)($input['category'] ?? ''));
        $value = trim((string)($input['value'] ?? ''));
        if ($category === '' || $value === '') { sendErrorResponse('category and value are required', 400); }
        $sort = (int)($input['sort_order'] ?? 0);
        $stmt = $db->prepare('INSERT INTO ris_lookups (category, value, sort_order) VALUES (?,?,?) ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = 1');
        $stmt->bind_param('ssi', $category, $value, $sort);
        $stmt->execute();
        $stmt->close();
        sendSuccessResponse(['category' => $category, 'value' => $value], 'Lookup saved');
    }

    // ---------- GET ----------
    $activeOnly = ($_GET['active'] ?? '') === '1';
    if ($entity === 'centers') {
        $sql = 'SELECT * FROM ris_centers' . ($activeOnly ? ' WHERE is_active = 1' : '') . ' ORDER BY name';
        $res = $db->query($sql);
    } elseif ($entity === 'pros') {
        $sql = 'SELECT * FROM ris_pros' . ($activeOnly ? ' WHERE is_active = 1' : '') . ' ORDER BY name';
        $res = $db->query($sql);
    } else {
        $category = trim((string)($_GET['category'] ?? ''));
        if ($category !== '') {
            $stmt = $db->prepare('SELECT * FROM ris_lookups WHERE category = ? AND is_active = 1 ORDER BY sort_order, value');
            $stmt->bind_param('s', $category);
            $stmt->execute();
            $res = $stmt->get_result();
        } else {
            $res = $db->query('SELECT * FROM ris_lookups WHERE is_active = 1 ORDER BY category, sort_order, value');
        }
    }
    $rows = [];
    while ($row = $res->fetch_assoc()) { $rows[] = $row; }
    sendSuccessResponse($rows);
} catch (Throwable $e) {
    logMessage('RIS masters API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
