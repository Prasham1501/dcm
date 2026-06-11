<?php
/**
 * Streams a linked analyzer graph/image/PDF asset.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession()) { http_response_code(401); exit('Unauthorized'); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { http_response_code(403); exit('Forbidden'); }

function ris_mime_for(string $path): string {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    return [
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'bmp' => 'image/bmp',
        'webp' => 'image/webp',
        'pdf' => 'application/pdf',
    ][$ext] ?? 'application/octet-stream';
}

try {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(400); exit('id is required'); }
    $db = getDbConnection();
    $stmt = $db->prepare("SELECT source_path, title FROM ris_result_assets WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row || !is_file($row['source_path'])) {
        http_response_code(404);
        exit('Graph file not found');
    }
    $path = $row['source_path'];
    header('Content-Type: ' . ris_mime_for($path));
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . basename($path) . '"');
    readfile($path);
} catch (Throwable $e) {
    logMessage('Analyzer graph file error: ' . $e->getMessage(), 'error', 'ris.log');
    http_response_code(500);
    echo 'Server error';
}
