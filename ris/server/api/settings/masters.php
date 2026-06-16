<?php
/**
 * Master data CRUD for centers, PROs, staff, and generic lookups.
 *   GET    ?entity=centers|pros|staff|lookups [&category=phlebotomy_staff] [&active=1]
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

const RIS_MASTER_ENTITIES = ['centers', 'pros', 'staff', 'lookups'];

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

function ris_staff_role($value): string
{
    $role = strtolower(trim((string)($value ?? 'receptionist')));
    return in_array($role, ['admin', 'doctor', 'receptionist', 'viewer'], true) ? $role : 'receptionist';
}

function ris_ensure_staff_schema(mysqli $db): void
{
    $db->query(
        "CREATE TABLE IF NOT EXISTS ris_staff (
          id INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
          user_id INT(11) UNSIGNED DEFAULT NULL,
          staff_code VARCHAR(32) DEFAULT NULL,
          full_name VARCHAR(160) NOT NULL,
          designation VARCHAR(120) DEFAULT NULL,
          department VARCHAR(120) DEFAULT NULL,
          phone VARCHAR(30) DEFAULT NULL,
          email VARCHAR(160) DEFAULT NULL,
          address VARCHAR(255) DEFAULT NULL,
          username VARCHAR(80) DEFAULT NULL,
          user_role VARCHAR(40) NOT NULL DEFAULT 'receptionist',
          can_login TINYINT(1) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_ris_staff_code (staff_code),
          UNIQUE KEY uq_ris_staff_user (user_id),
          KEY idx_ris_staff_active (is_active),
          KEY idx_ris_staff_name (full_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ris_save_staff_user(mysqli $db, array $input, int $existingUserId = 0): ?int
{
    $canLogin = !empty($input['can_login']) ? 1 : 0;
    if (!$canLogin) {
        if ($existingUserId > 0) {
            $inactive = $db->prepare('UPDATE users SET is_active = 0 WHERE id = ?');
            $inactive->bind_param('i', $existingUserId);
            $inactive->execute();
            $inactive->close();
        }
        return $existingUserId > 0 ? $existingUserId : null;
    }

    $username = trim((string)($input['username'] ?? ''));
    $password = (string)($input['password'] ?? '');
    $name = trim((string)($input['full_name'] ?? ''));
    $email = ris_master_str($input['email'] ?? null);
    $role = ris_staff_role($input['user_role'] ?? null);
    if ($username === '') { sendErrorResponse('Login username is required when staff login is enabled', 400); }
    if ($existingUserId <= 0 && $password === '') { sendErrorResponse('Password is required for a new staff login', 400); }

    if ($existingUserId > 0) {
        if ($password !== '') {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $db->prepare('UPDATE users SET username=?, password_hash=?, full_name=?, email=?, role=?, is_active=1 WHERE id=?');
            $stmt->bind_param('sssssi', $username, $hash, $name, $email, $role, $existingUserId);
        } else {
            $stmt = $db->prepare('UPDATE users SET username=?, full_name=?, email=?, role=?, is_active=1 WHERE id=?');
            $stmt->bind_param('ssssi', $username, $name, $email, $role, $existingUserId);
        }
        $stmt->execute();
        $stmt->close();
        return $existingUserId;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (username, password_hash, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, 1)');
    $stmt->bind_param('sssss', $username, $hash, $name, $email, $role);
    $stmt->execute();
    $userId = (int)$stmt->insert_id;
    $stmt->close();
    return $userId;
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
        } elseif ($entity === 'pros') {
            $stmt = $db->prepare('UPDATE ris_pros SET is_active = 0 WHERE id = ?');
        } else {
            ris_ensure_staff_schema($db);
            $userId = 0;
            $find = $db->prepare('SELECT user_id FROM ris_staff WHERE id = ?');
            $find->bind_param('i', $id);
            $find->execute();
            $row = $find->get_result()->fetch_assoc();
            $find->close();
            $userId = (int)($row['user_id'] ?? 0);
            $stmt = $db->prepare('UPDATE ris_staff SET is_active = 0 WHERE id = ?');
            if ($userId > 0) {
                $usr = $db->prepare('UPDATE users SET is_active = 0 WHERE id = ?');
                $usr->bind_param('i', $userId);
                $usr->execute();
                $usr->close();
            }
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

        if ($entity === 'staff') {
            ris_ensure_staff_schema($db);
            $name = trim((string)($input['full_name'] ?? $input['name'] ?? ''));
            if ($name === '') { sendErrorResponse('Staff name is required', 400); }
            $code = strtoupper(trim((string)($input['staff_code'] ?? '')));
            if ($code === '') { $code = 'STF' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'USER', 0, 4)) . rand(10, 99); }
            $designation = ris_master_str($input['designation'] ?? null);
            $department = ris_master_str($input['department'] ?? null);
            $phone = ris_master_str($input['phone'] ?? null);
            $email = ris_master_str($input['email'] ?? null);
            $address = ris_master_str($input['address'] ?? null);
            $username = ris_master_str($input['username'] ?? null);
            $role = ris_staff_role($input['user_role'] ?? null);
            $canLogin = !empty($input['can_login']) ? 1 : 0;
            $active = isset($input['is_active']) ? (!empty($input['is_active']) ? 1 : 0) : 1;
            $existingUserId = 0;
            if ($id > 0) {
                $find = $db->prepare('SELECT user_id FROM ris_staff WHERE id = ?');
                $find->bind_param('i', $id);
                $find->execute();
                $existingUserId = (int)(($find->get_result()->fetch_assoc())['user_id'] ?? 0);
                $find->close();
            }
            $userId = ris_save_staff_user($db, $input + ['full_name' => $name, 'user_role' => $role], $existingUserId);
            if ($id > 0) {
                $stmt = $db->prepare('UPDATE ris_staff SET user_id=?, staff_code=?, full_name=?, designation=?, department=?, phone=?, email=?, address=?, username=?, user_role=?, can_login=?, is_active=? WHERE id=?');
                $stmt->bind_param('isssssssssiii', $userId, $code, $name, $designation, $department, $phone, $email, $address, $username, $role, $canLogin, $active, $id);
            } else {
                $stmt = $db->prepare('INSERT INTO ris_staff (user_id, staff_code, full_name, designation, department, phone, email, address, username, user_role, can_login, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
                $stmt->bind_param('isssssssssii', $userId, $code, $name, $designation, $department, $phone, $email, $address, $username, $role, $canLogin, $active);
            }
            $stmt->execute();
            $newId = $id > 0 ? $id : $stmt->insert_id;
            $stmt->close();
            $legacy = $db->prepare("INSERT INTO ris_lookups (category, value, sort_order, is_active) VALUES ('phlebotomy_staff', ?, 0, 1) ON DUPLICATE KEY UPDATE is_active = 1");
            $legacy->bind_param('s', $name);
            $legacy->execute();
            $legacy->close();
            $res = $db->prepare('SELECT s.*, s.full_name AS value, COALESCE(u.is_active, 0) AS login_active FROM ris_staff s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = ?');
            $res->bind_param('i', $newId);
            $res->execute();
            $row = $res->get_result()->fetch_assoc();
            $res->close();
            sendSuccessResponse($row, 'Staff saved');
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
    } elseif ($entity === 'staff') {
        ris_ensure_staff_schema($db);
        $sql = "SELECT s.*, s.full_name AS value, COALESCE(u.is_active, 0) AS login_active
                FROM ris_staff s LEFT JOIN users u ON u.id = s.user_id"
            . ($activeOnly ? ' WHERE s.is_active = 1' : '')
            . ' ORDER BY s.full_name';
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
