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

    // Create imported_studies table for tracking imported files
    $db->query("
        CREATE TABLE IF NOT EXISTS imported_studies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            import_batch_id VARCHAR(100),
            file_path VARCHAR(1000) NOT NULL,
            file_hash VARCHAR(64),
            patient_id VARCHAR(255),
            patient_name VARCHAR(255),
            study_uid VARCHAR(255),
            study_date VARCHAR(20),
            modality VARCHAR(20),
            orthanc_id VARCHAR(255),
            file_size_bytes BIGINT,
            backup_status VARCHAR(50) DEFAULT 'pending',
            imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_file (file_path(255)),
            KEY idx_study_uid (study_uid(100)),
            KEY idx_patient_id (patient_id(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Add imported_at column if it doesn't exist (for existing tables)
    $result = $db->query("SHOW COLUMNS FROM imported_studies LIKE 'imported_at'");
    if ($result && $result->num_rows === 0) {
        $db->query("ALTER TABLE imported_studies ADD COLUMN imported_at DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    // Create cached_patients table if not exists
    $db->query("
        CREATE TABLE IF NOT EXISTS cached_patients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            orthanc_id VARCHAR(255),
            patient_id VARCHAR(255) NOT NULL,
            patient_name VARCHAR(255),
            patient_birth_date DATE,
            patient_sex VARCHAR(10),
            study_count INT DEFAULT 0,
            last_study_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_patient (patient_id(100)),
            KEY idx_orthanc (orthanc_id(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // Create cached_studies table if not exists
    $db->query("
        CREATE TABLE IF NOT EXISTS cached_studies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            study_instance_uid VARCHAR(255) NOT NULL,
            orthanc_id VARCHAR(255),
            patient_id VARCHAR(255),
            study_date DATE,
            study_time TIME,
            study_description VARCHAR(255),
            accession_number VARCHAR(100),
            modality VARCHAR(20),
            series_count INT DEFAULT 0,
            instance_count INT DEFAULT 0,
            is_starred TINYINT(1) DEFAULT 0,
            remarks TEXT,
            last_synced DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_study (study_instance_uid(100)),
            KEY idx_patient (patient_id(100)),
            KEY idx_orthanc (orthanc_id(100)),
            KEY idx_date (study_date)
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

                // First check if Orthanc is running
                $orthancCheck = @file_get_contents(ORTHANC_URL . '/system', false, stream_context_create([
                    'http' => [
                        'timeout' => 3,
                        'header' => 'Authorization: Basic ' . base64_encode(ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD)
                    ]
                ]));

                if ($orthancCheck === false) {
                    echo json_encode([
                        'success' => false,
                        'error' => 'Orthanc server is not running or not accessible at ' . ORTHANC_URL . '. Please start Orthanc first.',
                        'orthanc_url' => ORTHANC_URL
                    ]);
                    exit;
                }

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
                $errorMessages = [];

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
                            // Generate fallback study_uid if empty
                            $studyUid = $uploadResult['study_uid'];
                            if (empty($studyUid)) {
                                $studyUid = 'GENERATED.' . md5($file['path'] . '.' . $uploadResult['orthanc_id']);
                            }

                            // Record import using INSERT ... ON DUPLICATE KEY UPDATE
                            $stmt = $db->prepare("
                                INSERT INTO imported_studies
                                (import_batch_id, file_path, patient_id, patient_name, study_uid,
                                 study_date, modality, orthanc_id, file_size_bytes, backup_status)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                                ON DUPLICATE KEY UPDATE
                                import_batch_id = VALUES(import_batch_id),
                                patient_id = VALUES(patient_id),
                                patient_name = VALUES(patient_name),
                                study_uid = VALUES(study_uid),
                                orthanc_id = VALUES(orthanc_id),
                                imported_at = NOW()
                            ");

                            $stmt->bind_param('ssssssssi',
                                $batchId,
                                $file['path'],
                                $uploadResult['patient_id'],
                                $uploadResult['patient_name'],
                                $studyUid,
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
                            $errorMessages[] = basename($file['path']) . ': ' . ($uploadResult['error'] ?? 'Unknown error');
                        }
                    } catch (Exception $e) {
                        $errorCount++;
                        $errorMessages[] = basename($file['path']) . ': ' . $e->getMessage();
                    }

                    // Small delay to prevent overload
                    usleep(50000); // 0.05 seconds
                }

                // After importing, sync Orthanc data to cached tables
                if ($importedCount > 0) {
                    syncOrthancToCache($db);
                }

                echo json_encode([
                    'success' => true,
                    'batch_id' => $batchId,
                    'total_files' => count($allDicomFiles),
                    'imported' => $importedCount,
                    'skipped' => $skippedCount,
                    'errors' => $errorCount,
                    'error_messages' => array_slice($errorMessages, 0, 10) // Return first 10 errors
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
 * Improved detection: checks DICM marker, .dcm extension, and common DICOM file patterns
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
            if (isDicomFile($path)) {
                $files[] = [
                    'path' => $path,
                    'name' => basename($path),
                    'size' => filesize($path)
                ];
            }
        }
    }
}

/**
 * Check if a file is a DICOM file
 * Uses multiple detection methods for better accuracy
 */
function isDicomFile($path) {
    $filename = basename($path);
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    // Skip known non-DICOM files
    $skipExtensions = ['txt', 'xml', 'json', 'html', 'htm', 'css', 'js', 'php',
                       'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'pdf', 'doc',
                       'docx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'tar', 'gz',
                       'exe', 'dll', 'bat', 'sh', 'log', 'ini', 'cfg', 'md'];

    if (in_array($extension, $skipExtensions)) {
        return false;
    }

    // Skip hidden files and system files
    if (strpos($filename, '.') === 0 || $filename === 'DICOMDIR') {
        return false;
    }

    // Check file size - DICOM files are usually at least 1KB
    $fileSize = @filesize($path);
    if ($fileSize === false || $fileSize < 1024) {
        return false;
    }

    // Method 1: Check for DICM marker at byte 128 (standard DICOM with preamble)
    $handle = @fopen($path, 'rb');
    if (!$handle) {
        return false;
    }

    // Check for DICM marker
    fseek($handle, 128);
    $marker = fread($handle, 4);

    if ($marker === 'DICM') {
        fclose($handle);
        return true;
    }

    // Method 2: Check for .dcm extension
    if ($extension === 'dcm') {
        fclose($handle);
        return true;
    }

    // Method 3: Check for DICOM without preamble (older format)
    // Look for group/element tag pattern at the start of the file
    fseek($handle, 0);
    $header = fread($handle, 8);
    fclose($handle);

    if (strlen($header) >= 8) {
        // Check for common DICOM group tags at start (little endian)
        // Group 0002 (File Meta Information) or Group 0008 (Identifying Information)
        $group = unpack('v', substr($header, 0, 2))[1] ?? 0;

        if ($group === 0x0002 || $group === 0x0008) {
            return true;
        }
    }

    // Method 4: Files without extension in DICOM-like directory structure
    // Many PACS systems store files without extensions
    if (empty($extension) || is_numeric($filename)) {
        // Check if parent directory looks like a DICOM series
        $parentDir = dirname($path);
        $parentName = basename($parentDir);

        // Series directories are often numeric or contain study/series keywords
        if (is_numeric($parentName) ||
            preg_match('/^(series|study|image|slice|img|dcm)/i', $parentName) ||
            preg_match('/^[0-9]+\.[0-9]+/', $parentName)) {

            // Do a quick content check - look for DICOM-like binary structure
            $handle = @fopen($path, 'rb');
            if ($handle) {
                // Read more of the file to look for DICOM tags
                fseek($handle, 0);
                $content = fread($handle, 512);
                fclose($handle);

                // Look for common DICOM tag patterns
                if (strpos($content, 'UI') !== false || // UID Value Representation
                    strpos($content, 'CS') !== false || // Code String
                    strpos($content, 'PN') !== false || // Patient Name
                    strpos($content, 'DA') !== false || // Date
                    strpos($content, 'TM') !== false) { // Time
                    return true;
                }
            }
        }
    }

    return false;
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

/**
 * Sync data from Orthanc to cached_patients and cached_studies tables
 */
function syncOrthancToCache($db) {
    try {
        // Get all patients from Orthanc
        $ch = curl_init(ORTHANC_URL . '/patients');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            return false;
        }

        $patients = json_decode($response, true);
        if (!is_array($patients)) {
            return false;
        }

        foreach ($patients as $patientOrthancId) {
            // Get patient details
            $ch = curl_init(ORTHANC_URL . '/patients/' . $patientOrthancId);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

            $patientResponse = curl_exec($ch);
            curl_close($ch);

            $patientData = json_decode($patientResponse, true);
            if (!$patientData) continue;

            $patientId = $patientData['MainDicomTags']['PatientID'] ?? 'UNKNOWN';
            $patientName = $patientData['MainDicomTags']['PatientName'] ?? 'Unknown';
            $birthDate = $patientData['MainDicomTags']['PatientBirthDate'] ?? null;
            $sex = $patientData['MainDicomTags']['PatientSex'] ?? null;

            // Format birth date
            if ($birthDate && strlen($birthDate) === 8) {
                $birthDate = substr($birthDate, 0, 4) . '-' . substr($birthDate, 4, 2) . '-' . substr($birthDate, 6, 2);
            } else {
                $birthDate = null;
            }

            // Use INSERT ... ON DUPLICATE KEY UPDATE to handle duplicates gracefully
            $stmt = $db->prepare("
                INSERT INTO cached_patients
                (orthanc_id, patient_id, patient_name, patient_birth_date, patient_sex, study_count, last_study_date)
                VALUES (?, ?, ?, ?, ?, 0, CURDATE())
                ON DUPLICATE KEY UPDATE
                orthanc_id = VALUES(orthanc_id),
                patient_name = VALUES(patient_name),
                patient_birth_date = VALUES(patient_birth_date),
                patient_sex = VALUES(patient_sex),
                updated_at = NOW()
            ");
            $stmt->bind_param('sssss', $patientOrthancId, $patientId, $patientName, $birthDate, $sex);
            $stmt->execute();
            $stmt->close();

            // Process studies for this patient
            $studies = $patientData['Studies'] ?? [];

            foreach ($studies as $studyOrthancId) {
                // Get study details
                $ch = curl_init(ORTHANC_URL . '/studies/' . $studyOrthancId);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
                curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

                $studyResponse = curl_exec($ch);
                curl_close($ch);

                $studyData = json_decode($studyResponse, true);
                if (!$studyData) continue;

                $studyUID = $studyData['MainDicomTags']['StudyInstanceUID'] ?? null;

                // Skip studies without a valid StudyInstanceUID or generate a fallback
                if (empty($studyUID)) {
                    // Generate a fallback UID based on patient ID and study date
                    $fallbackDate = $studyData['MainDicomTags']['StudyDate'] ?? date('Ymd');
                    $studyUID = 'GENERATED.' . md5($patientId . '.' . $studyOrthancId . '.' . $fallbackDate);
                }

                $studyDate = $studyData['MainDicomTags']['StudyDate'] ?? null;
                $studyTime = $studyData['MainDicomTags']['StudyTime'] ?? null;
                $studyDesc = $studyData['MainDicomTags']['StudyDescription'] ?? 'PACS Study';
                $accessionNumber = $studyData['MainDicomTags']['AccessionNumber'] ?? null;

                // Get modality from first series
                $modality = 'OT';
                $seriesCount = count($studyData['Series'] ?? []);
                $instanceCount = 0;

                if (isset($studyData['Series']) && count($studyData['Series']) > 0) {
                    $ch = curl_init(ORTHANC_URL . '/series/' . $studyData['Series'][0]);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
                    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

                    $seriesResponse = curl_exec($ch);
                    curl_close($ch);

                    $seriesData = json_decode($seriesResponse, true);
                    if ($seriesData) {
                        $modality = $seriesData['MainDicomTags']['Modality'] ?? 'OT';
                    }
                }

                // Count instances
                foreach ($studyData['Series'] ?? [] as $seriesId) {
                    $ch = curl_init(ORTHANC_URL . '/series/' . $seriesId);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);
                    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

                    $seriesResponse = curl_exec($ch);
                    curl_close($ch);

                    $seriesData = json_decode($seriesResponse, true);
                    if ($seriesData) {
                        $instanceCount += count($seriesData['Instances'] ?? []);
                    }
                }

                // Format dates
                if ($studyDate && strlen($studyDate) === 8) {
                    $studyDate = substr($studyDate, 0, 4) . '-' . substr($studyDate, 4, 2) . '-' . substr($studyDate, 6, 2);
                } else {
                    $studyDate = date('Y-m-d');
                }

                if ($studyTime && strlen($studyTime) >= 6) {
                    $studyTime = substr($studyTime, 0, 2) . ':' . substr($studyTime, 2, 2) . ':' . substr($studyTime, 4, 2);
                } else {
                    $studyTime = date('H:i:s');
                }

                // Use INSERT ... ON DUPLICATE KEY UPDATE to handle duplicates gracefully
                $stmt = $db->prepare("
                    INSERT INTO cached_studies
                    (study_instance_uid, orthanc_id, patient_id, study_date, study_time, study_description, accession_number, modality, series_count, instance_count, last_synced)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                    orthanc_id = VALUES(orthanc_id),
                    patient_id = VALUES(patient_id),
                    study_date = VALUES(study_date),
                    study_time = VALUES(study_time),
                    study_description = VALUES(study_description),
                    accession_number = VALUES(accession_number),
                    modality = VALUES(modality),
                    series_count = VALUES(series_count),
                    instance_count = VALUES(instance_count),
                    last_synced = NOW()
                ");
                $stmt->bind_param('ssssssssii', $studyUID, $studyOrthancId, $patientId, $studyDate, $studyTime, $studyDesc, $accessionNumber, $modality, $seriesCount, $instanceCount);
                $stmt->execute();
                $stmt->close();
            }
        }

        // Update patient study counts
        $db->query("
            UPDATE cached_patients cp
            SET study_count = (
                SELECT COUNT(*) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id
            ),
            last_study_date = (
                SELECT MAX(study_date) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id
            )
        ");

        return true;
    } catch (Exception $e) {
        error_log('syncOrthancToCache error: ' . $e->getMessage());
        return false;
    }
}
