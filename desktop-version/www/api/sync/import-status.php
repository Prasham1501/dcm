<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Get Import Job Status
 *
 * Returns status and progress of an import job
 * Requires admin authentication
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/classes/HospitalDataImporter.php';

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
    // Get job_id from query parameter
    if (empty($_GET['job_id'])) {
        sendErrorResponse('job_id parameter is required');
    }

    $jobId = intval($_GET['job_id']);

    if ($jobId <= 0) {
        sendErrorResponse('Invalid job_id');
    }

    // Create importer instance
    $importer = new HospitalDataImporter();

    // Get job details
    $job = $importer->getJobDetails($jobId);

    if (!$job) {
        sendErrorResponse('Import job not found', 404);
    }

    // Calculate progress percentage
    $progressPercentage = 0;
    if ($job['total_files'] > 0) {
        $progressPercentage = round(($job['files_processed'] / $job['total_files']) * 100, 2);
    }

    // Calculate estimated time remaining
    $estimatedTimeRemaining = null;
    if ($job['status'] === 'running' && $job['files_processed'] > 0 && $job['started_at']) {
        $elapsedSeconds = time() - strtotime($job['started_at']);
        $filesRemaining = $job['total_files'] - $job['files_processed'];

        if ($job['files_processed'] > 0) {
            $secondsPerFile = $elapsedSeconds / $job['files_processed'];
            $estimatedTimeRemaining = round($filesRemaining * $secondsPerFile);
        }
    }

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'job_id' => $job['id'],
            'job_type' => $job['job_type'],
            'source_path' => $job['source_path'],
            'status' => $job['status'],
            'total_files' => $job['total_files'],
            'files_processed' => $job['files_processed'],
            'files_imported' => $job['files_imported'],
            'files_failed' => $job['files_failed'],
            'total_size_bytes' => $job['total_size_bytes'],
            'total_size_formatted' => formatBytes($job['total_size_bytes']),
            'progress_percentage' => $progressPercentage,
            'estimated_time_remaining' => $estimatedTimeRemaining,
            'estimated_time_remaining_formatted' => $estimatedTimeRemaining ? formatDuration($estimatedTimeRemaining) : null,
            'error_message' => $job['error_message'],
            'started_at' => $job['started_at'],
            'completed_at' => $job['completed_at'],
            'created_at' => $job['created_at']
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in import-status.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while retrieving import status', 500);
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

/**
 * Format duration in seconds to human-readable format
 *
 * @param int $seconds Seconds
 * @return string Formatted duration
 */
function formatDuration($seconds) {
    if ($seconds < 60) {
        return $seconds . ' seconds';
    } elseif ($seconds < 3600) {
        $minutes = floor($seconds / 60);
        return $minutes . ' minute' . ($minutes > 1 ? 's' : '');
    } else {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        return $hours . ' hour' . ($hours > 1 ? 's' : '') . ($minutes > 0 ? ' ' . $minutes . ' minute' . ($minutes > 1 ? 's' : '') : '');
    }
}
