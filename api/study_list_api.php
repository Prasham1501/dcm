<?php
/**
 * Study List API - Enhanced with debugging
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Validate session
requireLogin();

try {
    $mysqli = getDbConnection();

    // Get patient_id - handle "0" as valid
    $patientId = isset($_GET['patient_id']) ? $_GET['patient_id'] : null;

    if ($patientId === null || $patientId === '') {
        throw new Exception('Patient ID required');
    }

    // Get patient info
    $stmt = $mysqli->prepare("SELECT * FROM cached_patients WHERE patient_id = ?");
    $stmt->bind_param('s', $patientId);
    $stmt->execute();
    $result = $stmt->get_result();
    $patient = $result->fetch_assoc();
    $stmt->close();

    if (!$patient) {
        // Try to find by orthanc_id as fallback
        $stmt = $mysqli->prepare("SELECT * FROM cached_patients WHERE orthanc_id = ?");
        $stmt->bind_param('s', $patientId);
        $stmt->execute();
        $result = $stmt->get_result();
        $patient = $result->fetch_assoc();
        $stmt->close();

        if (!$patient) {
            throw new Exception('Patient not found in cache');
        }
    }

    // Get studies for this patient
    $stmt = $mysqli->prepare("
        SELECT * FROM cached_studies
        WHERE patient_id = ?
        ORDER BY study_date DESC, study_time DESC
    ");
    $stmt->bind_param('s', $patient['patient_id']);
    $stmt->execute();
    $result = $stmt->get_result();
    $studies = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    echo json_encode([
        'success' => true,
        'patient' => $patient,
        'studies' => $studies,
        'count' => count($studies),
        'debug' => APP_ENV === 'development' ? [
            'environment' => APP_ENV,
            'db_name' => DB_NAME,
            'query_patient_id' => $patient['patient_id']
        ] : null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'patient_id_received' => $_GET['patient_id'] ?? 'none',
        'debug' => APP_ENV === 'development' ? [
            'environment' => APP_ENV,
            'db_name' => DB_NAME,
            'trace' => $e->getTraceAsString()
        ] : null
    ]);
}
