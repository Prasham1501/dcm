<?php
/**
 * Auto-Sync API
 * Handles automatic folder monitoring and syncing - SUPPORTS MULTIPLE PATHS
 */
header('Content-Type: application/json');

// Prevent any HTML output before JSON
error_reporting(0);
ini_set('display_errors', 0);

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

try {
    requireLogin();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $db = getDbConnection();
    
    // Ensure tables exist with support for multiple paths
    $db->query("
        CREATE TABLE IF NOT EXISTS monitored_paths (
            id INT AUTO_INCREMENT PRIMARY KEY,
            path VARCHAR(1000) NOT NULL,
            name VARCHAR(255) DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            last_checked DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_path (path(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    
    $db->query("
        CREATE TABLE IF NOT EXISTS known_folders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            folder_path VARCHAR(1000) NOT NULL,
            folder_name VARCHAR(255),
            monitored_path_id INT,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            synced_at DATETIME,
            UNIQUE KEY unique_path (folder_path(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    
    if ($method === 'GET') {
        switch ($action) {
            case 'get_path':
                // Return all active paths (backward compatible - first path as main)
                $result = $db->query("SELECT id, path, name, is_active, last_checked FROM monitored_paths ORDER BY id ASC");
                $paths = [];
                $mainPath = '';
                
                while ($row = $result->fetch_assoc()) {
                    $paths[] = $row;
                    if (empty($mainPath) && $row['is_active']) {
                        $mainPath = $row['path'];
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'path' => $mainPath, // backward compatibility
                    'paths' => $paths    // new: all paths
                ]);
                break;
            
            case 'get_all_paths':
                // Get all monitored paths
                $result = $db->query("SELECT id, path, name, is_active, last_checked, created_at FROM monitored_paths ORDER BY created_at ASC");
                $paths = [];
                
                while ($row = $result->fetch_assoc()) {
                    $paths[] = $row;
                }
                
                echo json_encode([
                    'success' => true,
                    'paths' => $paths
                ]);
                break;
                
            case 'check_folders':
                // Check folders in ALL active monitored paths
                $result = $db->query("SELECT id, path, name FROM monitored_paths WHERE is_active = 1");
                
                if ($result->num_rows === 0) {
                    echo json_encode(['success' => false, 'error' => 'No monitored paths configured']);
                    exit;
                }
                
                $allFolders = [];
                
                while ($row = $result->fetch_assoc()) {
                    $path = $row['path'];
                    $pathId = $row['id'];
                    $pathName = $row['name'] ?: basename($path);
                    
                    if (!is_dir($path)) {
                        continue;
                    }
                    
                    $iterator = new DirectoryIterator($path);
                    
                    foreach ($iterator as $item) {
                        if ($item->isDir() && !$item->isDot()) {
                            $folderPath = $item->getPathname();
                            $folderName = $item->getFilename();
                            
                            // Check if this folder is already known
                            $stmt = $db->prepare("SELECT id FROM known_folders WHERE folder_path = ?");
                            $stmt->bind_param('s', $folderPath);
                            $stmt->execute();
                            $knownResult = $stmt->get_result();
                            $isNew = $knownResult->num_rows === 0;
                            $stmt->close();
                            
                            $allFolders[] = [
                                'name' => $folderName,
                                'path' => $folderPath,
                                'parent_path' => $pathName,
                                'is_new' => $isNew
                            ];
                        }
                    }
                }
                
                echo json_encode([
                    'success' => true,
                    'folders' => $allFolders,
                    'total' => count($allFolders)
                ]);
                break;
                
            case 'check_and_sync':
                // Sync ALL active monitored paths
                $result = $db->query("SELECT id, path, name FROM monitored_paths WHERE is_active = 1");
                
                if ($result->num_rows === 0) {
                    echo json_encode(['success' => true, 'new_folders' => [], 'message' => 'No monitored paths configured']);
                    exit;
                }
                
                $newFolders = [];
                $pathsChecked = 0;
                
                while ($row = $result->fetch_assoc()) {
                    $path = $row['path'];
                    $pathId = $row['id'];
                    $pathName = $row['name'] ?: basename($path);
                    
                    if (!is_dir($path)) {
                        continue;
                    }
                    
                    $pathsChecked++;
                    $iterator = new DirectoryIterator($path);
                    
                    foreach ($iterator as $item) {
                        if ($item->isDir() && !$item->isDot()) {
                            $folderPath = $item->getPathname();
                            $folderName = $item->getFilename();
                            
                            // Check if this folder is already known
                            $stmt = $db->prepare("SELECT id FROM known_folders WHERE folder_path = ?");
                            $stmt->bind_param('s', $folderPath);
                            $stmt->execute();
                            $knownResult = $stmt->get_result();
                            
                            if ($knownResult->num_rows === 0) {
                                // This is a new folder
                                $newFolders[] = [
                                    'name' => $folderName,
                                    'path' => $folderPath,
                                    'parent_path' => $pathName,
                                    'is_new' => true
                                ];
                                
                                // Add to known folders
                                $insertStmt = $db->prepare("INSERT INTO known_folders (folder_path, folder_name, monitored_path_id) VALUES (?, ?, ?)");
                                $insertStmt->bind_param('ssi', $folderPath, $folderName, $pathId);
                                $insertStmt->execute();
                                $insertStmt->close();
                            }
                            $stmt->close();
                        }
                    }
                    
                    // Update last checked time
                    $db->query("UPDATE monitored_paths SET last_checked = NOW() WHERE id = $pathId");
                }
                
                echo json_encode([
                    'success' => true,
                    'new_folders' => $newFolders,
                    'total_new' => count($newFolders),
                    'paths_checked' => $pathsChecked
                ]);
                break;

            case 'sync_missing_files':
                // Scan for DICOM files and import those not in database
                $result = $db->query("SELECT id, path, name FROM monitored_paths WHERE is_active = 1");

                if ($result->num_rows === 0) {
                    echo json_encode(['success' => false, 'error' => 'No monitored paths configured']);
                    exit;
                }

                $allDicomFiles = [];
                $pathsScanned = 0;

                while ($row = $result->fetch_assoc()) {
                    $path = $row['path'];

                    if (!is_dir($path)) {
                        continue;
                    }

                    $pathsScanned++;
                    scanDicomFilesRecursive($path, $allDicomFiles);
                }

                // Filter out files that are already imported
                $newFiles = [];
                foreach ($allDicomFiles as $file) {
                    $stmt = $db->prepare("SELECT id FROM imported_studies WHERE file_path = ?");
                    $stmt->bind_param('s', $file['path']);
                    $stmt->execute();
                    $exists = $stmt->get_result()->fetch_assoc();
                    $stmt->close();

                    if (!$exists) {
                        $newFiles[] = $file;
                    }
                }

                echo json_encode([
                    'success' => true,
                    'total_files_found' => count($allDicomFiles),
                    'new_files' => count($newFiles),
                    'paths_scanned' => $pathsScanned,
                    'files' => array_slice($newFiles, 0, 100) // Return first 100 for preview
                ]);
                break;

            case 'import_missing_files':
                // Import all missing DICOM files from monitored paths
                set_time_limit(3600); // 1 hour for large imports

                $result = $db->query("SELECT id, path, name FROM monitored_paths WHERE is_active = 1");

                if ($result->num_rows === 0) {
                    echo json_encode(['success' => false, 'error' => 'No monitored paths configured']);
                    exit;
                }

                $allDicomFiles = [];

                while ($row = $result->fetch_assoc()) {
                    $path = $row['path'];
                    if (is_dir($path)) {
                        scanDicomFilesRecursive($path, $allDicomFiles);
                    }
                }

                // Create batch ID
                $batchId = 'AUTO_SYNC_' . date('Ymd_His');

                $importedCount = 0;
                $skippedCount = 0;
                $errorCount = 0;

                foreach ($allDicomFiles as $file) {
                    // Check if already imported
                    $stmt = $db->prepare("SELECT id FROM imported_studies WHERE file_path = ?");
                    $stmt->bind_param('s', $file['path']);
                    $stmt->execute();
                    $exists = $stmt->get_result()->fetch_assoc();
                    $stmt->close();

                    if ($exists) {
                        $skippedCount++;
                        continue;
                    }

                    try {
                        // Upload to Orthanc
                        $uploadResult = uploadToOrthanc($file['path']);

                        if ($uploadResult['success']) {
                            // Record import
                            $stmt = $db->prepare("
                                INSERT INTO imported_studies
                                (import_batch_id, file_path, patient_id, patient_name, study_uid,
                                 study_date, modality, orthanc_id, file_size_bytes, backup_status)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                            ");

                            $stmt->bind_param('ssssssssi',
                                $batchId,
                                $file['path'],
                                $uploadResult['patient_id'],
                                $uploadResult['patient_name'],
                                $uploadResult['study_uid'],
                                $uploadResult['study_date'],
                                $uploadResult['modality'],
                                $uploadResult['orthanc_id'],
                                $file['size']
                            );

                            $stmt->execute();
                            $stmt->close();
                            $importedCount++;
                        } else {
                            $errorCount++;
                        }
                    } catch (Exception $e) {
                        $errorCount++;
                    }

                    // Small delay to prevent overload
                    usleep(50000); // 0.05 seconds
                }

                echo json_encode([
                    'success' => true,
                    'batch_id' => $batchId,
                    'total_files' => count($allDicomFiles),
                    'imported' => $importedCount,
                    'skipped' => $skippedCount,
                    'errors' => $errorCount
                ]);
                break;

            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    } 
    elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $postAction = $input['action'] ?? $action;
        
        switch ($postAction) {
            case 'save_path':
            case 'add_path':
                $path = trim($input['path'] ?? '');
                $name = trim($input['name'] ?? '');
                
                if (empty($path)) {
                    echo json_encode(['success' => false, 'error' => 'Path cannot be empty']);
                    exit;
                }
                
                // Validate path exists
                if (!is_dir($path)) {
                    echo json_encode(['success' => false, 'error' => 'Directory does not exist: ' . $path]);
                    exit;
                }
                
                // If no name provided, use folder name
                if (empty($name)) {
                    $name = basename($path);
                }
                
                // Check if path already exists
                $stmt = $db->prepare("SELECT id FROM monitored_paths WHERE path = ?");
                $stmt->bind_param('s', $path);
                $stmt->execute();
                $existing = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                
                if ($existing) {
                    // Update existing path
                    $stmt = $db->prepare("UPDATE monitored_paths SET name = ?, is_active = 1 WHERE id = ?");
                    $stmt->bind_param('si', $name, $existing['id']);
                    $stmt->execute();
                    $stmt->close();
                    echo json_encode(['success' => true, 'message' => 'Path updated successfully', 'id' => $existing['id']]);
                } else {
                    // Insert new path
                    $stmt = $db->prepare("INSERT INTO monitored_paths (path, name, is_active) VALUES (?, ?, 1)");
                    $stmt->bind_param('ss', $path, $name);
                    
                    if ($stmt->execute()) {
                        echo json_encode(['success' => true, 'message' => 'Path added successfully', 'id' => $stmt->insert_id]);
                    } else {
                        echo json_encode(['success' => false, 'error' => 'Failed to save path']);
                    }
                    $stmt->close();
                }
                break;
                
            case 'remove_path':
                $pathId = intval($input['id'] ?? 0);
                
                if ($pathId <= 0) {
                    echo json_encode(['success' => false, 'error' => 'Invalid path ID']);
                    exit;
                }
                
                // Delete the path
                $stmt = $db->prepare("DELETE FROM monitored_paths WHERE id = ?");
                $stmt->bind_param('i', $pathId);
                
                if ($stmt->execute()) {
                    echo json_encode(['success' => true, 'message' => 'Path removed successfully']);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Failed to remove path']);
                }
                $stmt->close();
                break;
                
            case 'toggle_path':
                $pathId = intval($input['id'] ?? 0);
                $isActive = intval($input['is_active'] ?? 1);
                
                if ($pathId <= 0) {
                    echo json_encode(['success' => false, 'error' => 'Invalid path ID']);
                    exit;
                }
                
                $stmt = $db->prepare("UPDATE monitored_paths SET is_active = ? WHERE id = ?");
                $stmt->bind_param('ii', $isActive, $pathId);
                
                if ($stmt->execute()) {
                    echo json_encode(['success' => true, 'message' => $isActive ? 'Path activated' : 'Path deactivated']);
                } else {
                    echo json_encode(['success' => false, 'error' => 'Failed to update path']);
                }
                $stmt->close();
                break;
                
            default:
                echo json_encode(['success' => false, 'error' => 'Invalid action']);
        }
    }
    elseif ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $pathId = intval($input['id'] ?? $_GET['id'] ?? 0);
        
        if ($pathId <= 0) {
            echo json_encode(['success' => false, 'error' => 'Invalid path ID']);
            exit;
        }
        
        $stmt = $db->prepare("DELETE FROM monitored_paths WHERE id = ?");
        $stmt->bind_param('i', $pathId);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Path removed successfully']);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to remove path']);
        }
        $stmt->close();
    }
    else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Recursively scan directory for DICOM files
 */
function scanDicomFilesRecursive($dir, &$files) {
    $items = @scandir($dir);
    if ($items === false) return;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;

        $path = $dir . DIRECTORY_SEPARATOR . $item;

        if (is_dir($path)) {
            scanDicomFilesRecursive($path, $files);
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
    try {
        $fileContent = @file_get_contents($filepath);
        if ($fileContent === false) {
            return ['success' => false, 'error' => 'Failed to read file'];
        }

        $ch = curl_init(ORTHANC_URL . '/instances');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/dicom']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);

            if (!$data || !isset($data['ID'])) {
                return ['success' => false, 'error' => 'Invalid Orthanc response'];
            }

            $instanceId = $data['ID'];

            // Get patient and study info
            $ch = curl_init(ORTHANC_URL . '/instances/' . $instanceId . '/tags?simplify');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

            $tagsResponse = curl_exec($ch);
            curl_close($ch);

            $tags = json_decode($tagsResponse, true);

            return [
                'success' => true,
                'orthanc_id' => $instanceId,
                'patient_id' => $tags['PatientID'] ?? 'UNKNOWN',
                'patient_name' => $tags['PatientName'] ?? 'UNKNOWN',
                'study_uid' => $tags['StudyInstanceUID'] ?? '',
                'study_date' => $tags['StudyDate'] ?? null,
                'modality' => $tags['Modality'] ?? 'OT'
            ];
        } else {
            return [
                'success' => false,
                'error' => $curlError ?: "HTTP $httpCode"
            ];
        }
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}
