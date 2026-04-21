<?php
/**
 * Send Test DICOM Image API
 * 
 * Creates a simple test DICOM image using Orthanc's create-dicom tool
 * and sends it to a specified DICOM node to verify connectivity.
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

if (!$nodeId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing node_id parameter']);
    exit;
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

    // 2. Create a test DICOM image using Orthanc's tools
    $testPatientName = "TEST^Patient^" . date('His');
    $testPatientId = "TEST-" . date('YmdHis');
    $testStudyDesc = "Test Study - Connectivity Check";
    
    // Create DICOM content (minimal valid DICOM)
    $dicomContent = [
        'Tags' => [
            'PatientName' => $testPatientName,
            'PatientID' => $testPatientId,
            'PatientBirthDate' => date('Ymd'),
            'PatientSex' => 'O',
            'StudyDescription' => $testStudyDesc,
            'Modality' => 'OT', // Other
            'SeriesDescription' => 'Test Series',
            'InstanceNumber' => '1'
        ],
        'Content' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2NkYGD4z0AE+A9hMxQ0MAC0IAMyKIqN1QAAAABJRU5ErkJggg=='
    ];

    // Create the DICOM instance in Orthanc
    $ch = curl_init(ORTHANC_URL . '/tools/create-dicom');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($dicomContent));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Failed to create test DICOM: HTTP $httpCode - $response - $error");
    }

    $createResult = json_decode($response, true);
    $instanceId = $createResult['ID'] ?? null;
    
    if (!$instanceId) {
        throw new Exception("Failed to get instance ID from created DICOM");
    }

    // 3. Register/Update the modality in Orthanc
    $modalityAlias = preg_replace('/[^a-zA-Z0-9_-]/', '_', $node['name']);
    $modalityConfig = [
        $node['ae_title'],
        $node['host_name'],
        (int)$node['port']
    ];

    $ch = curl_init(ORTHANC_URL . '/modalities/' . $modalityAlias);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($modalityConfig));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Failed to register node with Orthanc: HTTP $httpCode");
    }

    // 4. Send the test image to the node
    $storeUrl = ORTHANC_URL . '/modalities/' . $modalityAlias . '/store';
    
    $ch = curl_init($storeUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([$instanceId]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        $json = json_decode($response, true);
        $errMsg = $json['Message'] ?? $json['Description'] ?? $response ?? $error;
        throw new Exception("Failed to send test image: HTTP $httpCode - $errMsg");
    }

    // 5. Optionally delete the test instance from Orthanc (cleanup)
    $ch = curl_init(ORTHANC_URL . '/instances/' . $instanceId);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
    curl_exec($ch);
    curl_close($ch);

    // 6. Log the activity
    try {
        $db->query("CREATE TABLE IF NOT EXISTS dicom_activity_log (
            id INT PRIMARY KEY AUTO_INCREMENT,
            event_type VARCHAR(50) NOT NULL,
            source_ip VARCHAR(50),
            source_aet VARCHAR(64),
            modality_name VARCHAR(100),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created (created_at)
        )");
        
        $eventType = 'test_send';
        $modalityName = $node['name'];
        $message = "Test image sent to {$node['name']} ({$node['ae_title']} @ {$node['host_name']}:{$node['port']})";
        $sourceIp = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        
        $stmt = $db->prepare("INSERT INTO dicom_activity_log (event_type, source_ip, modality_name, message) VALUES (?, ?, ?, ?)");
        $stmt->bind_param('ssss', $eventType, $sourceIp, $modalityName, $message);
        $stmt->execute();
    } catch (Exception $e) {
        // Log activity failure is non-critical
        error_log("Failed to log DICOM activity: " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => "Test image sent successfully to {$node['name']} ({$node['ae_title']})",
        'node' => $modalityAlias,
        'instance_id' => $instanceId
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => $e->getMessage()
    ]);
}
