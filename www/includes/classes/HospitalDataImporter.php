<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Hospital Data Importer Class
 *
 * Handles importing DICOM files from hospital data directories to Orthanc
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load configuration
require_once __DIR__ . '/../config.php';

class HospitalDataImporter {
    private $db;
    private $orthancUrl;
    private $orthancUsername;
    private $orthancPassword;

    /**
     * Constructor
     */
    public function __construct() {
        $this->db = getDbConnection();
        $this->orthancUrl = ORTHANC_URL;
        $this->orthancUsername = ORTHANC_USERNAME;
        $this->orthancPassword = ORTHANC_PASSWORD;
    }

    /**
     * Recursively scan directory for DICOM files
     *
     * @param string $path Directory path to scan
     * @return array Array of file information
     */
    public function scanDirectory($path) {
        $files = [];
        $totalSize = 0;

        if (!is_dir($path)) {
            logMessage("Directory does not exist: {$path}", 'error', 'import.log');
            return ['files' => $files, 'total_size' => $totalSize, 'error' => 'Directory does not exist'];
        }

        if (!is_readable($path)) {
            logMessage("Directory is not readable: {$path}", 'error', 'import.log');
            return ['files' => $files, 'total_size' => $totalSize, 'error' => 'Directory is not readable'];
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $filepath = $file->getRealPath();

                    // Check if file is a DICOM file
                    if ($this->isDicomFile($filepath)) {
                        $fileSize = $file->getSize();
                        $files[] = [
                            'path' => $filepath,
                            'name' => $file->getFilename(),
                            'size' => $fileSize,
                            'modified' => $file->getMTime()
                        ];
                        $totalSize += $fileSize;
                    }
                }
            }

            logMessage("Scanned directory {$path}: Found " . count($files) . " DICOM files", 'info', 'import.log');

        } catch (Exception $e) {
            logMessage("Error scanning directory {$path}: " . $e->getMessage(), 'error', 'import.log');
            return ['files' => $files, 'total_size' => $totalSize, 'error' => $e->getMessage()];
        }

        return ['files' => $files, 'total_size' => $totalSize];
    }

    /**
     * Check if file is a DICOM file
     *
     * @param string $filepath Path to file
     * @return bool True if DICOM file
     */
    public function isDicomFile($filepath) {
        // Check file extension first (performance optimization)
        $extension = strtolower(pathinfo($filepath, PATHINFO_EXTENSION));

        // Common DICOM extensions
        $dicomExtensions = ['dcm', 'dicom', 'dic'];

        // If file has .dcm extension, check for DICM header
        if (in_array($extension, $dicomExtensions)) {
            return $this->checkDicmHeader($filepath);
        }

        // For files without extension or unknown extensions, check DICM header
        // This catches headerless DICOM files or files with non-standard extensions
        if (filesize($filepath) > 132) {
            return $this->checkDicmHeader($filepath);
        }

        return false;
    }

    /**
     * Check for DICM header at byte 128
     *
     * @param string $filepath Path to file
     * @return bool True if DICM header found
     */
    private function checkDicmHeader($filepath) {
        if (!is_readable($filepath)) {
            return false;
        }

        $handle = fopen($filepath, 'rb');
        if (!$handle) {
            return false;
        }

        // Seek to byte 128
        fseek($handle, 128);

        // Read 4 bytes
        $header = fread($handle, 4);
        fclose($handle);

        // Check for DICM magic string
        return $header === 'DICM';
    }

    /**
     * Import DICOM file to Orthanc
     *
     * @param string $filepath Path to DICOM file
     * @return array Result with success status and details
     */
    public function importFileToOrthanc($filepath) {
        if (!file_exists($filepath)) {
            return [
                'success' => false,
                'error' => 'File does not exist',
                'filepath' => $filepath
            ];
        }

        if (!is_readable($filepath)) {
            return [
                'success' => false,
                'error' => 'File is not readable',
                'filepath' => $filepath
            ];
        }

        try {
            // Read file contents
            $fileContent = file_get_contents($filepath);

            if ($fileContent === false) {
                return [
                    'success' => false,
                    'error' => 'Failed to read file',
                    'filepath' => $filepath
                ];
            }

            // POST to Orthanc /instances endpoint
            $url = rtrim($this->orthancUrl, '/') . '/instances';

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $fileContent);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/dicom',
                'Content-Length: ' . strlen($fileContent)
            ]);
            curl_setopt($ch, CURLOPT_USERPWD, $this->orthancUsername . ':' . $this->orthancPassword);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($curlError) {
                return [
                    'success' => false,
                    'error' => 'CURL error: ' . $curlError,
                    'filepath' => $filepath
                ];
            }

            // Check HTTP response code
            if ($httpCode >= 200 && $httpCode < 300) {
                $responseData = json_decode($response, true);

                return [
                    'success' => true,
                    'orthanc_id' => $responseData['ID'] ?? null,
                    'patient_id' => $responseData['ParentPatient'] ?? null,
                    'study_uid' => $responseData['ParentStudy'] ?? null,
                    'series_uid' => $responseData['ParentSeries'] ?? null,
                    'instance_uid' => $responseData['ID'] ?? null,
                    'filepath' => $filepath
                ];
            } else {
                // Check if it's a duplicate (409 Conflict)
                if ($httpCode === 409) {
                    return [
                        'success' => false,
                        'duplicate' => true,
                        'error' => 'Duplicate file - already exists in Orthanc',
                        'filepath' => $filepath
                    ];
                }

                return [
                    'success' => false,
                    'error' => "HTTP {$httpCode}: " . ($response ?? 'Unknown error'),
                    'filepath' => $filepath
                ];
            }

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
                'filepath' => $filepath
            ];
        }
    }

    /**
     * Batch import multiple files with progress tracking
     *
     * @param array $files Array of file paths
     * @param int $jobId Import job ID
     * @return array Summary of import results
     */
    public function batchImport($files, $jobId) {
        $processed = 0;
        $imported = 0;
        $failed = 0;
        $duplicates = 0;
        $errors = [];

        // Update job status to running
        $this->updateJobStatus($jobId, 'running', null, date('Y-m-d H:i:s'));

        foreach ($files as $file) {
            $filepath = is_array($file) ? $file['path'] : $file;

            // Calculate file hash for duplicate detection
            $fileHash = $this->calculateFileHash($filepath);

            // Check if file already imported
            if ($this->isFileImported($fileHash)) {
                $processed++;
                $duplicates++;

                // Log to import_history as duplicate
                $this->logImportHistory($jobId, $filepath, 'duplicate', $fileHash);

                // Update progress
                $this->updateJobProgress($jobId, $processed, $imported, $failed);

                continue;
            }

            // Import file to Orthanc
            $result = $this->importFileToOrthanc($filepath);
            $processed++;

            if ($result['success']) {
                $imported++;

                // Log successful import
                $this->logImportHistory(
                    $jobId,
                    $filepath,
                    'imported',
                    $fileHash,
                    $result['orthanc_id'] ?? null,
                    $result['patient_id'] ?? null,
                    $result['study_uid'] ?? null,
                    $result['series_uid'] ?? null,
                    $result['instance_uid'] ?? null
                );

            } else {
                $failed++;

                // Log failed import
                $this->logImportHistory(
                    $jobId,
                    $filepath,
                    $result['duplicate'] ?? false ? 'duplicate' : 'failed',
                    $fileHash,
                    null,
                    null,
                    null,
                    null,
                    null,
                    $result['error'] ?? 'Unknown error'
                );

                if (!($result['duplicate'] ?? false)) {
                    $errors[] = [
                        'file' => $filepath,
                        'error' => $result['error'] ?? 'Unknown error'
                    ];
                }
            }

            // Update progress
            $this->updateJobProgress($jobId, $processed, $imported, $failed);

            // Small delay to prevent overwhelming the system
            usleep(10000); // 10ms delay
        }

        // Update job status to completed
        $status = $failed === count($files) ? 'failed' : 'completed';
        $this->updateJobStatus($jobId, $status, null, null, date('Y-m-d H:i:s'));

        logMessage("Batch import completed for job {$jobId}: Processed={$processed}, Imported={$imported}, Failed={$failed}, Duplicates={$duplicates}", 'info', 'import.log');

        return [
            'processed' => $processed,
            'imported' => $imported,
            'failed' => $failed,
            'duplicates' => $duplicates,
            'errors' => $errors
        ];
    }

    /**
     * Scan directory for new files not in import_history
     *
     * @param string $path Directory path to scan
     * @return array Array of new files
     */
    public function scanForNewFiles($path) {
        $scanResult = $this->scanDirectory($path);

        if (isset($scanResult['error'])) {
            return $scanResult;
        }

        $allFiles = $scanResult['files'];
        $newFiles = [];

        foreach ($allFiles as $file) {
            $fileHash = $this->calculateFileHash($file['path']);

            if (!$this->isFileImported($fileHash)) {
                $newFiles[] = $file;
            }
        }

        logMessage("Scanned for new files in {$path}: Found " . count($newFiles) . " new files out of " . count($allFiles) . " total", 'info', 'import.log');

        return [
            'total_files' => count($allFiles),
            'new_files' => count($newFiles),
            'files' => $newFiles,
            'total_size' => array_sum(array_column($newFiles, 'size'))
        ];
    }

    /**
     * Calculate MD5 hash of file
     *
     * @param string $filepath Path to file
     * @return string MD5 hash
     */
    public function calculateFileHash($filepath) {
        if (!file_exists($filepath) || !is_readable($filepath)) {
            return null;
        }

        return md5_file($filepath);
    }

    /**
     * Check if file already imported
     *
     * @param string $fileHash File hash
     * @return bool True if already imported
     */
    private function isFileImported($fileHash) {
        if (!$fileHash) {
            return false;
        }

        try {
            $stmt = $this->db->prepare("
                SELECT COUNT(*) as count
                FROM import_history
                WHERE file_hash = ? AND status IN ('imported', 'duplicate')
            ");
            $stmt->bind_param("s", $fileHash);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            $stmt->close();

            return $row['count'] > 0;

        } catch (Exception $e) {
            logMessage("Error checking if file imported: " . $e->getMessage(), 'error', 'import.log');
            return false;
        }
    }

    /**
     * Update import job progress
     *
     * @param int $jobId Job ID
     * @param int $processed Files processed
     * @param int $imported Files imported
     * @param int $failed Files failed
     * @return bool Success status
     */
    public function updateJobProgress($jobId, $processed, $imported, $failed) {
        try {
            $stmt = $this->db->prepare("
                UPDATE import_jobs
                SET files_processed = ?,
                    files_imported = ?,
                    files_failed = ?
                WHERE id = ?
            ");
            $stmt->bind_param("iiii", $processed, $imported, $failed, $jobId);
            $stmt->execute();
            $stmt->close();

            return true;

        } catch (Exception $e) {
            logMessage("Error updating job progress: " . $e->getMessage(), 'error', 'import.log');
            return false;
        }
    }

    /**
     * Update import job status
     *
     * @param int $jobId Job ID
     * @param string $status Status
     * @param string $errorMessage Error message (optional)
     * @param string $startedAt Started timestamp (optional)
     * @param string $completedAt Completed timestamp (optional)
     * @return bool Success status
     */
    public function updateJobStatus($jobId, $status, $errorMessage = null, $startedAt = null, $completedAt = null) {
        try {
            $query = "UPDATE import_jobs SET status = ?";
            $types = "s";
            $params = [$status];

            if ($errorMessage !== null) {
                $query .= ", error_message = ?";
                $types .= "s";
                $params[] = $errorMessage;
            }

            if ($startedAt !== null) {
                $query .= ", started_at = ?";
                $types .= "s";
                $params[] = $startedAt;
            }

            if ($completedAt !== null) {
                $query .= ", completed_at = ?";
                $types .= "s";
                $params[] = $completedAt;
            }

            $query .= " WHERE id = ?";
            $types .= "i";
            $params[] = $jobId;

            $stmt = $this->db->prepare($query);
            $stmt->bind_param($types, ...$params);
            $stmt->execute();
            $stmt->close();

            return true;

        } catch (Exception $e) {
            logMessage("Error updating job status: " . $e->getMessage(), 'error', 'import.log');
            return false;
        }
    }

    /**
     * Log import history
     *
     * @param int $jobId Job ID
     * @param string $filepath File path
     * @param string $status Status (imported, failed, duplicate, skipped)
     * @param string $fileHash File hash
     * @param string $orthancInstanceId Orthanc instance ID (optional)
     * @param string $patientId Patient ID (optional)
     * @param string $studyUid Study UID (optional)
     * @param string $seriesUid Series UID (optional)
     * @param string $instanceUid Instance UID (optional)
     * @param string $errorMessage Error message (optional)
     * @return bool Success status
     */
    private function logImportHistory(
        $jobId,
        $filepath,
        $status,
        $fileHash,
        $orthancInstanceId = null,
        $patientId = null,
        $studyUid = null,
        $seriesUid = null,
        $instanceUid = null,
        $errorMessage = null
    ) {
        try {
            $fileName = basename($filepath);
            $fileSize = file_exists($filepath) ? filesize($filepath) : 0;

            $stmt = $this->db->prepare("
                INSERT INTO import_history (
                    job_id,
                    file_path,
                    file_name,
                    file_size_bytes,
                    file_hash,
                    orthanc_instance_id,
                    patient_id,
                    study_uid,
                    series_uid,
                    instance_uid,
                    status,
                    error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    job_id = VALUES(job_id),
                    file_path = VALUES(file_path),
                    file_name = VALUES(file_name),
                    file_size_bytes = VALUES(file_size_bytes),
                    orthanc_instance_id = VALUES(orthanc_instance_id),
                    patient_id = VALUES(patient_id),
                    study_uid = VALUES(study_uid),
                    series_uid = VALUES(series_uid),
                    instance_uid = VALUES(instance_uid),
                    status = VALUES(status),
                    error_message = VALUES(error_message),
                    imported_at = CURRENT_TIMESTAMP
            ");

            $stmt->bind_param(
                "ississssssss",
                $jobId,
                $filepath,
                $fileName,
                $fileSize,
                $fileHash,
                $orthancInstanceId,
                $patientId,
                $studyUid,
                $seriesUid,
                $instanceUid,
                $status,
                $errorMessage
            );

            $stmt->execute();
            $stmt->close();

            return true;

        } catch (Exception $e) {
            logMessage("Error logging import history: " . $e->getMessage(), 'error', 'import.log');
            return false;
        }
    }

    /**
     * Get import job details
     *
     * @param int $jobId Job ID
     * @return array|null Job details or null if not found
     */
    public function getJobDetails($jobId) {
        try {
            $stmt = $this->db->prepare("
                SELECT * FROM import_jobs WHERE id = ?
            ");
            $stmt->bind_param("i", $jobId);
            $stmt->execute();
            $result = $stmt->get_result();
            $job = $result->fetch_assoc();
            $stmt->close();

            return $job;

        } catch (Exception $e) {
            logMessage("Error getting job details: " . $e->getMessage(), 'error', 'import.log');
            return null;
        }
    }

    /**
     * Create new import job
     *
     * @param string $sourcePath Source path
     * @param string $jobType Job type (initial, incremental, manual)
     * @param int $totalFiles Total files
     * @param int $totalSizeBytes Total size in bytes
     * @return int|null Job ID or null on failure
     */
    public function createImportJob($sourcePath, $jobType, $totalFiles = 0, $totalSizeBytes = 0) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO import_jobs (
                    job_type,
                    source_path,
                    total_files,
                    total_size_bytes,
                    status
                ) VALUES (?, ?, ?, ?, 'pending')
            ");

            $stmt->bind_param("ssii", $jobType, $sourcePath, $totalFiles, $totalSizeBytes);
            $stmt->execute();
            $jobId = $stmt->insert_id;
            $stmt->close();

            logMessage("Created import job {$jobId}: Type={$jobType}, Path={$sourcePath}, Files={$totalFiles}", 'info', 'import.log');

            return $jobId;

        } catch (Exception $e) {
            logMessage("Error creating import job: " . $e->getMessage(), 'error', 'import.log');
            return null;
        }
    }
}
