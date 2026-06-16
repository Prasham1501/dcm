<?php
/**
 * Stream a visit's prescription attachment to authenticated staff only.
 *   GET ?visit_id=<int>
 * The raw storage path is never exposed; files live outside the API path.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession()) { http_response_code(401); exit('Unauthorized'); }
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) { http_response_code(403); exit('Forbidden'); }

$visitId = (int)($_GET['visit_id'] ?? 0);
if ($visitId <= 0) { http_response_code(400); exit('visit_id required'); }

$db = getDbConnection();
$stmt = $db->prepare('SELECT prescription_path, prescription_name FROM ris_visits WHERE id = ?');
$stmt->bind_param('i', $visitId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
if (!$row || empty($row['prescription_path'])) { http_response_code(404); exit('No prescription'); }

// basename() defends against any stored path trickery — files only ever live in this dir.
$storageDir = __DIR__ . '/../../storage/prescriptions';
$path = $storageDir . '/' . basename((string)$row['prescription_path']);
if (!is_file($path)) { http_response_code(404); exit('File missing'); }

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mimes = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'pdf' => 'application/pdf'];
$mime = $mimes[$ext] ?? 'application/octet-stream';
$name = (string)($row['prescription_name'] ?: ('prescription.' . $ext));

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) . '"');
header('X-Content-Type-Options: nosniff');
readfile($path);
