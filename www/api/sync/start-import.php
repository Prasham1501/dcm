<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Start Import Job
 *
 * Starts a new import job for DICOM files
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

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        sendErrorResponse('Invalid JSON input');
    }

    // Validate required fields
    if (empty($input['source_path'])) {
        sendErrorResponse('Source path is required');
    }

    $sourcePath = trim($input['source_path']);
    $jobType = $input['job_type'] ?? 'manual';

    // Validate job type
    $validJobTypes = ['initial', 'incremental', 'manual'];
    if (!in_array($jobType, $validJobTypes)) {
        sendErrorResponse('Invalid job type. Must be: initial, incremental, or manual');
    }

    // Security: Validate path
    if (!is_dir($sourcePath)) {
        sendErrorResponse('Invalid source directory path');
    }

    // Create importer instance
    $importer = new HospitalDataImporter();

    // Scan directory first to get file count and size
    logMessage("User {$_SESSION['username']} starting import job: {$sourcePath} (Type: {$jobType})", 'info', 'import.log');

    $scanResult = $importer->scanDirectory($sourcePath);

    if (isset($scanResult['error'])) {
        sendErrorResponse($scanResult['error']);
    }

    $totalFiles = count($scanResult['files']);
    $totalSize = $scanResult['total_size'];

    if ($totalFiles === 0) {
        sendErrorResponse('No DICOM files found in the specified directory');
    }

    // Create import job
    $jobId = $importer->createImportJob($sourcePath, $jobType, $totalFiles, $totalSize);

    if (!$jobId) {
        sendErrorResponse('Failed to create import job', 500);
    }

    // Prepare file paths for import
    $filePaths = array_column($scanResult['files'], 'path');

    // Start batch import in background (or return job_id for client-side processing)
    // For now, we'll start it immediately and return the job_id
    // Client can poll import-status.php for progress

    // Option 1: Start import immediately (blocking - not recommended for large datasets)
    // $importResult = $importer->batchImport($filePaths, $jobId);

    // Option 2: Return job_id and let client handle the import via another endpoint
    // This is better for large datasets as it won't timeout

    // Log audit event
    logAuditEvent(
        $_SESSION['user_id'],
        'start_import',
        'import_job',
        $jobId,
        "Started import job: {$sourcePath}, Files: {$totalFiles}, Type: {$jobType}"
    );

    $response = [
        'success' => true,
        'message' => 'Import job created successfully',
        'data' => [
            'job_id' => $jobId,
            'source_path' => $sourcePath,
            'job_type' => $jobType,
            'total_files' => $totalFiles,
            'total_size_bytes' => $totalSize,
            'total_size_formatted' => formatBytes($totalSize),
            'status' => 'pending'
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in start-import.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while starting import job', 500);
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
