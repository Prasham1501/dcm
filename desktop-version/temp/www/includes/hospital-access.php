<?php
/**
 * Hospital Access Service
 * Provides functions to check and filter data by hospital access
 * 
 * Role Permissions:
 * - Admin: Full system access, can manage all hospitals and users
 * - Doctor: Can view/edit patient data, studies, create reports for assigned hospitals
 * - Radiologist: Can view studies, create/edit reports for assigned hospitals
 * - Technician: Can view patients and studies (read-only) for assigned hospitals
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include config if not already included
if (!function_exists('getDbConnection')) {
    require_once __DIR__ . '/config.php';
}

/**
 * Get all hospital IDs the current user has access to
 * @return array Array of hospital IDs
 */
function getUserHospitalIds() {
    if (!isset($_SESSION['user_id'])) {
        return [];
    }
    
    // Cache in session for performance
    if (isset($_SESSION['hospital_ids_cache']) && 
        isset($_SESSION['hospital_ids_cache_time']) && 
        (time() - $_SESSION['hospital_ids_cache_time']) < 300) { // 5 min cache
        return $_SESSION['hospital_ids_cache'];
    }
    
    $userId = $_SESSION['user_id'];
    $mysqli = getDbConnection();
    
    // Admin has access to all hospitals
    if (($_SESSION['role'] ?? '') === 'admin') {
        $result = $mysqli->query("SELECT id FROM hospitals WHERE is_active = 1");
        $ids = [];
        while ($row = $result->fetch_assoc()) {
            $ids[] = (int)$row['id'];
        }
        $_SESSION['hospital_ids_cache'] = $ids;
        $_SESSION['hospital_ids_cache_time'] = time();
        return $ids;
    }
    
    // Other roles: check user_hospital_access
    $stmt = $mysqli->prepare("
        SELECT uha.hospital_id 
        FROM user_hospital_access uha
        INNER JOIN hospitals h ON uha.hospital_id = h.id
        WHERE uha.user_id = ? AND h.is_active = 1
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $ids = [];
    while ($row = $result->fetch_assoc()) {
        $ids[] = (int)$row['hospital_id'];
    }
    $stmt->close();
    
    $_SESSION['hospital_ids_cache'] = $ids;
    $_SESSION['hospital_ids_cache_time'] = time();
    
    return $ids;
}

/**
 * Get the current selected hospital ID (or null for all)
 * @return int|null Hospital ID or null for all accessible hospitals
 */
function getCurrentHospitalId() {
    return $_SESSION['current_hospital_id'] ?? null;
}

/**
 * Set the current hospital context
 * @param int|null $hospitalId Hospital ID or null for all
 */
function setCurrentHospitalId($hospitalId) {
    if ($hospitalId !== null) {
        // Verify user has access
        $accessibleIds = getUserHospitalIds();
        if (!in_array((int)$hospitalId, $accessibleIds)) {
            return false;
        }
    }
    $_SESSION['current_hospital_id'] = $hospitalId;
    return true;
}

/**
 * Check if user has access to a specific hospital
 * @param int $hospitalId Hospital ID
 * @return bool True if user has access
 */
function hasHospitalAccess($hospitalId) {
    $accessibleIds = getUserHospitalIds();
    return in_array((int)$hospitalId, $accessibleIds);
}

/**
 * Get user's access level for a hospital
 * @param int $hospitalId Hospital ID
 * @return string|null Access level (owner, admin, read_only) or null if no access
 */
function getHospitalAccessLevel($hospitalId) {
    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    
    // Admin role always has owner-level access
    if (($_SESSION['role'] ?? '') === 'admin') {
        return 'owner';
    }
    
    $userId = $_SESSION['user_id'];
    $mysqli = getDbConnection();
    
    $stmt = $mysqli->prepare("
        SELECT access_level 
        FROM user_hospital_access 
        WHERE user_id = ? AND hospital_id = ?
    ");
    $stmt->bind_param("ii", $userId, $hospitalId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    
    return $result['access_level'] ?? null;
}

/**
 * Build a WHERE clause for hospital filtering
 * @param string $tableAlias Table alias (e.g., 'p', 's')
 * @return string SQL WHERE clause part
 */
function buildHospitalFilter($tableAlias = '') {
    $hospitalIds = getUserHospitalIds();
    
    if (empty($hospitalIds)) {
        return "1=0"; // No access to any hospital
    }
    
    $currentHospitalId = getCurrentHospitalId();
    $prefix = $tableAlias ? "$tableAlias." : "";
    
    if ($currentHospitalId !== null) {
        // Single hospital selected
        if (hasHospitalAccess($currentHospitalId)) {
            return "{$prefix}hospital_id = " . (int)$currentHospitalId;
        }
        return "1=0";
    }
    
    // All accessible hospitals
    $idList = implode(',', array_map('intval', $hospitalIds));
    return "{$prefix}hospital_id IN ($idList)";
}

/**
 * Get list of accessible hospitals with details
 * @return array Array of hospital objects
 */
function getAccessibleHospitals() {
    $hospitalIds = getUserHospitalIds();
    
    if (empty($hospitalIds)) {
        return [];
    }
    
    $mysqli = getDbConnection();
    $idList = implode(',', array_map('intval', $hospitalIds));
    
    $result = $mysqli->query("
        SELECT h.*, 
               (SELECT COUNT(*) FROM cached_patients WHERE hospital_id = h.id) as patient_count,
               (SELECT COUNT(*) FROM cached_studies WHERE hospital_id = h.id) as study_count
        FROM hospitals h
        WHERE h.id IN ($idList) AND h.is_active = 1
        ORDER BY h.hospital_name
    ");
    
    return $result->fetch_all(MYSQLI_ASSOC);
}

/**
 * Check if user can perform an action based on role
 * @param string $action Action to check
 * @param int|null $hospitalId Hospital ID for context
 * @return bool True if allowed
 */
function canPerformAction($action, $hospitalId = null) {
    $role = $_SESSION['role'] ?? 'guest';
    
    // Define role permissions
    $permissions = [
        'admin' => [
            'view_patients', 'edit_patients', 'delete_patients',
            'view_studies', 'edit_studies', 'delete_studies',
            'view_reports', 'create_reports', 'edit_reports', 'delete_reports',
            'manage_users', 'manage_hospitals', 'manage_settings'
        ],
        'doctor' => [
            'view_patients', 'edit_patients',
            'view_studies', 'edit_studies',
            'view_reports', 'create_reports', 'edit_reports'
        ],
        'radiologist' => [
            'view_patients',
            'view_studies',
            'view_reports', 'create_reports', 'edit_reports'
        ],
        'technician' => [
            'view_patients',
            'view_studies',
            'view_reports'
        ]
    ];
    
    $allowedActions = $permissions[$role] ?? [];
    
    if (!in_array($action, $allowedActions)) {
        return false;
    }
    
    // If hospital context is provided, check hospital access
    if ($hospitalId !== null && !hasHospitalAccess($hospitalId)) {
        return false;
    }
    
    return true;
}

/**
 * Require specific permission, exit if not allowed
 * @param string $action Action to check
 * @param int|null $hospitalId Hospital ID for context
 */
function requirePermission($action, $hospitalId = null) {
    if (!canPerformAction($action, $hospitalId)) {
        if (defined('API_MODE') && API_MODE) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Permission denied']);
            exit;
        }
        header('Location: ' . BASE_PATH . '/403.php');
        exit;
    }
}

/**
 * Clear hospital access cache (call after access changes)
 */
function clearHospitalCache() {
    unset($_SESSION['hospital_ids_cache']);
    unset($_SESSION['hospital_ids_cache_time']);
}

/**
 * Get role display info
 * @param string $role Role name
 * @return array Role info with color and icon
 */
function getRoleInfo($role) {
    $roles = [
        'admin' => ['label' => 'Administrator', 'color' => 'danger', 'icon' => 'shield-check'],
        'doctor' => ['label' => 'Doctor', 'color' => 'primary', 'icon' => 'heart-pulse'],
        'radiologist' => ['label' => 'Radiologist', 'color' => 'success', 'icon' => 'file-medical'],
        'technician' => ['label' => 'Technician', 'color' => 'secondary', 'icon' => 'person-gear']
    ];
    
    return $roles[$role] ?? ['label' => ucfirst($role), 'color' => 'secondary', 'icon' => 'person'];
}
