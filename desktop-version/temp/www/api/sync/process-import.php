<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Process Import Job
 *
 * Executes the actual import process for a pending job
 * This should be called after start-import.php creates the job
 * Can be called via AJAX with progress polling, or via CLI for large imports
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

// Increase execution time and memory for large imports
set_time_limit(3600); // 1 hour
ini_set('memory_limit', '512M');

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
    if (empty($input['job_id'])) {
        sendErrorResponse('job_id is required');
    }

    $jobId = intval($input['job_id']);

    if ($jobId <= 0) {
        sendErrorResponse('Invalid job_id');
    }

    // Optional: batch size for processing (default: process all)
    $batchSize = isset($input['batch_size']) ? intval($input['batch_size']) : null;

    // Create importer instance
    $importer = new HospitalDataImporter();

    // Get job details
    $job = $importer->getJobDetails($jobId);

    if (!$job) {
        sendErrorResponse('Import job not found', 404);
    }

    // Check job status
    if ($job['status'] !== 'pending' && $job['status'] !== 'running') {
        sendErrorResponse('Job is not in pending or running state. Current status: ' . $job['status']);
    }

    // Scan source directory for files
    logMessage("User {$_SESSION['username']} processing import job {$jobId}", 'info', 'import.log');

    $scanResult = $importer->scanDirectory($job['source_path']);

    if (isset($scanResult['error'])) {
        // Update job as failed
        $importer->updateJobStatus($jobId, 'failed', $scanResult['error']);
        sendErrorResponse($scanResult['error']);
    }

    $files = $scanResult['files'];

    if (empty($files)) {
        // Update job as failed
        $importer->updateJobStatus($jobId, 'failed', 'No DICOM files found');
        sendErrorResponse('No DICOM files found in source directory');
    }

    // If batch_size is specified, limit files to process
    if ($batchSize && $batchSize > 0) {
        $files = array_slice($files, 0, $batchSize);
    }

    // Execute batch import
    $importResult = $importer->batchImport($files, $jobId);

    // Log audit event
    logAuditEvent(
        $_SESSION['user_id'],
        'process_import',
        'import_job',
        $jobId,
        "Processed import job {$jobId}: Imported={$importResult['imported']}, Failed={$importResult['failed']}, Duplicates={$importResult['duplicates']}"
    );

    logMessage("Import job {$jobId} completed: Processed={$importResult['processed']}, Imported={$importResult['imported']}, Failed={$importResult['failed']}", 'info', 'import.log');

    // Get updated job details
    $updatedJob = $importer->getJobDetails($jobId);

    $response = [
        'success' => true,
        'message' => 'Import job processed successfully',
        'data' => [
            'job_id' => $jobId,
            'status' => $updatedJob['status'],
            'total_files' => $updatedJob['total_files'],
            'files_processed' => $updatedJob['files_processed'],
            'files_imported' => $updatedJob['files_imported'],
            'files_failed' => $updatedJob['files_failed'],
            'duplicates' => $importResult['duplicates'],
            'errors' => $importResult['errors']
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in process-import.php: " . $e->getMessage(), 'error', 'import.log');

    // Try to update job as failed if we have a job_id
    if (isset($jobId)) {
        try {
            $importer = new HospitalDataImporter();
            $importer->updateJobStatus($jobId, 'failed', $e->getMessage());
        } catch (Exception $innerE) {
            // Ignore
        }
    }

    sendErrorResponse('An error occurred while processing import job: ' . $e->getMessage(), 500);
}
