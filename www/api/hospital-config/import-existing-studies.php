<?php
/**
 * Hospital Config API - Import Existing Studies with Progress Tracking
 */
// Ensure no output before headers
error_reporting(0);
ini_set('display_errors', 0);

// Start output buffering
ob_start();

define('DICOM_VIEWER', true);

try {
    // Include session management
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

// Clear buffer and set header
ob_end_clean();
header('Content-Type: application/json');

// Check authentication
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Close session to prevent locking (allows progress polling)
session_write_close();

// Increase execution time for large imports
set_time_limit(3600); // 1 hour
ignore_user_abort(true); // Continue even if user closes browser

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $directory = $input['directory'] ?? '';
    $autoBackup = $input['auto_backup'] ?? true;
    
    if (empty($directory)) {
        throw new Exception("Directory path is required");
    }
    
    if (!is_dir($directory)) {
        throw new Exception("Directory does not exist: $directory");
    }
    
    $db = getDbConnection();
    
    // Create import batch ID
    $batchId = 'IMPORT_' . date('Ymd_His') . '_' . substr(md5(uniqid()), 0, 8);
    
    logMessage("Starting import batch: $batchId from $directory", 'info');
    
    // Initialize progress file
    $progressFile = sys_get_temp_dir() . '/dicom_import_' . $batchId . '.json';
    updateProgress($progressFile, 0, 0, 0, 'Scanning directory...', 0, 0);
    
    // Scan for DICOM files
    $files = [];
    scanDicomFiles($directory, $files);
    
    if (empty($files)) {
        updateProgress($progressFile, 0, 0, 0, 'No DICOM files found', 0, 0, 'completed');
        throw new Exception("No DICOM files found in directory");
    }
    
    $totalFiles = count($files);
    $importedCount = 0;
    $errorCount = 0;
    $errors = [];
    
    logMessage("Found $totalFiles DICOM files to import", 'info');
    updateProgress($progressFile, 0, 0, $totalFiles, "Found $totalFiles files", 0, 0, 'importing');
    
    // Import each file
    foreach ($files as $index => $file) {
        $current = $index + 1;
        $progress = ($current / $totalFiles) * 100;
        
        try {
            updateProgress($progressFile, $progress, $current, $totalFiles, 
                          "Importing file $current of $totalFiles", 
                          $importedCount, $errorCount, 'importing', $file['name']);
            
            // Upload to Orthanc
            $uploadResult = uploadToOrthanc($file['path']);
            
            if ($uploadResult['success']) {
                // Record import in database
                $stmt = $db->prepare("
                    INSERT INTO imported_studies 
                    (import_batch_id, file_path, patient_id, patient_name, study_uid, 
                     study_date, modality, orthanc_id, file_size_bytes, backup_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $backupStatus = $autoBackup ? 'pending' : 'backed_up';
                
                $stmt->bind_param('ssssssssis',
                    $batchId,
                    $file['path'],
                    $uploadResult['patient_id'],
                    $uploadResult['patient_name'],
                    $uploadResult['study_uid'],
                    $uploadResult['study_date'],
                    $uploadResult['modality'],
                    $uploadResult['orthanc_id'],
                    $file['size'],
                    $backupStatus
                );
                
                $stmt->execute();
                $stmt->close();
                
                $importedCount++;
            } else {
                $errorCount++;
                $errors[] = "Failed to upload {$file['name']}: {$uploadResult['error']}";
            }
        } catch (Exception $e) {
            $errorCount++;
            $errors[] = "Error importing {$file['name']}: " . $e->getMessage();
            logMessage("Import error for {$file['name']}: " . $e->getMessage(), 'error');
        }
        
        // Small delay to prevent overwhelming the system
        usleep(100000); // 0.1 second
    }
    
    // Update hospital data config
    $updateStmt = $db->prepare("
        UPDATE hospital_data_config 
        SET config_value = ?
        WHERE config_key = 'import_directory_path'
    ");
    $updateStmt->bind_param('s', $directory);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Final progress update
    updateProgress($progressFile, 100, $totalFiles, $totalFiles, 
                  "Import completed: $importedCount successful, $errorCount errors", 
                  $importedCount, $errorCount, 'completed');
    
    logMessage("Import batch $batchId completed: $importedCount files imported, $errorCount errors", 'info');
    
    echo json_encode([
        'success' => true,
        'batch_id' => $batchId,
        'imported_count' => $importedCount,
        'error_count' => $errorCount,
        'total_files' => $totalFiles,
        'errors' => array_slice($errors, 0, 10) // Return first 10 errors only
    ]);
    
} catch (Exception $e) {
    if (isset($progressFile)) {
        updateProgress($progressFile, 0, 0, 0, 'Error: ' . $e->getMessage(), 0, 0, 'error');
    }
    logMessage("Import error: " . $e->getMessage(), 'error');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Update progress file
 */
function updateProgress($file, $progress, $current, $total, $message, $imported, $errors, $status = 'importing', $currentFile = '') {
    $data = [
        'status' => $status,
        'progress' => round($progress, 2),
        'current' => $current,
        'total' => $total,
        'message' => $message,
        'imported_count' => $imported,
        'error_count' => $errors,
        'current_file' => $currentFile,
        'timestamp' => time()
    ];
    file_put_contents($file, json_encode($data));
}

/**
 * Scan directory for DICOM files
 */
function scanDicomFiles($dir, &$files) {
    $items = @scandir($dir);
    if ($items === false) return;
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        
        $path = $dir . DIRECTORY_SEPARATOR . $item;
        
        if (is_dir($path)) {
            scanDicomFiles($path, $files);
        } elseif (is_file($path)) {
            // Simple DICOM detection
            $handle = @fopen($path, 'rb');
            if ($handle) {
                fseek($handle, 128);
                $marker = fread($handle, 4);
                fclose($handle);
                
                if ($marker === 'DICM' || strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'dcm') {
                    $files[] = [
                        'path' => $path,
                        'name' => basename($path),
                        'size' => filesize($path)
                    ];
                }
            }
        }
    }
}

/**
 * Upload DICOM file to Orthanc
 */
function uploadToOrthanc($filepath) {
    $fileContent = file_get_contents($filepath);
    
    $ch = curl_init(ORTHANC_URL . '/instances');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/dicom']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        
        // Get instance details
        $instanceId = $data['ID'] ?? null;
        if ($instanceId) {
            $ch = curl_init(ORTHANC_URL . '/instances/' . $instanceId . '/simplified-tags');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
            
            $tagsResp = curl_exec($ch);
            curl_close($ch);
            
            if ($tagsResp) {
                $tags = json_decode($tagsResp, true);
                
                return [
                    'success' => true,
                    'orthanc_id' => $data['ParentStudy'] ?? $instanceId,
                    'patient_id' => $tags['PatientID'] ?? 'Unknown',
                    'patient_name' => $tags['PatientName'] ?? 'Unknown',
                    'study_uid' => $tags['StudyInstanceUID'] ?? '',
                    'study_date' => $tags['StudyDate'] ?? null,
                    'modality' => $tags['Modality'] ?? 'OT'
                ];
            }
        }
    }
    
    return [
        'success' => false,
        'error' => "HTTP $httpCode - Upload failed"
    ];
}
