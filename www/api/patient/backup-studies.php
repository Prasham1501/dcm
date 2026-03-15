<?php
/**
 * Backup Studies API
 * Download studies as ZIP archive by date range
 *
 * Based on: https://orthanc.uclouvain.be/book/users/rest.html
 * POST /tools/create-archive endpoint
 */

// Don't output JSON header if downloading
if (!isset($_GET['action']) || $_GET['action'] !== 'download') {
    header('Content-Type: application/json');
}

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Increase limits for backup operations
set_time_limit(1800); // 30 minutes
ini_set('memory_limit', '1G');

try {
    $action = $_GET['action'] ?? $_POST['action'] ?? 'preview';

    switch ($action) {
        case 'preview':
            handlePreview();
            break;
        case 'prepare':
            handlePrepare();
            break;
        case 'download':
            handleDownload();
            break;
        case 'status':
            handleStatus();
            break;
        default:
            throw new Exception('Invalid action');
    }

} catch (Exception $e) {
    error_log("Backup studies error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Preview studies that would be included in backup
 */
function handlePreview() {
    $patientId = $_GET['patient_id'] ?? '';
    $months = intval($_GET['months'] ?? 0);
    $direction = $_GET['direction'] ?? 'older'; // 'older' = studies older than X months

    if ($months <= 0) {
        throw new Exception('Invalid months parameter');
    }

    $cutoffDate = date('Y-m-d', strtotime("-$months months"));

    $mysqli = getDbConnection();

    // Build query
    $whereClause = "1=1";
    $params = [];
    $types = '';

    if (!empty($patientId)) {
        $whereClause .= " AND patient_id = ?";
        $params[] = $patientId;
        $types .= 's';
    }

    if ($direction === 'older') {
        $whereClause .= " AND study_date < ?";
    } else {
        $whereClause .= " AND study_date >= ?";
    }
    $params[] = $cutoffDate;
    $types .= 's';

    $stmt = $mysqli->prepare("
        SELECT s.*,
               p.patient_name
        FROM cached_studies s
        LEFT JOIN cached_patients p ON s.patient_id = p.patient_id
        WHERE $whereClause
        ORDER BY s.study_date ASC
    ");

    if (!empty($types)) {
        $stmt->bind_param($types, ...$params);
    }

    $stmt->execute();
    $studies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Calculate total size
    $totalSize = 0;
    foreach ($studies as &$study) {
        $size = getStudySize($study['orthanc_id']);
        $study['size_bytes'] = $size;
        $study['size_formatted'] = formatBytes($size);
        $totalSize += $size;
    }

    echo json_encode([
        'success' => true,
        'cutoff_date' => $cutoffDate,
        'direction' => $direction,
        'study_count' => count($studies),
        'total_size' => $totalSize,
        'total_size_formatted' => formatBytes($totalSize),
        'studies' => $studies
    ]);
}

/**
 * Prepare backup - create job and return job ID
 */
function handlePrepare() {
    $input = json_decode(file_get_contents('php://input'), true);

    $patientId = $input['patient_id'] ?? '';
    $months = intval($input['months'] ?? 0);
    $direction = $input['direction'] ?? 'older';
    $studyIds = $input['study_ids'] ?? []; // Optional: specific study IDs

    if (empty($studyIds) && $months <= 0) {
        throw new Exception('Either study_ids or months parameter required');
    }

    $mysqli = getDbConnection();

    // Get study Orthanc IDs
    if (!empty($studyIds)) {
        $orthancIds = $studyIds;
    } else {
        $cutoffDate = date('Y-m-d', strtotime("-$months months"));
        $whereClause = "1=1";
        $params = [];
        $types = '';

        if (!empty($patientId)) {
            $whereClause .= " AND patient_id = ?";
            $params[] = $patientId;
            $types .= 's';
        }

        if ($direction === 'older') {
            $whereClause .= " AND study_date < ?";
        } else {
            $whereClause .= " AND study_date >= ?";
        }
        $params[] = $cutoffDate;
        $types .= 's';

        $stmt = $mysqli->prepare("SELECT orthanc_id FROM cached_studies WHERE $whereClause");
        if (!empty($types)) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $orthancIds = [];
        while ($row = $result->fetch_assoc()) {
            $orthancIds[] = $row['orthanc_id'];
        }
        $stmt->close();
    }

    if (empty($orthancIds)) {
        throw new Exception('No studies found for backup');
    }

    // Create a unique job ID
    $jobId = uniqid('backup_', true);

    // Store job info in temp directory
    $jobDir = sys_get_temp_dir() . '/dicom_backups/';
    if (!is_dir($jobDir)) {
        mkdir($jobDir, 0755, true);
    }

    $jobFile = $jobDir . $jobId . '.json';
    file_put_contents($jobFile, json_encode([
        'id' => $jobId,
        'study_ids' => $orthancIds,
        'status' => 'preparing',
        'progress' => 0,
        'total' => count($orthancIds),
        'created_at' => date('Y-m-d H:i:s')
    ]));

    // Start creating archive in background or use Orthanc's async endpoint
    // For simplicity, we'll create archive directly with Orthanc
    $archivePath = createArchiveFromOrthanc($orthancIds, $jobId);

    if ($archivePath) {
        // Update job status
        file_put_contents($jobFile, json_encode([
            'id' => $jobId,
            'study_ids' => $orthancIds,
            'status' => 'ready',
            'progress' => 100,
            'total' => count($orthancIds),
            'archive_path' => $archivePath,
            'created_at' => date('Y-m-d H:i:s')
        ]));

        echo json_encode([
            'success' => true,
            'job_id' => $jobId,
            'status' => 'ready',
            'study_count' => count($orthancIds),
            'download_url' => "backup-studies.php?action=download&job_id=$jobId"
        ]);
    } else {
        throw new Exception('Failed to create archive');
    }
}

/**
 * Create archive using Orthanc
 */
function createArchiveFromOrthanc($studyIds, $jobId) {
    // Use Orthanc's create-archive endpoint
    $ch = curl_init(ORTHANC_URL . '/tools/create-archive');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($studyIds),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 1800 // 30 minutes
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error || $httpCode !== 200) {
        error_log("Orthanc archive error: $error, HTTP: $httpCode");
        return null;
    }

    // Save the ZIP file
    $archiveDir = sys_get_temp_dir() . '/dicom_backups/';
    $archivePath = $archiveDir . $jobId . '.zip';

    if (file_put_contents($archivePath, $response) === false) {
        error_log("Failed to save archive to $archivePath");
        return null;
    }

    return $archivePath;
}

/**
 * Check backup job status
 */
function handleStatus() {
    $jobId = $_GET['job_id'] ?? '';

    if (empty($jobId) || !preg_match('/^backup_[\w.]+$/', $jobId)) {
        throw new Exception('Invalid job ID');
    }

    $jobFile = sys_get_temp_dir() . '/dicom_backups/' . $jobId . '.json';

    if (!file_exists($jobFile)) {
        throw new Exception('Job not found');
    }

    $job = json_decode(file_get_contents($jobFile), true);

    // Check if archive exists
    if ($job['status'] === 'ready' && isset($job['archive_path'])) {
        if (file_exists($job['archive_path'])) {
            $job['file_size'] = filesize($job['archive_path']);
            $job['file_size_formatted'] = formatBytes($job['file_size']);
        } else {
            $job['status'] = 'expired';
        }
    }

    echo json_encode([
        'success' => true,
        'job' => $job
    ]);
}

/**
 * Download the backup archive
 */
function handleDownload() {
    $jobId = $_GET['job_id'] ?? '';

    if (empty($jobId) || !preg_match('/^backup_[\w.]+$/', $jobId)) {
        http_response_code(400);
        die('Invalid job ID');
    }

    $jobFile = sys_get_temp_dir() . '/dicom_backups/' . $jobId . '.json';

    if (!file_exists($jobFile)) {
        http_response_code(404);
        die('Backup not found');
    }

    $job = json_decode(file_get_contents($jobFile), true);

    if ($job['status'] !== 'ready' || !isset($job['archive_path'])) {
        http_response_code(400);
        die('Backup not ready');
    }

    $archivePath = $job['archive_path'];

    if (!file_exists($archivePath)) {
        http_response_code(404);
        die('Archive file not found');
    }

    $fileSize = filesize($archivePath);
    $fileName = 'DICOM_Backup_' . date('Y-m-d_His') . '.zip';

    // Clear any previous output
    while (ob_get_level()) {
        ob_end_clean();
    }

    // Send headers for download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $fileName . '"');
    header('Content-Length: ' . $fileSize);
    header('Cache-Control: no-cache, must-revalidate');
    header('Pragma: no-cache');

    // Stream file
    readfile($archivePath);

    // Clean up after download (optional - keep for 1 hour)
    // unlink($archivePath);
    // unlink($jobFile);

    exit;
}

/**
 * Get study size from Orthanc
 */
function getStudySize($orthancId) {
    $ch = curl_init(ORTHANC_URL . '/studies/' . $orthancId . '/statistics');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 10
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return 0;
    }

    $data = json_decode($response, true);
    return $data['DiskSize'] ?? $data['UncompressedSize'] ?? 0;
}

/**
 * Format bytes to human readable
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}
