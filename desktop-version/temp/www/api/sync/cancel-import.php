<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Cancel Import Job
 *
 * Cancels a running or pending import job
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
    if (empty($input['job_id'])) {
        sendErrorResponse('job_id is required');
    }

    $jobId = intval($input['job_id']);

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

    // Check if job can be cancelled
    if ($job['status'] !== 'pending' && $job['status'] !== 'running') {
        sendErrorResponse('Job cannot be cancelled. Current status: ' . $job['status']);
    }

    // Update job status to cancelled
    $importer->updateJobStatus($jobId, 'cancelled', 'Cancelled by user');

    // Log audit event
    logAuditEvent(
        $_SESSION['user_id'],
        'cancel_import',
        'import_job',
        $jobId,
        "Cancelled import job {$jobId}"
    );

    logMessage("User {$_SESSION['username']} cancelled import job {$jobId}", 'info', 'import.log');

    $response = [
        'success' => true,
        'message' => 'Import job cancelled successfully',
        'data' => [
            'job_id' => $jobId,
            'status' => 'cancelled'
        ]
    ];

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in cancel-import.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while cancelling import job', 500);
}
