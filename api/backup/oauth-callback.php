<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: OAuth2 Callback Handler
 *
 * GET /api/backup/oauth-callback.php?code=AUTHORIZATION_CODE
 *
 * Handles OAuth2 redirect from Google
 * Saves refresh token to database
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Check if user is authenticated and is admin
if (!isLoggedIn() || !isAdmin()) {
    header('Location: /auth/login.html?error=unauthorized');
    exit;
}

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Location: /admin/backup-settings.html?error=invalid_request');
    exit;
}

try {
    // Check for authorization code
    if (!isset($_GET['code'])) {
        throw new Exception('Authorization code not received');
    }

    $authCode = $_GET['code'];

    // Get database connection
    $db = getDbConnection();

    // Load Google Drive Backup class
    require_once __DIR__ . '/../../includes/classes/GoogleDriveBackup.php';

    // Initialize backup service
    $backupService = new \DicomViewer\GoogleDriveBackup($db);

    // Authenticate with authorization code
    $result = $backupService->authenticate($authCode);

    if ($result['success']) {
        logMessage(
            "Google Drive OAuth authentication successful for user ID: " . $_SESSION['user_id'],
            'info',
            'backup.log'
        );

        // Audit log
        $auditStmt = $db->prepare("
            INSERT INTO audit_logs (user_id, username, action, resource_type, details, ip_address, user_agent)
            VALUES (?, ?, 'oauth_authenticate', 'backup_config', ?, ?, ?)
        ");

        $details = json_encode([
            'service' => 'google_drive',
            'status' => 'success'
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

        // Redirect to backup settings page with success message
        header('Location: /admin/backup-settings.html?success=authenticated');
    } else {
        throw new Exception('Authentication failed');
    }

} catch (Exception $e) {
    logMessage("OAuth callback error: " . $e->getMessage(), 'error', 'backup.log');

    // Redirect to backup settings page with error message
    $errorMsg = urlencode($e->getMessage());
    header("Location: /admin/backup-settings.html?error={$errorMsg}");
}
exit;
