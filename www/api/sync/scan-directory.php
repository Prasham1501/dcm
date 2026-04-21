<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Scan Hospital Data Directory
 *
 * Scans a directory for DICOM files
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
    if (empty($input['path'])) {
        sendErrorResponse('Path is required');
    }

    $path = trim($input['path']);

    // Security: Validate path
    if (!is_dir($path)) {
        sendErrorResponse('Invalid directory path');
    }

    // Create importer instance
    $importer = new HospitalDataImporter();

    // Scan directory
    logMessage("User {$_SESSION['username']} initiated directory scan: {$path}", 'info', 'import.log');

    $result = $importer->scanDirectory($path);

    if (isset($result['error'])) {
        sendErrorResponse($result['error']);
    }

    // Prepare response
    $response = [
        'success' => true,
        'data' => [
            'path' => $path,
            'total_files' => count($result['files']),
            'total_size_bytes' => $result['total_size'],
            'total_size_formatted' => formatBytes($result['total_size']),
            'file_list' => array_map(function($file) {
                return [
                    'path' => $file['path'],
                    'name' => $file['name'],
                    'size' => $file['size'],
                    'size_formatted' => formatBytes($file['size']),
                    'modified' => date('Y-m-d H:i:s', $file['modified'])
                ];
            }, array_slice($result['files'], 0, 100)) // Limit to first 100 for performance
        ]
    ];

    // Log audit event
    logAuditEvent(
        $_SESSION['user_id'],
        'scan_directory',
        'import',
        null,
        "Scanned directory: {$path}, Found: " . count($result['files']) . " files"
    );

    sendJsonResponse($response);

} catch (Exception $e) {
    logMessage("Error in scan-directory.php: " . $e->getMessage(), 'error', 'import.log');
    sendErrorResponse('An error occurred while scanning directory', 500);
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
