<?php
/**
 * PCPNDT config — the clinic's standing details that auto-fill every Form F:
 * clinic name/reg/address, the sonologist (performing doctor) details, default
 * basis of diagnosis, the state, and the (encrypted) government-portal login.
 *
 *   GET  -> { settings:{...}, portal:{ state_code, username, has_password } }
 *   POST { ...settings, portal_username?, portal_password? } -> saves, returns same
 *
 * Admin-only (it's clinic configuration).
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
if (function_exists('hasRole') && !hasRole(['admin', 'super_admin', 'receptionist'])) {
    sendErrorResponse('Forbidden', 403);
}

// setting_key => default
const PCPNDT_KEYS = [
    'pcpndt_clinic_name'                  => '',
    'pcpndt_registration_no'              => '',
    'pcpndt_clinic_address'               => '',
    'pcpndt_performing_doctor'            => '',
    'pcpndt_performing_doctor_qualification' => '',
    'pcpndt_performing_doctor_reg_no'     => '',
    'pcpndt_default_basis'                => '',
    'pcpndt_default_referring_doctor'     => '',
    'clinic_state'                        => 'maharashtra',
];

function pcpndtGetSetting(mysqli $db, string $key, string $default = ''): string {
    $stmt = $db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = ?");
    $stmt->bind_param('s', $key); $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
    return ($row && $row['setting_value'] !== null) ? $row['setting_value'] : $default;
}
function pcpndtPutSetting(mysqli $db, string $key, string $val): void {
    $stmt = $db->prepare(
        "INSERT INTO hospital_settings (setting_key, setting_value, setting_group)
         VALUES (?, ?, 'pcpndt') ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
    );
    $stmt->bind_param('ss', $key, $val); $stmt->execute(); $stmt->close();
}

try {
    $db = getDbConnection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = getCurrentUser();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        foreach (PCPNDT_KEYS as $key => $_def) {
            if (array_key_exists($key, $input)) {
                pcpndtPutSetting($db, $key, (string) $input[$key]);
            }
        }
        // Portal credentials (encrypted). Password only updated when supplied.
        $state = (string) ($input['clinic_state'] ?? pcpndtGetSetting($db, 'clinic_state', 'maharashtra'));
        if (array_key_exists('portal_username', $input) || array_key_exists('portal_password', $input)) {
            $username = (string) ($input['portal_username'] ?? '');
            $enc = isset($input['portal_password']) && $input['portal_password'] !== ''
                ? RisCrypto::encrypt((string) $input['portal_password']) : null;
            $stmt = $db->prepare(
                "INSERT INTO pcpndt_portal_credentials (state_code, username, password_enc) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE username = VALUES(username),
                    password_enc = COALESCE(VALUES(password_enc), password_enc)"
            );
            $stmt->bind_param('sss', $state, $username, $enc);
            $stmt->execute(); $stmt->close();
        }
        if (function_exists('logAuditEvent')) {
            logAuditEvent($user['id'], 'save', 'pcpndt_config', null, 'Updated PCPNDT clinic/doctor config');
        }
    }

    // Build response (GET, or echo back after POST)
    $settings = [];
    foreach (PCPNDT_KEYS as $key => $def) {
        $settings[$key] = pcpndtGetSetting($db, $key, $def);
    }
    $state = $settings['clinic_state'] ?: 'maharashtra';
    $stmt = $db->prepare("SELECT username, password_enc FROM pcpndt_portal_credentials WHERE state_code = ?");
    $stmt->bind_param('s', $state); $stmt->execute();
    $prow = $stmt->get_result()->fetch_assoc(); $stmt->close();

    sendSuccessResponse([
        'settings' => $settings,
        'portal' => [
            'state_code' => $state,
            'username' => $prow['username'] ?? '',
            'has_password' => !empty($prow['password_enc'] ?? ''),
        ],
    ]);
} catch (Throwable $e) {
    logMessage('PCPNDT config error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
