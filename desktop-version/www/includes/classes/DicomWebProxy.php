<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * DICOMweb Proxy Class
 *
 * Proxies DICOMweb requests to Orthanc server
 * Handles authentication and logging
 */

namespace DicomViewer;

class DicomWebProxy {
    private $orthancUrl;
    private $username;
    private $password;
    private $dicomwebRoot;
    private $db;

    public function __construct($db = null) {
        $this->orthancUrl = ORTHANC_URL;
        $this->username = ORTHANC_USERNAME;
        $this->password = ORTHANC_PASSWORD;
        $this->dicomwebRoot = ORTHANC_DICOMWEB_ROOT;
        $this->db = $db;
    }

    /**
     * Query studies from Orthanc using QIDO-RS
     *
     * @param array $filters Query filters
     * @return array Studies data
     */
    public function queryStudies($filters = []) {
        $params = [];

        // Build QIDO-RS query parameters
        if (!empty($filters['PatientName'])) {
            $params['PatientName'] = $filters['PatientName'];
        }

        if (!empty($filters['PatientID'])) {
            $params['PatientID'] = $filters['PatientID'];
        }

        if (!empty($filters['StudyDate'])) {
            $params['StudyDate'] = $filters['StudyDate'];
        }

        if (!empty($filters['Modality'])) {
            $params['ModalitiesInStudy'] = $filters['Modality'];
        }

        if (!empty($filters['AccessionNumber'])) {
            $params['AccessionNumber'] = $filters['AccessionNumber'];
        }

        // Pagination
        if (isset($filters['limit'])) {
            $params['limit'] = $filters['limit'];
        }

        if (isset($filters['offset'])) {
            $params['offset'] = $filters['offset'];
        }

        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies';

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $response = $this->makeRequest($url, 'GET');

        // Log access
        if ($this->db && isset($_SESSION['user_id'])) {
            $this->logAccess($_SESSION['user_id'], 'query_studies', json_encode($filters));
        }

        return $response;
    }

    /**
     * Get study metadata
     *
     * @param string $studyUID Study Instance UID
     * @return array Study metadata
     */
    public function getStudyMetadata($studyUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) . '/metadata';
        $response = $this->makeRequest($url, 'GET');

        // Log access
        if ($this->db && isset($_SESSION['user_id'])) {
            $this->logAccess($_SESSION['user_id'], 'view_study', $studyUID);
        }

        return $response;
    }

    /**
     * Get series for a study
     *
     * @param string $studyUID Study Instance UID
     * @return array Series data
     */
    public function getStudySeries($studyUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) . '/series';
        return $this->makeRequest($url, 'GET');
    }

    /**
     * Get series metadata
     *
     * @param string $studyUID Study Instance UID
     * @param string $seriesUID Series Instance UID
     * @return array Series metadata
     */
    public function getSeriesMetadata($studyUID, $seriesUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) .
               '/series/' . urlencode($seriesUID) . '/metadata';
        return $this->makeRequest($url, 'GET');
    }

    /**
     * Get instances for a series
     *
     * @param string $studyUID Study Instance UID
     * @param string $seriesUID Series Instance UID
     * @return array Instances data
     */
    public function getSeriesInstances($studyUID, $seriesUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) .
               '/series/' . urlencode($seriesUID) . '/instances';
        return $this->makeRequest($url, 'GET');
    }

    /**
     * Get instance metadata
     *
     * @param string $studyUID Study Instance UID
     * @param string $seriesUID Series Instance UID
     * @param string $instanceUID Instance UID
     * @return array Instance metadata
     */
    public function getInstanceMetadata($studyUID, $seriesUID, $instanceUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) .
               '/series/' . urlencode($seriesUID) . '/instances/' . urlencode($instanceUID) . '/metadata';
        return $this->makeRequest($url, 'GET');
    }

    /**
     * Get instance frames (WADO-RS)
     *
     * @param string $studyUID Study Instance UID
     * @param string $seriesUID Series Instance UID
     * @param string $instanceUID Instance UID
     * @param int $frameNumber Frame number (default: 1)
     * @return array Response with image data
     */
    public function getInstanceFrames($studyUID, $seriesUID, $instanceUID, $frameNumber = 1) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) .
               '/series/' . urlencode($seriesUID) . '/instances/' . urlencode($instanceUID) .
               '/frames/' . $frameNumber;

        return $this->makeRequest($url, 'GET', null, ['Accept' => 'multipart/related; type="application/octet-stream"']);
    }

    /**
     * Get DICOM instance file (WADO-RS)
     *
     * @param string $studyUID Study Instance UID
     * @param string $seriesUID Series Instance UID
     * @param string $instanceUID Instance UID
     * @return array Response with DICOM file
     */
    public function getInstance($studyUID, $seriesUID, $instanceUID) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies/' . urlencode($studyUID) .
               '/series/' . urlencode($seriesUID) . '/instances/' . urlencode($instanceUID);

        return $this->makeRequest($url, 'GET', null, ['Accept' => 'application/dicom']);
    }

    /**
     * Upload DICOM instance (STOW-RS)
     *
     * @param string $dicomFile Path to DICOM file or file content
     * @return array Response
     */
    public function uploadInstance($dicomFile) {
        $url = $this->orthancUrl . $this->dicomwebRoot . '/studies';

        // Read file content if path provided
        if (file_exists($dicomFile)) {
            $dicomFile = file_get_contents($dicomFile);
        }

        $headers = [
            'Content-Type' => 'application/dicom'
        ];

        $response = $this->makeRequest($url, 'POST', $dicomFile, $headers);

        // Log upload
        if ($this->db && isset($_SESSION['user_id'])) {
            $this->logAccess($_SESSION['user_id'], 'upload_dicom', null, 'Uploaded DICOM instance');
        }

        return $response;
    }

    /**
     * Search for patients
     *
     * @param string $searchTerm Search term for patient name or ID
     * @return array Patients data
     */
    public function searchPatients($searchTerm) {
        // Search by patient name with wildcard
        $filters = [
            'PatientName' => $searchTerm . '*',
            'limit' => 100
        ];

        return $this->queryStudies($filters);
    }

    /**
     * Make HTTP request to Orthanc
     *
     * @param string $url URL to request
     * @param string $method HTTP method
     * @param mixed $data Request body data
     * @param array $headers Additional headers
     * @return array Response data
     */
    private function makeRequest($url, $method = 'GET', $data = null, $headers = []) {
        $ch = curl_init();

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        // Add authentication
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, $this->username . ':' . $this->password);

        // Set method
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
            }
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        // Set headers
        $curlHeaders = [
            'Accept: application/json'
        ];

        foreach ($headers as $key => $value) {
            $curlHeaders[] = "{$key}: {$value}";
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

        // Execute request
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        // Handle errors
        if ($error) {
            \logMessage("DICOMweb request error: {$error}", 'error', 'dicomweb.log');
            throw new \Exception("Failed to connect to Orthanc: {$error}");
        }

        if ($httpCode >= 400) {
            \logMessage("DICOMweb HTTP error {$httpCode}: {$response}", 'error', 'dicomweb.log');
            throw new \Exception("Orthanc returned error: HTTP {$httpCode}");
        }

        // Parse JSON response if applicable
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        if (strpos($contentType, 'application/json') !== false) {
            return json_decode($response, true);
        }

        return [
            'data' => $response,
            'content_type' => $contentType,
            'http_code' => $httpCode
        ];
    }

    /**
     * Log access for HIPAA compliance
     *
     * @param int $userId User ID
     * @param string $action Action performed
     * @param string $resourceId Resource ID
     * @param string $details Additional details
     */
    private function logAccess($userId, $action, $resourceId = null, $details = null) {
        if (!$this->db) {
            return;
        }

        try {
            $username = $_SESSION['username'] ?? null;
            $ipAddress = $_SERVER['REMOTE_ADDR'];
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            $resourceType = 'dicom_study';

            $stmt = $this->db->prepare("
                INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->bind_param(
                "isssssss",
                $userId,
                $username,
                $action,
                $resourceType,
                $resourceId,
                $details,
                $ipAddress,
                $userAgent
            );

            $stmt->execute();
            $stmt->close();
        } catch (\Exception $e) {
            \logMessage("Failed to log DICOMweb access: " . $e->getMessage(), 'error', 'audit.log');
        }
    }
}
