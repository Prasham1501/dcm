<?php
/**
 * Upload a prescription attachment (image/PDF) for a reception visit.
 *   POST multipart/form-data: visit_id=<int>, prescription=<file>
 * Files are stored OUTSIDE the API path (ris/server/storage/prescriptions, with a
 * deny-all .htaccess) and served only via download-prescription.php (auth-checked).
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    // Self-heal the schema so this works even before the migration is applied.
    $db->query("ALTER TABLE ris_visits ADD COLUMN IF NOT EXISTS prescription_path VARCHAR(255) DEFAULT NULL");
    $db->query("ALTER TABLE ris_visits ADD COLUMN IF NOT EXISTS prescription_name VARCHAR(255) DEFAULT NULL");

    $visitId = (int)($_POST['visit_id'] ?? 0);
    if ($visitId <= 0) { sendErrorResponse('visit_id is required', 400); }

    $check = $db->prepare('SELECT id FROM ris_visits WHERE id = ?');
    $check->bind_param('i', $visitId);
    $check->execute();
    $exists = $check->get_result()->fetch_assoc();
    $check->close();
    if (!$exists) { sendErrorResponse('Visit not found', 404); }

    if (!isset($_FILES['prescription']) || $_FILES['prescription']['error'] !== UPLOAD_ERR_OK) {
        sendErrorResponse('No file uploaded', 400);
    }
    $file = $_FILES['prescription'];
    if ((int)$file['size'] > 10 * 1024 * 1024) { sendErrorResponse('File too large (max 10 MB)', 400); }

    $allowed = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
    $origName = (string)($file['name'] ?? 'prescription');
    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    if (!isset($allowed[$ext])) { sendErrorResponse('Only JPG, PNG, WEBP, or PDF files are allowed', 400); }

    // Verify the real content type, not just the extension.
    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : null;
    $realMime = $finfo ? finfo_file($finfo, $file['tmp_name']) : $allowed[$ext];
    if ($finfo) { finfo_close($finfo); }
    if (!in_array($realMime, array_values($allowed), true)) {
        sendErrorResponse('File content does not match an allowed type', 400);
    }

    $storageDir = __DIR__ . '/../../storage/prescriptions';
    if (!is_dir($storageDir)) { @mkdir($storageDir, 0775, true); }
    $htaccess = $storageDir . '/.htaccess';
    if (!is_file($htaccess)) { @file_put_contents($htaccess, "Require all denied\nDeny from all\n"); }

    $stored = $visitId . '_' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], $storageDir . '/' . $stored)) {
        sendErrorResponse('Could not store file', 500);
    }

    $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $origName);
    $upd = $db->prepare('UPDATE ris_visits SET prescription_path = ?, prescription_name = ? WHERE id = ?');
    $upd->bind_param('ssi', $stored, $safeName, $visitId);
    $upd->execute();
    $upd->close();

    sendSuccessResponse(['visit_id' => $visitId, 'prescription_name' => $safeName]);
} catch (Throwable $e) {
    logMessage('Prescription upload error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
