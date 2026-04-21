<?php
/**
 * API to send DICOM study/instances to a remote node via Orthanc
 * 
 * 1. Fetches node details from dicom_nodes table
 * 2. Registers/Updates the node in Orthanc's configuration (PUT /modalities/...)
 * 3. Triggers the C-STORE operation (POST /modalities/.../store)
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/config.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$nodeId = $input['node_id'] ?? null;
$studyId = $input['study_id'] ?? null; // Orthanc Study ID (UUID)
// OR
$resources = $input['resources'] ?? []; // Array of Orthanc IDs (Studies, Series, or Instances)

if (!$nodeId || (!$studyId && empty($resources))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required parameters (node_id and study_id/resources)']);
    exit;
}

if ($studyId && empty($resources)) {
    $resources = [$studyId];
}

try {
    $db = getDbConnection();

    // 1. Get Node Details
    $stmt = $db->prepare("SELECT * FROM dicom_nodes WHERE id = ?");
    $stmt->bind_param("i", $nodeId);
    $stmt->execute();
    $result = $stmt->get_result();
    $node = $result->fetch_assoc();

    if (!$node) {
        throw new Exception("Target node not found");
    }

    // 2. Register/Update Modality in Orthanc
    // We use the node's name (sanitized) as the modality alias in Orthanc
    $modalityAlias = preg_replace('/[^a-zA-Z0-9_-]/', '_', $node['name']);
    
    // Orthanc expects: [ "AET", "HOST", PORT ] or { ... }
    // We'll use the JSON object format for better compatibility with newer Orthanc versions, 
    // or the array format matching typical Orthanc config.
    // Let's use the array format: ["AET", "IP", PORT] which is widely supported.
    $modalityConfig = [
        $node['ae_title'],
        $node['host_name'],
        (int)$node['port']
    ];

    // ORTHANC REST API: PUT /modalities/{id}
    $ch = curl_init(ORTHANC_URL . '/modalities/' . $modalityAlias);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($modalityConfig));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Failed to register node with Orthanc (HTTP $httpCode): " . $response);
    }

    // 3. Trigger C-STORE
    // POST /modalities/{id}/store
    // Body: UUID (string) or [ UUIDs ]
    
    $storeUrl = ORTHANC_URL . '/modalities/' . $modalityAlias . '/store';
    
    // If sending multiple resources, Orthanc expects them in the body
    // Some versions accept a single string for one, or list for multiple.
    // We'll send the list of resources.
    
    $ch = curl_init($storeUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($resources)); // Send array of IDs
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    curl_setopt($ch, CURLOPT_TIMEOUT, 0); // Disable timeout for large transfers
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        // Parse error from Orthanc if possible
        $json = json_decode($response, true);
        $errMsg = $json['Message'] ?? $json['Description'] ?? $response;
        throw new Exception("Failed to send DICOM data (HTTP $httpCode): " . $errMsg);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'DICOM transfer initiated successfully',
        'details' => json_decode($response, true),
        'node' => $modalityAlias
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => $e->getMessage()
    ]);
}
