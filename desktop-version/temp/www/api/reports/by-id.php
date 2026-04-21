<?php
/**
 * Get Report by ID API Endpoint
 * Returns a single medical report by its ID
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Set JSON response header
header('Content-Type: application/json');

// Handle CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow GET method
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    http_response_code(405);
    exit;
}

// Validate session
if (!validateSession()) {
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized - Please log in'
    ]);
    http_response_code(401);
    exit;
}

try {
    // Get report ID from query parameter
    $reportId = isset($_GET['id']) ? intval($_GET['id']) : 0;

    if ($reportId <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Invalid report ID'
        ]);
        http_response_code(400);
        exit;
    }

    // Get database connection
    $db = getDbConnection();

    // Fetch report with user details
    $stmt = $db->prepare("
        SELECT
            r.*,
            u1.full_name AS created_by_name,
            u2.full_name AS finalized_by_name
        FROM medical_reports r
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.finalized_by = u2.id
        WHERE r.id = ?
    ");

    $stmt->bind_param("i", $reportId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        echo json_encode([
            'success' => false,
            'error' => 'Report not found'
        ]);
        http_response_code(404);
        exit;
    }

    $report = $result->fetch_assoc();
    $stmt->close();

    // Get hospital settings for report display
    $hospitalQuery = "SELECT setting_key, setting_value FROM system_settings 
                      WHERE setting_key IN ('hospital_name', 'hospital_logo')";
    $hospitalResult = $db->query($hospitalQuery);
    
    if ($hospitalResult) {
        while ($row = $hospitalResult->fetch_assoc()) {
            if ($row['setting_key'] === 'hospital_name') {
                $report['institution_name'] = $row['setting_value'];
            } else if ($row['setting_key'] === 'hospital_logo') {
                $report['hospital_logo'] = $row['setting_value'];
            }
        }
        $hospitalResult->free();
    }
    
    // Set defaults if not found
    if (!isset($report['institution_name']) || empty($report['institution_name'])) {
        $report['institution_name'] = 'Medical Imaging Center';
    }

    // Return success response
    echo json_encode([
        'success' => true,
        'data' => $report
    ]);

} catch (Exception $e) {
    logMessage("Error fetching report: " . $e->getMessage(), 'error', 'reports.log');
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch report: ' . $e->getMessage()
    ]);
    http_response_code(500);
}
