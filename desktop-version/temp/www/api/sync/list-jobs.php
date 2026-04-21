<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: List Import Jobs
 *
 * Returns list of import jobs with filtering and pagination
 * Requires admin authentication
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Set content type
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    sendErrorResponse('Authentication required', 401);
}

// Check admin role
if (!isAdmin()) {
    sendErrorResponse('Admin access required', 403);
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get database connection
    $db = getDbConnection();

    // Get query parameters
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 20;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    $status = isset($_GET['status']) ? $_GET['status'] : null;
    $jobType = isset($_GET['job_type']) ? $_GET['job_type'] : null;

    // Validate limit and offset
    if ($limit < 1 || $limit > 100) {
        $limit = 20;
    }

    if ($offset < 0) {
        $offset = 0;
    }

    // Validate status
    $validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    if ($status && !in_array($status, $validStatuses)) {
        sendErrorResponse('Invalid status filter');
    }

    // Validate job type
    $validJobTypes = ['initial', 'incremental', 'manual'];
    if ($jobType && !in_array($jobType, $validJobTypes)) {
        sendErrorResponse('Invalid job_type filter');
    }

    // Build query
    $query = "SELECT * FROM import_jobs WHERE 1=1";
    $types = "";
    $params = [];

    if ($status) {
        $query .= " AND status = ?";
        $types .= "s";
        $params[] = $status;
    }

    if ($jobType) {
        $query .= " AND job_type = ?";
        $types .= "s";
        $params[] = $jobType;
    }

    $query .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $types .= "ii";
    $params[] = $limit;
    $params[] = $offset;

    // Execute query
    $stmt = $db->prepare($query);

    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    $jobs = [];
    while ($row = $result->fetch_assoc()) {
        // Calculate progress percentage
        $progressPercentage = 0;
        if ($row['total_files'] > 0) {
            $progressPercentage = round(($row['files_processed'] / $row['total_files']) * 100, 2);
        }

        $jobs[] = [
            'id' => $row['id'],
            'job_type' => $row['job_type'],
            'source_path' => $row['source_path'],
            'total_files' => $row['total_files'],
            'files_processed' => $row['files_processed'],
            'files_imported' => $row['files_imported'],
            'files_failed' => $row['files_failed'],
            'total_size_bytes' => $row['total_size_bytes'],
            'total_size_formatted' => formatBytes($row['total_size_bytes']),
            'status' => $row['status'],
            'progress_percentage' => $progressPercentage,
            'error_message' => $row['error_message'],
            'started_at' => $row['started_at'],
            'completed_at' => $row['completed_at'],
            'created_at' => $row['created_at']
        ];
    }

    $stmt->close();

    // Get total count
    $countQuery = "SELECT COUNT(*) as total FROM import_jobs WHERE 1=1";
    $countTypes = "";
    $countParams = [];

    if ($status) {
        $countQuery .= " AND status = ?";
        $countTypes .= "s";
        $countParams[] = $status;
    }

    if ($jobType) {
        $countQuery .= " AND job_type = ?";
        $countTypes .= "s";
        $countParams[] = $jobType;
    }

    $countStmt = $db->prepare($countQuery);

    if (!empty($countParams)) {
        $countStmt->bind_param($countTypes, ...$countParams);
    }

    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $countRow = $countResult->fetch_assoc();
    $total = $countRow['total'];
    $countStmt->close();

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'jobs' => $jobs,
            'pagination' => [
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $total
            ]
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in list-jobs.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while retrieving jobs list', 500);
}

/**
 * Format bytes to human-readable size
 *
 * @param int $bytes Bytes
 * @return string Formatted size
 */
function formatBytes($bytes) {
    if ($bytes == 0) return '0 B';

    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $i = floor(log($bytes) / log(1024));

    return round($bytes / pow(1024, $i), 2) . ' ' . $units[$i];
}
