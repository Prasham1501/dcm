<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Get Import History
 *
 * Returns recent import history with filtering and pagination
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
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    $jobId = isset($_GET['job_id']) ? intval($_GET['job_id']) : null;
    $status = isset($_GET['status']) ? $_GET['status'] : null;

    // Validate limit and offset
    if ($limit < 1 || $limit > 1000) {
        $limit = 50;
    }

    if ($offset < 0) {
        $offset = 0;
    }

    // Validate status
    $validStatuses = ['imported', 'failed', 'duplicate', 'skipped'];
    if ($status && !in_array($status, $validStatuses)) {
        sendErrorResponse('Invalid status filter');
    }

    // Build query
    $query = "
        SELECT
            ih.*,
            ij.job_type,
            ij.source_path as job_source_path
        FROM import_history ih
        LEFT JOIN import_jobs ij ON ih.job_id = ij.id
        WHERE 1=1
    ";

    $types = "";
    $params = [];

    if ($jobId) {
        $query .= " AND ih.job_id = ?";
        $types .= "i";
        $params[] = $jobId;
    }

    if ($status) {
        $query .= " AND ih.status = ?";
        $types .= "s";
        $params[] = $status;
    }

    $query .= " ORDER BY ih.imported_at DESC LIMIT ? OFFSET ?";
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

    $history = [];
    while ($row = $result->fetch_assoc()) {
        $history[] = [
            'id' => $row['id'],
            'job_id' => $row['job_id'],
            'job_type' => $row['job_type'],
            'job_source_path' => $row['job_source_path'],
            'file_path' => $row['file_path'],
            'file_name' => $row['file_name'],
            'file_size_bytes' => $row['file_size_bytes'],
            'file_size_formatted' => formatBytes($row['file_size_bytes']),
            'file_hash' => $row['file_hash'],
            'orthanc_instance_id' => $row['orthanc_instance_id'],
            'patient_id' => $row['patient_id'],
            'study_uid' => $row['study_uid'],
            'series_uid' => $row['series_uid'],
            'instance_uid' => $row['instance_uid'],
            'status' => $row['status'],
            'error_message' => $row['error_message'],
            'imported_at' => $row['imported_at']
        ];
    }

    $stmt->close();

    // Get total count
    $countQuery = "SELECT COUNT(*) as total FROM import_history WHERE 1=1";
    $countTypes = "";
    $countParams = [];

    if ($jobId) {
        $countQuery .= " AND job_id = ?";
        $countTypes .= "i";
        $countParams[] = $jobId;
    }

    if ($status) {
        $countQuery .= " AND status = ?";
        $countTypes .= "s";
        $countParams[] = $status;
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

    // Get summary statistics
    $statsQuery = "
        SELECT
            COUNT(*) as total_imports,
            SUM(CASE WHEN status = 'imported' THEN 1 ELSE 0 END) as successful_imports,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_imports,
            SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) as duplicate_imports,
            SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped_imports,
            SUM(file_size_bytes) as total_size_bytes
        FROM import_history
    ";

    $statsStmt = $db->prepare($statsQuery);
    $statsStmt->execute();
    $statsResult = $statsStmt->get_result();
    $stats = $statsResult->fetch_assoc();
    $statsStmt->close();

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'history' => $history,
            'pagination' => [
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + $limit) < $total
            ],
            'statistics' => [
                'total_imports' => intval($stats['total_imports']),
                'successful_imports' => intval($stats['successful_imports']),
                'failed_imports' => intval($stats['failed_imports']),
                'duplicate_imports' => intval($stats['duplicate_imports']),
                'skipped_imports' => intval($stats['skipped_imports']),
                'total_size_bytes' => intval($stats['total_size_bytes']),
                'total_size_formatted' => formatBytes($stats['total_size_bytes'])
            ]
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in get-import-history.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while retrieving import history', 500);
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
