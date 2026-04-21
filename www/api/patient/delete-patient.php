<?php
/**
 * Delete Patient API
 * Deletes a patient record from local cache
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

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method not allowed');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $orthancId = $input['orthanc_id'] ?? '';
    $patientId = $input['patient_id'] ?? '';

    if (empty($orthancId) && empty($patientId)) {
        throw new Exception('Patient ID required');
    }

    $mysqli = getDbConnection();
    
    // Delete from cached_patients
    if (!empty($orthancId)) {
        $stmt = $mysqli->prepare("DELETE FROM cached_patients WHERE orthanc_id = ?");
        $stmt->bind_param("s", $orthancId);
    } else {
        $stmt = $mysqli->prepare("DELETE FROM cached_patients WHERE patient_id = ?");
        $stmt->bind_param("s", $patientId);
    }
    
    $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();

    // Also try to delete from Orthanc if it exists there
    if (!empty($orthancId) && !str_starts_with($orthancId, 'local_')) {
        $ch = curl_init(ORTHANC_URL . '/patients/' . $orthancId);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
            CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
            CURLOPT_TIMEOUT => 30
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Patient deleted successfully',
        'affected_rows' => $affectedRows
    ]);

} catch (Exception $e) {
    error_log("Delete patient error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
