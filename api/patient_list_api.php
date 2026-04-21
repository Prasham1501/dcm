<?php
/**
 * Patient List API - Enhanced with modality and study name filters
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Validate session
requireLogin();

try {
    $mysqli = getDbConnection();

    // Get filter parameters
    $search = $_GET['search'] ?? '';
    $name = $_GET['name'] ?? '';
    $patientId = $_GET['patientId'] ?? '';
    $studyDateFrom = $_GET['studyDateFrom'] ?? '';
    $studyDateTo = $_GET['studyDateTo'] ?? '';
    $studyName = $_GET['studyName'] ?? '';
    $modality = $_GET['modality'] ?? '';
    $sex = $_GET['sex'] ?? '';
    $minStudies = intval($_GET['minStudies'] ?? 0);
    $sortBy = $_GET['sortBy'] ?? 'name';

    $page = max(1, intval($_GET['page'] ?? 1));
    $perPage = min(100, max(10, intval($_GET['per_page'] ?? 50)));
    $offset = ($page - 1) * $perPage;

    // Build WHERE clause for main patient filters
    $whereClauses = [];
    $params = [];
    $types = '';

    // Quick search (searches both name and ID)
    if (!empty($search)) {
        $whereClauses[] = "(cp.patient_name LIKE ? OR cp.patient_id LIKE ?)";
        $searchParam = "%$search%";
        $params[] = $searchParam;
        $params[] = $searchParam;
        $types .= 'ss';
    }

    // Specific name filter
    if (!empty($name)) {
        $whereClauses[] = "cp.patient_name LIKE ?";
        $params[] = "%$name%";
        $types .= 's';
    }

    // Specific patient ID filter
    if (!empty($patientId)) {
        $whereClauses[] = "cp.patient_id LIKE ?";
        $params[] = "%$patientId%";
        $types .= 's';
    }

    // Sex filter
    if (!empty($sex)) {
        $whereClauses[] = "cp.patient_sex = ?";
        $params[] = $sex;
        $types .= 's';
    }

    // Minimum studies filter
    if ($minStudies > 0) {
        $whereClauses[] = "cp.study_count >= ?";
        $params[] = $minStudies;
        $types .= 'i';
    }

    // Study date range filters (check if patient has studies in date range)
    if (!empty($studyDateFrom) || !empty($studyDateTo) || !empty($studyName) || !empty($modality)) {
        $studyWhere = [];
        $studyParams = [];
        $studyTypes = '';

        if (!empty($studyDateFrom)) {
            $studyWhere[] = "cs.study_date >= ?";
            $studyParams[] = $studyDateFrom;
            $studyTypes .= 's';
        }

        if (!empty($studyDateTo)) {
            $studyWhere[] = "cs.study_date <= ?";
            $studyParams[] = $studyDateTo;
            $studyTypes .= 's';
        }

        if (!empty($studyName)) {
            $studyWhere[] = "(cs.study_description LIKE ? OR cs.study_name LIKE ?)";
            $studyParam = "%$studyName%";
            $studyParams[] = $studyParam;
            $studyParams[] = $studyParam;
            $studyTypes .= 'ss';
        }

        if (!empty($modality)) {
            $studyWhere[] = "cs.modality = ?";
            $studyParams[] = $modality;
            $studyTypes .= 's';
        }

        $studyWhereClause = implode(' AND ', $studyWhere);

        // Get patient IDs that match study filters
        $studySql = "SELECT DISTINCT patient_id FROM cached_studies cs WHERE $studyWhereClause";
        $studyStmt = $mysqli->prepare($studySql);

        if (!empty($studyParams)) {
            $studyStmt->bind_param($studyTypes, ...$studyParams);
        }

        $studyStmt->execute();
        $studyResult = $studyStmt->get_result();
        $matchingPatientIds = [];
        while ($row = $studyResult->fetch_assoc()) {
            $matchingPatientIds[] = $row['patient_id'];
        }
        $studyStmt->close();

        if (empty($matchingPatientIds)) {
            // No patients match study filters
            echo json_encode([
                'success' => true,
                'data' => [],
                'pagination' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => 0,
                    'total_pages' => 0
                ],
                'filters_applied' => [
                    'search' => $search,
                    'name' => $name,
                    'patientId' => $patientId,
                    'studyDateFrom' => $studyDateFrom,
                    'studyDateTo' => $studyDateTo,
                    'studyName' => $studyName,
                    'modality' => $modality,
                    'sex' => $sex,
                    'minStudies' => $minStudies,
                    'sortBy' => $sortBy
                ]
            ]);
            exit;
        }

        // Add patient ID filter
        $placeholders = implode(',', array_fill(0, count($matchingPatientIds), '?'));
        $whereClauses[] = "cp.patient_id IN ($placeholders)";
        foreach ($matchingPatientIds as $pid) {
            $params[] = $pid;
            $types .= 's';
        }
    }

    // Combine WHERE clauses
    $whereClause = !empty($whereClauses) ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

    // Determine sort order
    $orderBy = match($sortBy) {
        'name' => 'cp.patient_name ASC',
        'name_desc' => 'cp.patient_name DESC',
        'date' => 'cp.last_study_date DESC, cp.patient_name ASC',
        'date_asc' => 'cp.last_study_date ASC, cp.patient_name ASC',
        'studies' => 'cp.study_count DESC, cp.patient_name ASC',
        default => 'cp.patient_name ASC'
    };

    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM cached_patients cp $whereClause";

    if (!empty($params)) {
        $stmt = $mysqli->prepare($countSql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $total = $result->fetch_assoc()['total'];
        $stmt->close();
    } else {
        $result = $mysqli->query($countSql);
        $total = $result->fetch_assoc()['total'];
    }

    // Get patients with aggregated study information including age calculation
    $sql = "SELECT
                cp.patient_id,
                cp.patient_name,
                cp.patient_sex as patient_sex,
                cp.patient_birth_date as birth_date,
                cp.study_count,
                cp.last_study_date,
                cp.orthanc_id,
                CASE 
                    WHEN cp.patient_birth_date IS NOT NULL AND cp.patient_birth_date != '' AND cp.patient_birth_date != '00000000'
                    THEN TIMESTAMPDIFF(YEAR, 
                        CASE 
                            WHEN LENGTH(cp.patient_birth_date) = 8 
                            THEN STR_TO_DATE(cp.patient_birth_date, '%Y%m%d')
                            ELSE STR_TO_DATE(cp.patient_birth_date, '%Y-%m-%d')
                        END, 
                        CURDATE())
                    ELSE NULL
                END as age,
                GROUP_CONCAT(DISTINCT cs.modality ORDER BY cs.modality SEPARATOR ',') as modalities,
                GROUP_CONCAT(DISTINCT cs.study_description ORDER BY cs.study_date DESC SEPARATOR '|') as study_names
            FROM cached_patients cp
            LEFT JOIN cached_studies cs ON cp.patient_id = cs.patient_id
            $whereClause
            GROUP BY cp.patient_id, cp.patient_name, cp.patient_sex, cp.patient_birth_date,
                     cp.study_count, cp.last_study_date, cp.orthanc_id
            ORDER BY $orderBy
            LIMIT ? OFFSET ?";

    if (!empty($params)) {
        $stmt = $mysqli->prepare($sql);
        // Add LIMIT and OFFSET parameters
        $params[] = $perPage;
        $params[] = $offset;
        $types .= 'ii';
        $stmt->bind_param($types, ...$params);
    } else {
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param('ii', $perPage, $offset);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $patients = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    echo json_encode([
        'success' => true,
        'data' => $patients,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => ceil($total / $perPage)
        ],
        'filters_applied' => [
            'search' => $search,
            'name' => $name,
            'patientId' => $patientId,
            'studyDateFrom' => $studyDateFrom,
            'studyDateTo' => $studyDateTo,
            'studyName' => $studyName,
            'modality' => $modality,
            'sex' => $sex,
            'minStudies' => $minStudies,
            'sortBy' => $sortBy
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to fetch patient list',
        'details' => APP_ENV === 'development' ? $e->getMessage() : null
    ]);
}
