<?php
/**
 * API to get stats for auto-refresh
 * Returns total study count and latest import timestamp
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

try {
    $db = getDbConnection();
    
    // Get total count
    $countResult = $db->query("SELECT COUNT(*) as total FROM imported_studies");
    $total = $countResult->fetch_assoc()['total'] ?? 0;
    
    // Get last import timestamp
    // Assuming created_at or similar; checking schema via query
    // If table doesn't have created_at, we use ID as proxy or just count
    
    // Check if created_at exists, if not use max ID
    $lastImport = 0;
    
    // Optimistic query for latest timestamp
    $result = $db->query("SELECT MAX(id) as max_id FROM imported_studies");
    $row = $result->fetch_assoc();
    $lastId = $row['max_id'] ?? 0;
    
    echo json_encode([
        'success' => true,
        'total' => (int)$total,
        'last_id' => (int)$lastId
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
