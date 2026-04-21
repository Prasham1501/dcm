<?php
/**
 * Upload Study API
 * Handles DICOM and JPG file uploads to Orthanc server
 * Supports chunked uploads for large files
 *
 * Based on: https://orthanc.uclouvain.be/book/users/rest.html
 * POST /instances endpoint for DICOM uploads
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

// Increase limits for file uploads
ini_set('upload_max_filesize', '500M');
ini_set('post_max_size', '500M');
ini_set('max_execution_time', '600');
ini_set('memory_limit', '512M');

try {
    $action = $_POST['action'] ?? $_GET['action'] ?? 'upload';

    switch ($action) {
        case 'upload':
            handleFileUpload();
            break;
        case 'chunk':
            handleChunkedUpload();
            break;
        case 'finalize':
            handleFinalizeUpload();
            break;
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    error_log("Upload error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Handle regular file upload (for smaller files)
 */
function handleFileUpload() {
    if (!isset($_FILES['file'])) {
        throw new Exception('No file uploaded');
    }

    $file = $_FILES['file'];
    $patientId = $_POST['patient_id'] ?? '';
    $patientName = $_POST['patient_name'] ?? 'Unknown';
    $studyDescription = $_POST['study_description'] ?? 'Uploaded Study';

    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Upload error: ' . getUploadErrorMessage($file['error']));
    }

    $filePath = $file['tmp_name'];
    $fileName = $file['name'];
    $fileType = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    // Process based on file type
    if ($fileType === 'dcm' || isDicomFile($filePath)) {
        $result = uploadDicomToOrthanc($filePath);
    } elseif (in_array($fileType, ['jpg', 'jpeg', 'png'])) {
        $result = convertAndUploadImage($filePath, $fileName, $patientId, $patientName, $studyDescription);
    } elseif ($fileType === 'zip') {
        $result = handleZipUpload($filePath, $patientId, $patientName, $studyDescription);
    } else {
        throw new Exception('Unsupported file type: ' . $fileType);
    }

    echo json_encode($result);
}

/**
 * Handle chunked upload for large files
 */
function handleChunkedUpload() {
    $chunkIndex = intval($_POST['chunk_index'] ?? 0);
    $totalChunks = intval($_POST['total_chunks'] ?? 1);
    $fileId = $_POST['file_id'] ?? uniqid('upload_');

    if (!isset($_FILES['chunk'])) {
        throw new Exception('No chunk data received');
    }

    $uploadDir = sys_get_temp_dir() . '/dicom_uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }

    $chunkPath = $uploadDir . $fileId . '.part' . $chunkIndex;

    if (!move_uploaded_file($_FILES['chunk']['tmp_name'], $chunkPath)) {
        throw new Exception('Failed to save chunk');
    }

    echo json_encode([
        'success' => true,
        'chunk_index' => $chunkIndex,
        'file_id' => $fileId,
        'message' => "Chunk $chunkIndex of $totalChunks received"
    ]);
}

/**
 * Finalize chunked upload - merge chunks and process
 */
function handleFinalizeUpload() {
    $fileId = $_POST['file_id'] ?? '';
    $totalChunks = intval($_POST['total_chunks'] ?? 1);
    $fileName = $_POST['file_name'] ?? 'upload.dcm';
    $patientId = $_POST['patient_id'] ?? '';
    $patientName = $_POST['patient_name'] ?? 'Unknown';
    $studyDescription = $_POST['study_description'] ?? 'Uploaded Study';

    $uploadDir = sys_get_temp_dir() . '/dicom_uploads/';
    $finalPath = $uploadDir . $fileId . '_final';

    // Merge all chunks
    $finalFile = fopen($finalPath, 'wb');
    if (!$finalFile) {
        throw new Exception('Cannot create final file');
    }

    for ($i = 0; $i < $totalChunks; $i++) {
        $chunkPath = $uploadDir . $fileId . '.part' . $i;
        if (!file_exists($chunkPath)) {
            fclose($finalFile);
            throw new Exception("Missing chunk $i");
        }

        $chunkData = file_get_contents($chunkPath);
        fwrite($finalFile, $chunkData);
        unlink($chunkPath); // Clean up chunk
    }
    fclose($finalFile);

    // Process the merged file
    $fileType = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    if ($fileType === 'dcm' || isDicomFile($finalPath)) {
        $result = uploadDicomToOrthanc($finalPath);
    } elseif (in_array($fileType, ['jpg', 'jpeg', 'png'])) {
        $result = convertAndUploadImage($finalPath, $fileName, $patientId, $patientName, $studyDescription);
    } elseif ($fileType === 'zip') {
        $result = handleZipUpload($finalPath, $patientId, $patientName, $studyDescription);
    } else {
        throw new Exception('Unsupported file type');
    }

    // Clean up
    if (file_exists($finalPath)) {
        unlink($finalPath);
    }

    echo json_encode($result);
}

/**
 * Upload DICOM file to Orthanc
 */
function uploadDicomToOrthanc($filePath) {
    $dicomData = file_get_contents($filePath);

    $ch = curl_init(ORTHANC_URL . '/instances');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $dicomData,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/dicom'],
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 300
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("Orthanc connection error: $error");
    }

    if ($httpCode !== 200) {
        throw new Exception("Orthanc rejected the file (HTTP $httpCode)");
    }

    $result = json_decode($response, true);

    // Sync to local database
    syncPatientToDatabase($result['ParentPatient'] ?? null);
    syncStudyToDatabase($result['ParentStudy'] ?? null);

    return [
        'success' => true,
        'message' => 'DICOM file uploaded successfully',
        'orthanc_id' => $result['ID'] ?? null,
        'patient_id' => $result['ParentPatient'] ?? null,
        'study_id' => $result['ParentStudy'] ?? null
    ];
}

/**
 * Convert image (JPG/PNG) to DICOM and upload
 */
function convertAndUploadImage($imagePath, $fileName, $patientId, $patientName, $studyDescription) {
    // Read image
    $imageInfo = getimagesize($imagePath);
    if (!$imageInfo) {
        throw new Exception('Invalid image file');
    }

    $imageData = file_get_contents($imagePath);
    $base64Image = base64_encode($imageData);

    // Determine image type
    $mimeType = $imageInfo['mime'];

    // Create DICOM using Orthanc's REST API
    // POST /tools/create-dicom
    $dicomData = [
        'Tags' => [
            'PatientID' => $patientId ?: 'UPLOAD_' . date('Ymd_His'),
            'PatientName' => $patientName,
            'StudyDescription' => $studyDescription,
            'SeriesDescription' => pathinfo($fileName, PATHINFO_FILENAME),
            'Modality' => 'OT', // Other
            'StudyDate' => date('Ymd'),
            'StudyTime' => date('His'),
            'SeriesDate' => date('Ymd'),
            'SeriesTime' => date('His'),
            'InstanceNumber' => '1',
            'SOPClassUID' => '1.2.840.10008.5.1.4.1.1.7', // Secondary Capture
            'Manufacturer' => 'DICOM Viewer Upload',
            'InstitutionName' => 'Uploaded via Web'
        ],
        'Content' => 'data:' . $mimeType . ';base64,' . $base64Image
    ];

    $ch = curl_init(ORTHANC_URL . '/tools/create-dicom');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($dicomData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 300
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("Orthanc connection error: $error");
    }

    if ($httpCode !== 200) {
        // Orthanc create-dicom failed (likely missing GDCM plugin)
        // Fall back to storing the image directly in local database
        error_log("Orthanc create-dicom failed (HTTP $httpCode), using fallback storage");
        
        return storeImageLocally($imagePath, $fileName, $patientId, $patientName, $studyDescription, $mimeType);
    }

    $result = json_decode($response, true);

    // Sync to local database
    syncPatientToDatabase($result['ParentPatient'] ?? null);
    syncStudyToDatabase($result['ParentStudy'] ?? null);

    return [
        'success' => true,
        'message' => 'Image converted to DICOM and uploaded',
        'orthanc_id' => $result['ID'] ?? null,
        'patient_id' => $result['ParentPatient'] ?? null,
        'study_id' => $result['ParentStudy'] ?? null
    ];
}

/**
 * Store image locally when Orthanc conversion fails
 */
function storeImageLocally($imagePath, $fileName, $patientId, $patientName, $studyDescription, $mimeType) {
    // Generate UIDs
    $studyUid = '1.2.826.0.1.3680043.2.1125.' . time() . '.' . rand(1000, 9999);
    $seriesUid = $studyUid . '.1';
    $instanceUid = $seriesUid . '.1';
    $orthancId = 'local_' . md5($instanceUid);
    
    // Ensure patient ID
    if (empty($patientId)) {
        $patientId = 'PAT_' . date('Ymd_His');
    }
    
    // Create storage directory
    $storageDir = __DIR__ . '/../../uploads/studies/' . $patientId;
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    // Copy file
    $destFile = $storageDir . '/' . $orthancId . '_' . $fileName;
    copy($imagePath, $destFile);
    
    // Store in database
    $mysqli = getDbConnection();
    
    // Insert/update patient
    $stmt = $mysqli->prepare("
        INSERT INTO cached_patients (orthanc_id, patient_id, patient_name, study_count, last_study_date)
        VALUES (?, ?, ?, 1, CURDATE())
        ON DUPLICATE KEY UPDATE 
            study_count = study_count + 1,
            last_study_date = CURDATE(),
            updated_at = NOW()
    ");
    $patientOrthancId = 'local_patient_' . md5($patientId);
    $stmt->bind_param("sss", $patientOrthancId, $patientId, $patientName);
    $stmt->execute();
    $stmt->close();
    
    // Insert study
    $stmt = $mysqli->prepare("
        INSERT INTO cached_studies (study_instance_uid, orthanc_id, patient_id, study_description, study_date, modality, series_count, instance_count, last_synced)
        VALUES (?, ?, ?, ?, CURDATE(), 'OT', 1, 1, NOW())
        ON DUPLICATE KEY UPDATE
            instance_count = instance_count + 1,
            last_synced = NOW()
    ");
    $stmt->bind_param("ssss", $studyUid, $orthancId, $patientId, $studyDescription);
    $stmt->execute();
    $stmt->close();
    
    error_log("Image stored locally: $destFile");
    
    return [
        'success' => true,
        'message' => 'Image stored locally (Orthanc conversion unavailable)',
        'orthanc_id' => $orthancId,
        'patient_id' => $patientId,
        'study_id' => $studyUid,
        'local_storage' => true
    ];
}

/**
 * Handle ZIP file containing multiple DICOM/images
 */
function handleZipUpload($zipPath, $patientId, $patientName, $studyDescription) {
    $uploadedCount = 0;
    $errors = [];

    // First try to upload directly to Orthanc (it can handle ZIP files)
    $zipData = file_get_contents($zipPath);

    $ch = curl_init(ORTHANC_URL . '/instances');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $zipData,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/zip'],
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_TIMEOUT => 600
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $results = json_decode($response, true);
        if (is_array($results)) {
            $uploadedCount = count($results);
            // Sync all unique patients/studies
            $patients = [];
            $studies = [];
            foreach ($results as $result) {
                if (isset($result['ParentPatient'])) $patients[$result['ParentPatient']] = true;
                if (isset($result['ParentStudy'])) $studies[$result['ParentStudy']] = true;
            }
            foreach (array_keys($patients) as $pid) syncPatientToDatabase($pid);
            foreach (array_keys($studies) as $sid) syncStudyToDatabase($sid);
        }
    } else {
        // Fall back to extracting and uploading individually
        $zip = new ZipArchive();
        if ($zip->open($zipPath) !== TRUE) {
            throw new Exception('Cannot open ZIP file');
        }

        $tempDir = sys_get_temp_dir() . '/zip_extract_' . uniqid();
        mkdir($tempDir, 0755, true);
        $zip->extractTo($tempDir);
        $zip->close();

        // Process extracted files
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $ext = strtolower($file->getExtension());
                try {
                    if ($ext === 'dcm' || isDicomFile($file->getPathname())) {
                        uploadDicomToOrthanc($file->getPathname());
                        $uploadedCount++;
                    } elseif (in_array($ext, ['jpg', 'jpeg', 'png'])) {
                        convertAndUploadImage($file->getPathname(), $file->getFilename(), $patientId, $patientName, $studyDescription);
                        $uploadedCount++;
                    }
                } catch (Exception $e) {
                    $errors[] = $file->getFilename() . ': ' . $e->getMessage();
                }
            }
        }

        // Clean up temp directory
        deleteDirectory($tempDir);
    }

    return [
        'success' => $uploadedCount > 0,
        'message' => "Uploaded $uploadedCount files from ZIP",
        'uploaded_count' => $uploadedCount,
        'errors' => $errors
    ];
}

/**
 * Check if file is a DICOM file by reading magic bytes
 */
function isDicomFile($filePath) {
    $handle = fopen($filePath, 'rb');
    if (!$handle) return false;

    // DICOM files have 'DICM' at offset 128
    fseek($handle, 128);
    $magic = fread($handle, 4);
    fclose($handle);

    return $magic === 'DICM';
}

/**
 * Sync patient data from Orthanc to local database
 */
function syncPatientToDatabase($orthancPatientId) {
    if (!$orthancPatientId) return;

    $ch = curl_init(ORTHANC_URL . '/patients/' . $orthancPatientId);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return;

    $data = json_decode($response, true);
    if (!$data) return;

    $patientId = $data['MainDicomTags']['PatientID'] ?? $orthancPatientId;
    $patientName = $data['MainDicomTags']['PatientName'] ?? 'Unknown';
    $birthDate = $data['MainDicomTags']['PatientBirthDate'] ?? null;
    $sex = $data['MainDicomTags']['PatientSex'] ?? null;

    $mysqli = getDbConnection();
    $stmt = $mysqli->prepare("
        INSERT INTO cached_patients (orthanc_id, patient_id, patient_name, patient_birth_date, patient_sex, study_count, last_study_date)
        VALUES (?, ?, ?, ?, ?, 1, CURDATE())
        ON DUPLICATE KEY UPDATE
            patient_name = VALUES(patient_name),
            patient_birth_date = VALUES(patient_birth_date),
            patient_sex = VALUES(patient_sex),
            study_count = study_count + 1,
            last_study_date = CURDATE(),
            updated_at = NOW()
    ");
    $stmt->bind_param("sssss", $orthancPatientId, $patientId, $patientName, $birthDate, $sex);
    $stmt->execute();
    $stmt->close();
}

/**
 * Sync study data from Orthanc to local database
 */
function syncStudyToDatabase($orthancStudyId) {
    if (!$orthancStudyId) return;

    $ch = curl_init(ORTHANC_URL . '/studies/' . $orthancStudyId);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return;

    $data = json_decode($response, true);
    if (!$data) return;

    // Get patient info
    $patientOrthancId = $data['ParentPatient'] ?? '';
    $ch = curl_init(ORTHANC_URL . '/patients/' . $patientOrthancId);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC
    ]);
    $patientResponse = curl_exec($ch);
    curl_close($ch);
    $patientData = json_decode($patientResponse, true);
    $patientId = $patientData['MainDicomTags']['PatientID'] ?? '';

    $studyInstanceUID = $data['MainDicomTags']['StudyInstanceUID'] ?? '';
    $studyDescription = $data['MainDicomTags']['StudyDescription'] ?? 'No Description';
    $studyDate = $data['MainDicomTags']['StudyDate'] ?? date('Ymd');
    $studyTime = $data['MainDicomTags']['StudyTime'] ?? '';
    $accessionNumber = $data['MainDicomTags']['AccessionNumber'] ?? '';

    // Get modalities
    $modalities = [];
    if (isset($data['Series'])) {
        foreach ($data['Series'] as $seriesId) {
            $ch = curl_init(ORTHANC_URL . '/series/' . $seriesId);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_USERPWD => ORTHANC_USER . ':' . ORTHANC_PASS,
                CURLOPT_HTTPAUTH => CURLAUTH_BASIC
            ]);
            $seriesResponse = curl_exec($ch);
            curl_close($ch);
            $seriesData = json_decode($seriesResponse, true);
            if (isset($seriesData['MainDicomTags']['Modality'])) {
                $modalities[] = $seriesData['MainDicomTags']['Modality'];
            }
        }
    }
    $modalitiesStr = implode(',', array_unique($modalities));

    $mysqli = getDbConnection();
    $stmt = $mysqli->prepare("
        INSERT INTO cached_studies (
            orthanc_id, study_instance_uid, patient_id,
            study_description, study_date, study_time,
            accession_number, modality, series_count, instance_count, last_synced
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW())
        ON DUPLICATE KEY UPDATE
            study_description = VALUES(study_description),
            study_date = VALUES(study_date),
            study_time = VALUES(study_time),
            accession_number = VALUES(accession_number),
            modality = VALUES(modality),
            last_synced = NOW()
    ");
    $stmt->bind_param(
        "ssssssss",
        $orthancStudyId, $studyInstanceUID, $patientId,
        $studyDescription, $studyDate, $studyTime,
        $accessionNumber, $modalitiesStr
    );
    $stmt->execute();
    $stmt->close();
}

/**
 * Get upload error message
 */
function getUploadErrorMessage($code) {
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temp folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write to disk',
        UPLOAD_ERR_EXTENSION => 'Upload stopped by extension'
    ];
    return $messages[$code] ?? 'Unknown error';
}

/**
 * Recursively delete directory
 */
function deleteDirectory($dir) {
    if (!is_dir($dir)) return;
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? deleteDirectory($path) : unlink($path);
    }
    rmdir($dir);
}
