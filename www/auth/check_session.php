<?php
/**
 * Session Check API
 * Returns JSON response with session status and RBAC permissions
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/../includes/rbac.php';

try {
    // Check if user is logged in
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'authenticated' => false,
            'message' => 'Not authenticated'
        ]);
        exit;
    }

    // Get user info from session
    $userId = $_SESSION['user_id'] ?? null;
    $username = $_SESSION['username'] ?? null;
    $role = $_SESSION['role'] ?? 'viewer';
    $fullName = $_SESSION['full_name'] ?? $username;
    
    // Get role display info
    $roleInfo = getRoleDisplayInfo($role);
    
    // Get permissions for this role
    $permissions = ROLE_PERMISSIONS[$role] ?? [];

    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'user' => [
            'id' => $userId,
            'username' => $username,
            'full_name' => $fullName,
            'role' => $role,
            'role_label' => $roleInfo['label'],
            'role_color' => $roleInfo['color'],
            'role_icon' => $roleInfo['icon'],
            'permissions' => $permissions,
            // Quick permission checks for frontend
            'can_manage_reports' => in_array('create_reports', $permissions) || in_array('edit_reports', $permissions),
            'can_add_prescriptions' => in_array('add_prescriptions', $permissions),
            'can_add_remarks' => in_array('add_remarks', $permissions),
            'can_finalize_reports' => in_array('finalize_reports', $permissions),
            'can_manage_users' => in_array('manage_users', $permissions),
            'can_manage_settings' => in_array('manage_settings', $permissions),
            'is_admin' => $role === 'admin',
            'is_read_only' => in_array($role, ['technician', 'viewer'])
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'authenticated' => false,
        'error' => APP_ENV === 'development' ? $e->getMessage() : 'Session check failed'
    ]);
}

