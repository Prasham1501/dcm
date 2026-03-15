<?php
ob_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/load_study_debug.log');

header('Content-Type: application/json');

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../includes/config.php';
    require_once __DIR__ . '/../auth/session.php';

    // Validate session
    if (!isLoggedIn()) {
        ob_clean();
        http_response_code(401);
        die(json_encode(['success' => false, 'error' => 'Unauthorized']));
    }

    $studyUIDParam = $_GET['studyUID'] ?? '';
    $orthancIdParam = $_GET['orthanc_id'] ?? '';

    if (empty($studyUIDParam) && empty($orthancIdParam)) {
        ob_clean();
        http_response_code(400);
        die(json_encode(['success' => false, 'error' => 'Study UID required']));
    }

    // Handle comma-separated list
    $rawIds = !empty($studyUIDParam) ? $studyUIDParam : $orthancIdParam;
    $idList = explode(',', $rawIds);
    $idList = array_map('trim', $idList);
    $idList = array_filter($idList); // remove empty

    if (empty($idList)) {
        ob_clean();
        http_response_code(400);
        die(json_encode(['success' => false, 'error' => 'No valid Study IDs provided']));
    }

    $allImages = [];
    $firstStudyInfo = null;
    $combinedPatientName = '';
    $mergedDescription = [];

    $mysqli = getDbConnection();

    foreach ($idList as $currentId) {
        // Get study info from database (including merged_orthanc_ids for merged studies)
        $stmt = $mysqli->prepare("
            SELECT cs.orthanc_id, cs.study_instance_uid, cs.study_description,
                   cs.instance_count, cp.patient_name, cp.patient_id, cs.merged_orthanc_ids
            FROM cached_studies cs
            LEFT JOIN cached_patients cp ON cs.patient_id = cp.patient_id
            WHERE cs.orthanc_id = ? OR cs.study_instance_uid = ?
            LIMIT 1
        ");

        $stmt->bind_param('ss', $currentId, $currentId);
        $stmt->execute();
        $result = $stmt->get_result();
        $studyInfo = $result->fetch_assoc();
        $stmt->close();

        if (!$studyInfo) {
            continue; // Skip invalid IDs but try others
        }

        if (!$firstStudyInfo) {
            $firstStudyInfo = $studyInfo;
        }
        
        // Accumulate descriptions
        if (!empty($studyInfo['study_description'])) {
            $mergedDescription[] = $studyInfo['study_description'];
        }

        $orthancStudyId = $studyInfo['orthanc_id'];
        
        // Load instances from main Orthanc study
        try {
            $studyImages = loadFromOrthanc($orthancStudyId, $studyInfo);
            $allImages = array_merge($allImages, $studyImages);
        } catch (Exception $e) {
            error_log("Failed to load study $currentId: " . $e->getMessage());
        }

        // Also load images from merged studies if this is a merged study
        if (!empty($studyInfo['merged_orthanc_ids'])) {
            $mergedIds = explode(',', $studyInfo['merged_orthanc_ids']);
            foreach ($mergedIds as $mergedOrthancId) {
                $mergedOrthancId = trim($mergedOrthancId);
                if (!empty($mergedOrthancId)) {
                    try {
                        $mergedImages = loadFromOrthanc($mergedOrthancId, $studyInfo);
                        $allImages = array_merge($allImages, $mergedImages);
                    } catch (Exception $e) {
                        error_log("Failed to load merged study $mergedOrthancId: " . $e->getMessage());
                    }
                }
            }
        }
    }

    if (empty($allImages)) {
        ob_clean();
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'No DICOM files found',
            'message' => 'No instances found for provided IDs',
            'studyId' => $rawIds
        ]);
        exit;
    }

    // Create a merged response
    $response = [
        'success' => true,
        // Use the first study's UID/ID as primary reference, or a combined string
        'studyUID' => $firstStudyInfo['study_instance_uid'], 
        'orthancId' => $firstStudyInfo['orthanc_id'],
        'studyDescription' => !empty($mergedDescription) ? implode(' + ', array_unique($mergedDescription)) : (count($idList) > 1 ? 'Merged Study' : ''),
        'patientName' => $firstStudyInfo['patient_name'],
        'images' => $allImages,
        'totalImages' => count($allImages),
        'imageCount' => count($allImages),
        'source' => 'orthanc_direct',
        'isMerged' => count($idList) > 1
    ];

    ob_clean();
    echo json_encode($response);

} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function loadFromOrthanc($orthancStudyId, $studyInfo) {
    $orthancUrl = ORTHANC_URL;
    $orthancUser = ORTHANC_USER;
    $orthancPass = ORTHANC_PASS;

    if (empty($orthancUrl)) {
        throw new Exception('Orthanc not configured');
    }

    $studyData = fetchOrthancData("{$orthancUrl}/studies/{$orthancStudyId}", $orthancUser, $orthancPass);

    if (!$studyData) {
        throw new Exception('Study not found in Orthanc');
    }

    $images = [];

    if (isset($studyData['Series']) && is_array($studyData['Series'])) {
        foreach ($studyData['Series'] as $seriesId) {
            $seriesData = fetchOrthancData("{$orthancUrl}/series/{$seriesId}", $orthancUser, $orthancPass);

            if ($seriesData && isset($seriesData['Instances'])) {
                $seriesDesc = $seriesData['MainDicomTags']['SeriesDescription'] ?? 'Series';
                $seriesUID = $seriesData['MainDicomTags']['SeriesInstanceUID'] ?? $seriesId;
                $seriesNumber = $seriesData['MainDicomTags']['SeriesNumber'] ?? 0;

                foreach ($seriesData['Instances'] as $instanceId) {
                    $instanceData = fetchOrthancData("{$orthancUrl}/instances/{$instanceId}", $orthancUser, $orthancPass);

                    if ($instanceData) {
                        $images[] = [
                            'instanceId' => $instanceId,
                            'orthancInstanceId' => $instanceId,
                            'seriesInstanceUID' => $seriesUID,
                            'sopInstanceUID' => $instanceData['MainDicomTags']['SOPInstanceUID'] ?? $instanceId,
                            'instanceNumber' => intval($instanceData['MainDicomTags']['InstanceNumber'] ?? 0),
                            'seriesDescription' => $seriesDesc,
                            'seriesNumber' => intval($seriesNumber),
                            'patientName' => $studyInfo['patient_name'],
                            'studyInstanceUID' => $studyInfo['study_instance_uid'], // Explicitly add StudyUID
                            'useApiGateway' => false,
                            'isOrthancImage' => true
                        ];
                    }
                }
            }
        }
    }

    // Sort valid for single study, but for merged, might want to resort by study then series
    usort($images, function($a, $b) {
        $seriesCompare = $a['seriesNumber'] - $b['seriesNumber'];
        if ($seriesCompare !== 0) return $seriesCompare;
        return $a['instanceNumber'] - $b['instanceNumber'];
    });

    return $images;
}

function fetchOrthancData($url, $user, $pass) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "{$user}:{$pass}");
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $result) {
        return json_decode($result, true);
    }
    return null;
}
