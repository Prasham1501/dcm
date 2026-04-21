<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Configure Google Drive Backup Settings
 *
 * POST /api/backup/configure-gdrive.php
 *
 * Request Body:
 * {
 *   "client_id": "string",
 *   "client_secret": "string",
 *   "folder_name": "string",
 *   "backup_enabled": boolean,
 *   "backup_schedule": "daily|weekly|monthly",
 *   "backup_time": "HH:MM",
 *   "retention_days": integer,
 *   "backup_database": boolean,
 *   "backup_php_files": boolean,
 *   "backup_js_files": boolean,
 *   "backup_config_files": boolean
 * }
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

// Check if user is authenticated and is admin
if (!isLoggedIn() || !isAdmin()) {
    sendErrorResponse('Unauthorized access', 403);
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input');
    }

    // Get database connection
    $db = getDbConnection();

    // Prepare update query
    $updates = [];
    $params = [];
    $types = '';

    // Map input fields to database columns
    $fieldMap = [
        'client_id' => 's',
        'client_secret' => 's',
        'folder_name' => 's',
        'backup_enabled' => 'i',
        'backup_schedule' => 's',
        'backup_time' => 's',
        'retention_days' => 'i',
        'backup_database' => 'i',
        'backup_php_files' => 'i',
        'backup_js_files' => 'i',
        'backup_config_files' => 'i'
    ];

    foreach ($fieldMap as $field => $type) {
        if (array_key_exists($field, $input)) {
            $updates[] = "`{$field}` = ?";
            $types .= $type;

            // Convert boolean to integer for database
            if ($type === 'i' && is_bool($input[$field])) {
                $params[] = $input[$field] ? 1 : 0;
            } else {
                $params[] = $input[$field];
            }
        }
    }

    if (empty($updates)) {
        sendErrorResponse('No valid fields to update');
    }

    // Build and execute query
    $sql = "UPDATE gdrive_backup_config SET " . implode(', ', $updates) . " WHERE id = 1";
    $stmt = $db->prepare($sql);

    if (!$stmt) {
        throw new Exception("Failed to prepare statement: " . $db->error);
    }

    // Bind parameters dynamically
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    if (!$stmt->execute()) {
        throw new Exception("Failed to update configuration: " . $stmt->error);
    }

    $stmt->close();

    // Log the configuration change
    logMessage(
        "Google Drive backup configuration updated by user ID: " . $_SESSION['user_id'],
        'info',
        'backup.log'
    );

    // Audit log
    $auditStmt = $db->prepare("
        INSERT INTO audit_logs (user_id, username, action, resource_type, details, ip_address, user_agent)
        VALUES (?, ?, 'configure_gdrive_backup', 'backup_config', ?, ?, ?)
    ");

    $details = json_encode([
        'updated_fields' => array_keys($input),
        'backup_enabled' => $input['backup_enabled'] ?? null
    ]);
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

    $auditStmt->bind_param(
        'issss',
        $_SESSION['user_id'],
        $_SESSION['username'],
        $details,
        $ipAddress,
        $userAgent
    );
    $auditStmt->execute();
    $auditStmt->close();

    sendSuccessResponse([
        'updated_fields' => count($params)
    ], 'Google Drive backup configuration updated successfully');

} catch (Exception $e) {
    logMessage("Configure Google Drive error: " . $e->getMessage(), 'error', 'backup.log');
    sendErrorResponse('Failed to update configuration: ' . $e->getMessage(), 500);
}
