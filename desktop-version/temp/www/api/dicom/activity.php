<?php
/**
 * DICOM Activity Monitor API
 * Tracks incoming pings/echoes from CT/MRI consoles via Orthanc
 * 
 * This endpoint allows unauthenticated access since it's used for:
 * - GET: Internal ping monitoring (polling for new activities)
 * - POST: Webhooks from Orthanc/external DICOM systems
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

// No authentication required - this is an internal monitoring/webhook endpoint

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDbConnection();
    
    // Create activity log table if not exists
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

    if ($method === 'GET') {
        // Get recent activity (last 24 hours)
        $hours = isset($_GET['hours']) ? (int)$_GET['hours'] : 24;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        
        // Also fetch from Orthanc changes to get real-time updates
        $orthancActivities = [];
        try {
            $ch = curl_init(ORTHANC_URL . '/changes?limit=20');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                $changes = json_decode($response, true);
                if (isset($changes['Changes'])) {
                    foreach ($changes['Changes'] as $change) {
                        // Map Orthanc change types to activity
                        $orthancActivities[] = [
                            'id' => 'orthanc_' . $change['Seq'],
                            'event_type' => $change['ChangeType'],
                            'source_ip' => null,
                            'source_aet' => null,
                            'modality_name' => $change['ResourceType'] ?? 'Unknown',
                            'message' => 'Orthanc: ' . $change['ChangeType'] . ' - ' . $change['ID'],
                            'created_at' => date('Y-m-d H:i:s')
                        ];
                    }
                }
            }
        } catch (Exception $e) {
            // Orthanc not available, continue with DB only
        }
        
        // Get from our activity log table
        $stmt = $db->prepare("
            SELECT * FROM dicom_activity_log 
            WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY created_at DESC 
            LIMIT ?
        ");
        $stmt->bind_param('ii', $hours, $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $activities = [];
        while ($row = $result->fetch_assoc()) {
            $activities[] = $row;
        }
        
        // Merge and sort
        $allActivities = array_merge($activities, $orthancActivities);
        usort($allActivities, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        echo json_encode([
            'success' => true, 
            'activities' => array_slice($allActivities, 0, $limit),
            'orthanc_connected' => !empty($orthancActivities) || ($httpCode ?? 0) === 200
        ]);
        
    } else if ($method === 'POST') {
        // Log a new activity (can be called by external systems or Orthanc webhook)
        $input = json_decode(file_get_contents('php://input'), true);
        
        $eventType = $input['event_type'] ?? 'ping';
        $sourceIp = $input['source_ip'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $sourceAet = $input['source_aet'] ?? null;
        $modalityName = $input['modality_name'] ?? null;
        $message = $input['message'] ?? 'DICOM connection received';
        
        $stmt = $db->prepare("
            INSERT INTO dicom_activity_log (event_type, source_ip, source_aet, modality_name, message)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->bind_param('sssss', $eventType, $sourceIp, $sourceAet, $modalityName, $message);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'id' => $stmt->insert_id]);
        
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
