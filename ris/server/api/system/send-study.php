<?php
/**
 * RIS DICOM send helper.
 * POST { node_id, study } where study can be an Orthanc Study ID or a DICOM
 * StudyInstanceUID stored in cached_studies. Sends via Orthanc C-STORE.
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
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'doctor'])) { sendErrorResponse('Forbidden', 403); }

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$nodeId = (int)($input['node_id'] ?? 0);
$study = trim((string)($input['study'] ?? ''));

if ($nodeId <= 0) { sendErrorResponse('node_id is required', 400); }
if ($study === '') { sendErrorResponse('study is required', 400); }

try {
    $db = getDbConnection();

    $stmt = $db->prepare("SELECT * FROM dicom_nodes WHERE id = ?");
    $stmt->bind_param('i', $nodeId);
    $stmt->execute();
    $node = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$node) { sendErrorResponse('Target node not found', 404); }

    $orthancId = $study;
    $stmt = $db->prepare("SELECT orthanc_id FROM cached_studies WHERE study_instance_uid = ? OR orthanc_id = ? LIMIT 1");
    $stmt->bind_param('ss', $study, $study);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row && !empty($row['orthanc_id'])) {
        $orthancId = $row['orthanc_id'];
    }

    $alias = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$node['name']);
    if ($alias === '') { $alias = 'RISNode' . $nodeId; }
    $modalityConfig = [$node['ae_title'], $node['host_name'], (int)$node['port']];

    $ch = curl_init(ORTHANC_URL . '/modalities/' . $alias);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($modalityConfig));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) {
        throw new Exception('Failed to register node with Orthanc (HTTP ' . $httpCode . '): ' . $response);
    }

    $ch = curl_init(ORTHANC_URL . '/modalities/' . $alias . '/store');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([$orthancId]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    curl_setopt($ch, CURLOPT_TIMEOUT, 0);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) {
        $json = json_decode((string)$response, true);
        $msg = $json['Message'] ?? $json['Description'] ?? $response;
        throw new Exception('Failed to send DICOM data (HTTP ' . $httpCode . '): ' . $msg);
    }

    logAuditEvent((int)(getCurrentUser()['id'] ?? 0), 'send', 'dicom_study', $orthancId, 'RIS sent study to ' . $alias);
    sendSuccessResponse([
        'message' => 'DICOM transfer initiated successfully',
        'node' => $alias,
        'orthanc_id' => $orthancId,
        'details' => json_decode((string)$response, true),
    ]);
} catch (Throwable $e) {
    logMessage('RIS send-study error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
