<?php
/**
 * Edit Patient API
 * Update patient details in local cache
 * Note: Cannot modify Orthanc DICOM tags directly - only local cache
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
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Get patient details
        $orthancId = $_GET['orthanc_id'] ?? '';
        if (empty($orthancId)) {
            throw new Exception('Patient ID required');
        }

        $mysqli = getDbConnection();
        $stmt = $mysqli->prepare("SELECT * FROM cached_patients WHERE orthanc_id = ?");
        $stmt->bind_param("s", $orthancId);
        $stmt->execute();
        $patient = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$patient) {
            throw new Exception('Patient not found');
        }

        // Get study count
        $stmt = $mysqli->prepare("SELECT COUNT(*) as count FROM cached_studies WHERE patient_id = ?");
        $stmt->bind_param("s", $patient['patient_id']);
        $stmt->execute();
        $studyCount = $stmt->get_result()->fetch_assoc()['count'];
        $stmt->close();

        $patient['study_count'] = $studyCount;

        echo json_encode([
            'success' => true,
            'patient' => $patient
        ]);

    } elseif ($method === 'POST' || $method === 'PUT') {
        // Update patient details
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            // Try form data
            $input = $_POST;
        }

        $orthancId = $input['orthanc_id'] ?? '';
        if (empty($orthancId)) {
            throw new Exception('Patient ID required');
        }

        // Fields that can be updated (map input names to database columns)
        $fieldMapping = [
            'patient_name' => 'patient_name',
            'birth_date' => 'patient_birth_date',
            'patient_birth_date' => 'patient_birth_date',
            'sex' => 'patient_sex',
            'patient_sex' => 'patient_sex',
            'patient_id' => 'patient_id' // Allow changing display ID (not Orthanc ID)
        ];

        $updates = [];
        $params = [];
        $types = '';

        foreach ($fieldMapping as $inputField => $dbColumn) {
            if (isset($input[$inputField])) {
                $updates[] = "$dbColumn = ?";
                $params[] = $input[$inputField];
                $types .= 's';
            }
        }

        if (empty($updates)) {
            throw new Exception('No fields to update');
        }

        // Add orthanc_id for WHERE clause
        $params[] = $orthancId;
        $types .= 's';

        $mysqli = getDbConnection();
        $sql = "UPDATE cached_patients SET " . implode(', ', $updates) . " WHERE orthanc_id = ?";
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param($types, ...$params);

        if (!$stmt->execute()) {
            throw new Exception('Failed to update patient: ' . $stmt->error);
        }

        $affected = $stmt->affected_rows;
        $stmt->close();

        // If patient_id was changed, update related studies
        if (isset($input['patient_id']) && isset($input['old_patient_id'])) {
            $stmt = $mysqli->prepare("UPDATE cached_studies SET patient_id = ? WHERE patient_id = ?");
            $stmt->bind_param("ss", $input['patient_id'], $input['old_patient_id']);
            $stmt->execute();
            $stmt->close();
        }

        echo json_encode([
            'success' => true,
            'message' => 'Patient updated successfully',
            'affected_rows' => $affected
        ]);

    } else {
        throw new Exception('Method not allowed');
    }

} catch (Exception $e) {
    error_log("Edit patient error: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
