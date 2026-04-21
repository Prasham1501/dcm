<?php
/**
 * System Reset API
 * Clears all data from Database and Orthanc
 * DANGER: This is destructive!
 */
// Ensure no output before headers
error_reporting(0);
ini_set('display_errors', 0);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

try {
    // Include session management
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

// Clear buffer and set header
ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check admin role
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied. Admin rights required.']);
    exit;
}

try {
    // Verify confirmation
    $input = json_decode(file_get_contents('php://input'), true);
    if (($input['confirmation'] ?? '') !== 'DELETE_EVERYTHING') {
        throw new Exception("Invalid confirmation code");
    }

    $db = getDbConnection();
    
    // 1. Delete from Orthanc
    $deletedOrthanc = 0;
    $orthancErrors = 0;
    
    // Get all patients
    $ch = curl_init(ORTHANC_URL . '/patients');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    $response = curl_exec($ch);
    curl_close($ch);
    
    if ($response) {
        $patients = json_decode($response, true);
        if (is_array($patients)) {
            foreach ($patients as $patientId) {
                $ch = curl_init(ORTHANC_URL . '/patients/' . $patientId);
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "DELETE");
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
                if (curl_exec($ch)) {
                    $deletedOrthanc++;
                } else {
                    $orthancErrors++;
                }
                curl_close($ch);
            }
        }
    }

    // 2. Clear Database Tables (preserve admin user)
    // List of tables to truncate completely
    $tablesToTruncate = [
        'cached_instances',
        'cached_series',
        'cached_studies',
        'cached_patients',
        'instances',      // Legacy/Alternative names
        'series',
        'studies',
        'patients',
        'imported_studies',
        'worklist_items',
        'audit_logs',
        'sessions'
    ];

    // Disable foreign key checks
    $db->query("SET FOREIGN_KEY_CHECKS = 0");

    $truncatedCount = 0;

    foreach ($tablesToTruncate as $table) {
        // Check if table exists first
        $check = $db->query("SHOW TABLES LIKE '$table'");
        if ($check && $check->num_rows > 0) {
            $db->query("TRUNCATE TABLE $table");
            $truncatedCount++;
        }
    }

    // Handle users table - delete all except admin role
    $check = $db->query("SHOW TABLES LIKE 'users'");
    if ($check && $check->num_rows > 0) {
        $db->query("DELETE FROM users WHERE role != 'admin'");
        $truncatedCount++;
    }

    // Re-enable foreign key checks
    $db->query("SET FOREIGN_KEY_CHECKS = 1");
    
    // Log the reset
    logMessage("System reset performed by user ID " . $_SESSION['user_id'], 'warning');

    echo json_encode([
        'success' => true,
        'message' => 'System reset successfully',
        'details' => [
            'orthanc_deleted' => $deletedOrthanc,
            'orthanc_errors' => $orthancErrors,
            'tables_truncated' => $truncatedCount
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
