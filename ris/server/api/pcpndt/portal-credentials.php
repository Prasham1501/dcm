<?php
/**
 * PCPNDT — per-state portal credentials (encrypted at rest, password never returned).
 *   GET  ?state=maharashtra        -> { state_code, username, has_password }
 *   POST { state_code, username, password } -> store (password encrypted)
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCrypto.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (function_exists('hasRole') && !hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $state = $_GET['state'] ?? 'maharashtra';
        $stmt = $db->prepare("SELECT state_code, username, password_enc FROM pcpndt_portal_credentials WHERE state_code = ?");
        $stmt->bind_param('s', $state); $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
        sendSuccessResponse($row
            ? ['state_code' => $row['state_code'], 'username' => $row['username'], 'has_password' => !empty($row['password_enc'])]
            : ['state_code' => $state, 'username' => '', 'has_password' => false]);
    }

    $user = getCurrentUser();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $state = trim((string) ($input['state_code'] ?? ''));
    if ($state === '') { sendErrorResponse('state_code is required', 400); }
    $username = (string) ($input['username'] ?? '');
    $enc = isset($input['password']) && $input['password'] !== '' ? RisCrypto::encrypt((string) $input['password']) : null;

    $stmt = $db->prepare(
        "INSERT INTO pcpndt_portal_credentials (state_code, username, password_enc) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE username = VALUES(username), password_enc = COALESCE(VALUES(password_enc), password_enc)"
    );
    $stmt->bind_param('sss', $state, $username, $enc);
    $stmt->execute(); $stmt->close();
    if (function_exists('logAuditEvent')) {
        logAuditEvent($user['id'], 'save', 'pcpndt_portal_credentials', $state, 'Updated portal credentials');
    }
    sendSuccessResponse(['state_code' => $state, 'username' => $username, 'has_password' => $enc !== null]);
} catch (Throwable $e) {
    logMessage('PCPNDT portal-credentials error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
