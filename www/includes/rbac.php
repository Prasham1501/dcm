<?php
/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Medical DICOM Viewer Role Definitions:
 * 
 * ADMIN:
 *   - Full system access
 *   - Manage users, settings, backups
 *   - View all patients and studies
 *   - Create/edit/delete reports
 * 
 * DOCTOR:
 *   - View all patients and studies
 *   - Create and edit medical reports
 *   - Add prescriptions and remarks
 *   - Cannot manage users or settings
 * 
 * RADIOLOGIST:
 *   - View all patients and studies
 *   - Create and finalize radiology reports
 *   - Add findings and impressions
 *   - Cannot add prescriptions
 *   - Cannot manage users or settings
 * 
 * TECHNICIAN:
 *   - View patient list (read-only)
 *   - View studies (read-only)
 *   - Cannot create or edit reports
 *   - Cannot add prescriptions or remarks
 *   - Cannot manage users or settings
 * 
 * VIEWER (legacy):
 *   - Basic read-only access
 *   - Same as technician
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Only define constants if not already defined
if (!defined('ROLE_LEVELS')) {
    // Role hierarchy (higher number = more permissions)
    define('ROLE_LEVELS', [
        'viewer' => 0,
        'technician' => 1,
        'radiologist' => 2,
        'doctor' => 3,
        'admin' => 4
    ]);
}

if (!defined('ROLE_PERMISSIONS')) {
    // Permission definitions per role
    define('ROLE_PERMISSIONS', [
        'admin' => [
            'view_patients',
            'view_studies',
            'view_reports',
            'create_reports',
            'edit_reports',
            'delete_reports',
            'finalize_reports',
            'add_prescriptions',
            'add_remarks',
            'manage_users',
            'manage_settings',
            'manage_backups',
            'export_data',
            'view_admin_menu'
        ],
        'doctor' => [
            'view_patients',
            'view_studies',
            'view_reports',
            'create_reports',
            'edit_reports',
            'add_prescriptions',
            'add_remarks',
            'export_data'
        ],
        'radiologist' => [
            'view_patients',
            'view_studies',
            'view_reports',
            'create_reports',
            'edit_reports',
            'finalize_reports',
            'add_remarks',
            'export_data'
        ],
        'technician' => [
            'view_patients',
            'view_studies',
            'view_reports'
        ],
        'viewer' => [
            'view_patients',
            'view_studies',
            'view_reports'
        ]
    ]);
}

/**
 * Get current user's role
 * @return string Role name
 */
if (!function_exists('getCurrentRole')) {
    function getCurrentRole() {
        return $_SESSION['role'] ?? 'viewer';
    }
}

/**
 * Check if user has a specific permission
 * @param string $permission Permission to check
 * @return bool True if user has permission
 */
if (!function_exists('hasPermission')) {
    function hasPermission($permission) {
        $role = getCurrentRole();
        $permissions = ROLE_PERMISSIONS[$role] ?? [];
        return in_array($permission, $permissions);
    }
}

/**
 * Check if user's role meets minimum level
 * @param string $minimumRole Minimum role required
 * @return bool True if user meets or exceeds the minimum role
 */
if (!function_exists('hasRoleLevel')) {
    function hasRoleLevel($minimumRole) {
        $currentRole = getCurrentRole();
        $currentLevel = ROLE_LEVELS[$currentRole] ?? 0;
        $minimumLevel = ROLE_LEVELS[$minimumRole] ?? 0;
        return $currentLevel >= $minimumLevel;
    }
}

/**
 * Require specific permission or exit
 * @param string $permission Required permission
 * @param bool $isApi Whether this is an API call
 */
if (!function_exists('requirePermission')) {
    function requirePermission($permission, $isApi = false) {
        if (!hasPermission($permission)) {
            if ($isApi) {
                http_response_code(403);
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'error' => 'Access denied - Insufficient permissions',
                    'required_permission' => $permission,
                    'your_role' => getCurrentRole()
                ]);
                exit;
            }
            header('Location: ' . BASE_PATH . '/pages/access-denied.html');
            exit;
        }
    }
}

// Note: requireRole is already defined in session.php, so we skip it here
// to prevent redeclaration errors

/**
 * Check if current user is admin
 * @return bool True if admin
 */
if (!function_exists('isAdminRole')) {
    function isAdminRole() {
        return getCurrentRole() === 'admin';
    }
}

/**
 * Check if current user can create/edit reports
 * @return bool True if allowed
 */
if (!function_exists('canManageReports')) {
    function canManageReports() {
        return hasPermission('create_reports') || hasPermission('edit_reports');
    }
}

/**
 * Check if current user can add prescriptions
 * @return bool True if allowed
 */
if (!function_exists('canAddPrescriptions')) {
    function canAddPrescriptions() {
        return hasPermission('add_prescriptions');
    }
}

/**
 * Check if current user can finalize reports
 * @return bool True if allowed
 */
if (!function_exists('canFinalizeReports')) {
    function canFinalizeReports() {
        return hasPermission('finalize_reports');
    }
}

/**
 * Get role display information
 * @param string $role Role name
 * @return array Role info with label, color, and icon
 */
if (!function_exists('getRoleDisplayInfo')) {
    function getRoleDisplayInfo($role) {
        $roles = [
            'admin' => [
                'label' => 'Administrator',
                'color' => 'danger',
                'icon' => 'bi-shield-check',
                'description' => 'Full system access'
            ],
            'doctor' => [
                'label' => 'Doctor',
                'color' => 'primary',
                'icon' => 'bi-heart-pulse',
                'description' => 'View patients, create reports, prescriptions'
            ],
            'radiologist' => [
                'label' => 'Radiologist',
                'color' => 'success',
                'icon' => 'bi-file-medical',
                'description' => 'View patients, create/finalize reports'
            ],
            'technician' => [
                'label' => 'Technician',
                'color' => 'secondary',
                'icon' => 'bi-person-gear',
                'description' => 'Read-only access to patients and studies'
            ],
            'viewer' => [
                'label' => 'Viewer',
                'color' => 'dark',
                'icon' => 'bi-eye',
                'description' => 'Basic read-only access'
            ]
        ];
        
        return $roles[$role] ?? [
            'label' => ucfirst($role),
            'color' => 'secondary',
            'icon' => 'bi-person',
            'description' => 'Unknown role'
        ];
    }
}

/**
 * Get all permissions for display
 * @return array All available permissions
 */
if (!function_exists('getAllPermissions')) {
    function getAllPermissions() {
        return [
            'view_patients' => 'View patient list',
            'view_studies' => 'View studies and images',
            'view_reports' => 'View medical reports',
            'create_reports' => 'Create new reports',
            'edit_reports' => 'Edit existing reports',
            'delete_reports' => 'Delete reports',
            'finalize_reports' => 'Finalize/sign reports',
            'add_prescriptions' => 'Add prescriptions',
            'add_remarks' => 'Add remarks/notes',
            'manage_users' => 'Manage users',
            'manage_settings' => 'Manage system settings',
            'manage_backups' => 'Manage backups',
            'export_data' => 'Export data',
            'view_admin_menu' => 'View admin menu'
        ];
    }
}
