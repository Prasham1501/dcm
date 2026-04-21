<?php
/**
 * Delete Studies API
 * Delete studies by date range from both Orthanc server and local cache
 *
 * Based on: https://orthanc.uclouvain.be/book/users/rest.html
 * DELETE /studies/{id} endpoint
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Increase execution time for bulk deletions
set_time_limit(600);

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Preview - get studies that would be deleted
        handlePreview();
    } elseif ($method === 'POST' || $method === 'DELETE') {
        // Perform deletion
        handleDeletion();
    } else {
        throw new Exception('Method not allowed');
    }

} catch (Exception $e) {
    error_log("Delete studies error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Preview studies that would be deleted
 */
function handlePreview() {
    $patientId = $_GET['patient_id'] ?? '';
    $months = intval($_GET['months'] ?? 0);
    $direction = $_GET['direction'] ?? 'older'; // 'older' or 'newer'

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
               p.patient_name,
               (SELECT COUNT(*) FROM medical_reports r WHERE r.study_uid = s.orthanc_id) as has_report
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

    // Calculate total size (estimate)
    $totalSize = 0;
    foreach ($studies as &$study) {
        // Get size from Orthanc
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
 * Delete studies
 */
function handleDeletion() {
    $input = json_decode(file_get_contents('php://input'), true);

    $patientId = $input['patient_id'] ?? '';
    $months = intval($input['months'] ?? 0);
    $direction = $input['direction'] ?? 'older';
    $studyIds = $input['study_ids'] ?? []; // Optional: specific study IDs

    if (empty($studyIds) && $months <= 0) {
        throw new Exception('Either study_ids or months parameter required');
    }

    $mysqli = getDbConnection();
    $deletedCount = 0;
    $failedCount = 0;
    $errors = [];
    $freedSpace = 0;

    // Get studies to delete
    if (!empty($studyIds)) {
        // Delete specific studies
        $placeholders = implode(',', array_fill(0, count($studyIds), '?'));
        $stmt = $mysqli->prepare("SELECT orthanc_id, study_instance_uid FROM cached_studies WHERE orthanc_id IN ($placeholders)");
        $types = str_repeat('s', count($studyIds));
        $stmt->bind_param($types, ...$studyIds);
        $stmt->execute();
        $studies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        // Delete by date range
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

        $stmt = $mysqli->prepare("SELECT orthanc_id, study_instance_uid FROM cached_studies WHERE $whereClause");
        if (!empty($types)) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $studies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    }

    // Delete each study
    foreach ($studies as $study) {
        $orthancId = $study['orthanc_id'];

        // Get size before deletion
        $size = getStudySize($orthancId);

        // Delete from Orthanc
        $deleteResult = deleteStudyFromOrthanc($orthancId);

        if ($deleteResult['success']) {
            // Delete from local cache
            $stmt = $mysqli->prepare("DELETE FROM cached_studies WHERE orthanc_id = ?");
            $stmt->bind_param("s", $orthancId);
            $stmt->execute();
            $stmt->close();

            // Delete related reports
            $stmt = $mysqli->prepare("DELETE FROM medical_reports WHERE study_uid = ?");
            $stmt->bind_param("s", $orthancId);
            $stmt->execute();
            $stmt->close();

            // Delete related notes
            $stmt = $mysqli->prepare("DELETE FROM medical_notes WHERE study_uid = ?");
            $stmt->bind_param("s", $orthancId);
            $stmt->execute();
            $stmt->close();

            $deletedCount++;
            $freedSpace += $size;
        } else {
            $failedCount++;
            $errors[] = "Study $orthancId: " . $deleteResult['error'];
        }
    }

    // Clean up orphaned patients (patients with no studies)
    $mysqli->query("
        DELETE p FROM cached_patients p
        LEFT JOIN cached_studies s ON p.patient_id = s.patient_id
        WHERE s.id IS NULL
    ");
    $orphanedPatients = $mysqli->affected_rows;

    echo json_encode([
        'success' => $deletedCount > 0,
        'message' => "Deleted $deletedCount studies" . ($failedCount > 0 ? ", $failedCount failed" : ""),
        'deleted_count' => $deletedCount,
        'failed_count' => $failedCount,
        'freed_space' => $freedSpace,
        'freed_space_formatted' => formatBytes($freedSpace),
        'orphaned_patients_removed' => $orphanedPatients,
        'errors' => $errors
    ]);
}

/**
 * Delete study from Orthanc server
 */
function deleteStudyFromOrthanc($orthancId) {
    $ch = curl_init(ORTHANC_URL . '/studies/' . $orthancId);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 60
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'error' => "Connection error: $error"];
    }

    if ($httpCode === 200 || $httpCode === 404) {
        // 404 means already deleted, which is fine
        return ['success' => true];
    }

    return ['success' => false, 'error' => "HTTP $httpCode"];
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
