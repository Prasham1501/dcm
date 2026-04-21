<?php
/**
 * Sync API - Returns JSON response for AJAX calls
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Validate session
requireLogin();

function callOrthanc($endpoint) {
    $url = ORTHANC_URL . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return null;
    }

    return json_decode($response, true);
}

try {
    $mysqli = getDbConnection();

    // Get all patients
    $patients = callOrthanc('/patients');

    if (!$patients) {
        throw new Exception('Failed to connect to Orthanc');
    }

    $studiesAdded = 0;
    $studiesUpdated = 0;
    $patientsProcessed = 0;

    foreach ($patients as $patientOrthancId) {
        $patientData = callOrthanc("/patients/$patientOrthancId");

        if (!$patientData) {
            continue;
        }

        $patientId = $patientData['MainDicomTags']['PatientID'] ?? 'UNKNOWN';
        $patientName = $patientData['MainDicomTags']['PatientName'] ?? 'Unknown';

        // Check if patient exists
        $stmt = $mysqli->prepare("SELECT patient_id FROM cached_patients WHERE patient_id = ?");
        $stmt->bind_param('s', $patientId);
        $stmt->execute();
        $result = $stmt->get_result();
        $cachedPatient = $result->fetch_assoc();
        $stmt->close();

        if (!$cachedPatient) {
            // Insert patient
            $birthDate = $patientData['MainDicomTags']['PatientBirthDate'] ?? null;
            $sex = $patientData['MainDicomTags']['PatientSex'] ?? null;

            if ($birthDate && strlen($birthDate) === 8) {
                $birthDate = substr($birthDate, 0, 4) . '-' . substr($birthDate, 4, 2) . '-' . substr($birthDate, 6, 2);
            } else {
                $birthDate = null;
            }

            $stmt = $mysqli->prepare("INSERT INTO cached_patients (orthanc_id, patient_id, patient_name, patient_birth_date, patient_sex, study_count, last_study_date) VALUES (?, ?, ?, ?, ?, 0, CURDATE())");
            $stmt->bind_param('sssss', $patientOrthancId, $patientId, $patientName, $birthDate, $sex);
            $stmt->execute();
            $stmt->close();
        }

        $patientsProcessed++;

        // Get studies
        $studies = $patientData['Studies'] ?? [];

        foreach ($studies as $studyOrthancId) {
            $studyData = callOrthanc("/studies/$studyOrthancId");

            if (!$studyData) {
                continue;
            }

            // Count total instances in Orthanc for this study
            $totalInstancesInOrthanc = 0;
            foreach ($studyData['Series'] ?? [] as $seriesId) {
                $seriesData = callOrthanc("/series/$seriesId");
                if ($seriesData) {
                    $totalInstancesInOrthanc += count($seriesData['Instances'] ?? []);
                }
            }

            // Get study UID
            $studyUID = $studyData['MainDicomTags']['StudyInstanceUID'] ?? null;
            $studyDate = $studyData['MainDicomTags']['StudyDate'] ?? null;
            $studyTime = $studyData['MainDicomTags']['StudyTime'] ?? null;
            $studyDesc = $studyData['MainDicomTags']['StudyDescription'] ?? 'PACS Study';
            $accessionNumber = $studyData['MainDicomTags']['AccessionNumber'] ?? null;

            // Get modality
            $modality = null;
            if (isset($studyData['Series']) && count($studyData['Series']) > 0) {
                $firstSeries = callOrthanc("/series/" . $studyData['Series'][0]);
                if ($firstSeries) {
                    $modality = $firstSeries['MainDicomTags']['Modality'] ?? 'CT';
                }
            }
            if (!$modality) $modality = 'CT';

            $seriesCount = count($studyData['Series'] ?? []);

            // Format date
            if ($studyDate && strlen($studyDate) === 8) {
                $studyDate = substr($studyDate, 0, 4) . '-' . substr($studyDate, 4, 2) . '-' . substr($studyDate, 6, 2);
            } else {
                $studyDate = date('Y-m-d');
            }

            // Format time
            if ($studyTime && strlen($studyTime) >= 6) {
                $studyTime = substr($studyTime, 0, 2) . ':' . substr($studyTime, 2, 2) . ':' . substr($studyTime, 4, 2);
            } else {
                $studyTime = date('H:i:s');
            }

            // Check if study exists
            $stmt = $mysqli->prepare("SELECT id FROM cached_studies WHERE study_instance_uid = ?");
            $stmt->bind_param('s', $studyUID);
            $stmt->execute();
            $result = $stmt->get_result();
            $existingStudy = $result->fetch_assoc();
            $stmt->close();

            if ($existingStudy) {
                // Update
                $stmt = $mysqli->prepare("UPDATE cached_studies SET
                    orthanc_id = ?,
                    patient_id = ?,
                    study_date = ?,
                    study_time = ?,
                    study_description = ?,
                    accession_number = ?,
                    modality = ?,
                    series_count = ?,
                    instance_count = ?,
                    last_synced = NOW()
                    WHERE study_instance_uid = ?");
                $stmt->bind_param('sssssssiss',
                    $studyOrthancId,
                    $patientId,
                    $studyDate,
                    $studyTime,
                    $studyDesc,
                    $accessionNumber,
                    $modality,
                    $seriesCount,
                    $totalInstancesInOrthanc,
                    $studyUID
                );
                $stmt->execute();
                $stmt->close();

                $studiesUpdated++;
            } else {
                // Insert new
                $stmt = $mysqli->prepare("INSERT INTO cached_studies (
                    study_instance_uid,
                    orthanc_id,
                    patient_id,
                    study_date,
                    study_time,
                    study_description,
                    accession_number,
                    modality,
                    series_count,
                    instance_count,
                    last_synced
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
                $stmt->bind_param('ssssssssii',
                    $studyUID,
                    $studyOrthancId,
                    $patientId,
                    $studyDate,
                    $studyTime,
                    $studyDesc,
                    $accessionNumber,
                    $modality,
                    $seriesCount,
                    $totalInstancesInOrthanc
                );
                $stmt->execute();
                $stmt->close();

                $studiesAdded++;
            }
        }
    }

    // Update patient study counts
    $mysqli->query("
        UPDATE cached_patients cp
        SET study_count = (
            SELECT COUNT(*) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id
        ),
        last_study_date = (
            SELECT MAX(study_date) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id
        )
    ");

    $result = $mysqli->query("SELECT COUNT(*) as count FROM cached_studies");
    $row = $result->fetch_assoc();
    $totalStudies = $row['count'];

    $result = $mysqli->query("SELECT COUNT(*) as count FROM cached_patients");
    $row = $result->fetch_assoc();
    $totalPatients = $row['count'];

    echo json_encode([
        'success' => true,
        'message' => 'Sync completed successfully',
        'stats' => [
            'patients_processed' => $patientsProcessed,
            'studies_added' => $studiesAdded,
            'studies_updated' => $studiesUpdated,
            'total_patients' => $totalPatients,
            'total_studies' => $totalStudies
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
