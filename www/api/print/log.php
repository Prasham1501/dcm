<?php
/**
 * Print Log API
 * Log print jobs and update their status
 *
 * POST - Log a new print job
 * PUT  - Update print job status
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/PrintTracker.php';
require_once __DIR__ . '/../../includes/OfflineSyncManager.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'POST':
            handlePost($db);
            break;

        case 'PUT':
            handlePut($db);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * POST - Log a new print job
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No data provided']);
        return;
    }

    $printTracker = new PrintTracker($db);

    // Set defaults
    $printData = [
        'study_uid' => $data['study_uid'] ?? null,
        'patient_id' => $data['patient_id'] ?? null,
        'patient_name' => $data['patient_name'] ?? null,
        'paper_size' => $data['paper_size'] ?? 'A4',
        'orientation' => $data['orientation'] ?? 'landscape',
        'copies' => $data['copies'] ?? 1,
        'pages_per_copy' => $data['pages_per_copy'] ?? 1,
        'total_pages' => $data['total_pages'] ?? 1,
        'color_mode' => $data['color_mode'] ?? 'grayscale',
        'quality' => $data['quality'] ?? 'high',
        'printer_name' => $data['printer_name'] ?? 'Default',
        'printer_type' => $data['printer_type'] ?? 'local',
        'layout_type' => $data['layout_type'] ?? '1x1',
        'print_type' => $data['print_type'] ?? 'image', // 'image' or 'report'
        'include_patient_info' => $data['include_patient_info'] ?? 1,
        'include_annotations' => $data['include_annotations'] ?? 1,
        'include_measurements' => $data['include_measurements'] ?? 1,
        'status' => $data['status'] ?? 'queued',
        'location_id' => $data['location_id'] ?? null,
        'billable' => $data['billable'] ?? 1
    ];

    // Check if this is an offline print being synced
    if (!empty($data['is_offline'])) {
        $printData['is_offline'] = 1;
        $printData['offline_queue_id'] = $data['offline_queue_id'] ?? null;
    }

    $result = $printTracker->logPrint($printData);

    if ($result['success']) {
        echo json_encode([
            'success' => true,
            'print_log_id' => $result['print_log_id'],
            'print_job_id' => $result['print_job_id'],
            'cost' => $result['cost']
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $result['error']]);
    }
}

/**
 * PUT - Update print job status
 */
function handlePut($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['print_job_id']) || empty($data['status'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'print_job_id and status are required']);
        return;
    }

    $allowedStatuses = ['printing', 'completed', 'failed', 'cancelled'];
    if (!in_array($data['status'], $allowedStatuses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid status']);
        return;
    }

    $printTracker = new PrintTracker($db);
    $result = $printTracker->updatePrintStatus(
        $data['print_job_id'],
        $data['status'],
        $data['error_message'] ?? null
    );

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'Status updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update status']);
    }
}