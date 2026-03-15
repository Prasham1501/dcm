<?php
/**
 * License Management API (Admin only)
 * 
 * GET    - List all licenses or get specific license details
 * POST   - Create new license
 * PUT    - Update license (suspend/reactivate)
 * DELETE - Revoke license
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/LicenseManager.php';

// Require admin authentication
if (!isLoggedIn() || !isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

$licenseManager = new LicenseManager();

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            $licenseId = $_GET['id'] ?? null;
            
            if ($licenseId) {
                // Get specific license with activations and stats
                $stmt = getDbConnection()->prepare("SELECT * FROM licenses WHERE id = ?");
                $stmt->bind_param("i", $licenseId);
                $stmt->execute();
                $license = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                
                if (!$license) {
                    echo json_encode(['success' => false, 'error' => 'License not found']);
                    exit;
                }
                
                $license['license_key_display'] = $licenseManager->formatKeyForDisplay($license['license_key']);
                $license['activations'] = $licenseManager->getLicenseActivations($licenseId);
                $license['usage_stats'] = $licenseManager->getLicenseUsageStats($licenseId);
                
                echo json_encode(['success' => true, 'license' => $license]);
            } else {
                // List all licenses
                $licenses = $licenseManager->getAllLicenses();
                echo json_encode(['success' => true, 'licenses' => $licenses]);
            }
            break;
            
        case 'POST':
            // Create new license
            $input = json_decode(file_get_contents('php://input'), true);

            $licenseData = [
                'license_type' => $input['license_type'] ?? 'trial_15',
                'customer_name' => $input['customer_name'] ?? '',
                'customer_email' => $input['customer_email'] ?? '',
                'customer_phone' => $input['customer_phone'] ?? '',
                'customer_hospital' => $input['customer_hospital'] ?? '',
                'max_activations' => intval($input['max_activations'] ?? 5),
                'notes' => $input['notes'] ?? ''
            ];

            // Add custom_days if provided
            if (isset($input['custom_days']) && !empty($input['custom_days'])) {
                $licenseData['custom_days'] = intval($input['custom_days']);
            }

            $result = $licenseManager->createLicense($licenseData);
            
            if ($result['success']) {
                logAuditEvent($_SESSION['user_id'], 'license_created', 'license', $result['license_id'], 
                    "Created {$input['license_type']} license for {$input['customer_name']}");
            }
            
            echo json_encode($result);
            break;
            
        case 'PUT':
            // Update license (suspend/reactivate/update details)
            $input = json_decode(file_get_contents('php://input'), true);
            $licenseId = $input['id'] ?? 0;
            $action = $input['action'] ?? '';
            
            if (!$licenseId) {
                echo json_encode(['success' => false, 'error' => 'License ID required']);
                exit;
            }
            
            switch ($action) {
                case 'suspend':
                    $result = $licenseManager->revokeLicense($licenseId);
                    logAuditEvent($_SESSION['user_id'], 'license_suspended', 'license', $licenseId, "Suspended license");
                    echo json_encode(['success' => $result, 'message' => 'License suspended']);
                    break;
                    
                case 'reactivate':
                    $result = $licenseManager->reactivateLicense($licenseId);
                    logAuditEvent($_SESSION['user_id'], 'license_reactivated', 'license', $licenseId, "Reactivated license");
                    echo json_encode(['success' => $result, 'message' => 'License reactivated']);
                    break;
                    
                case 'extend':
                    // Extend license validity
                    $db = getDbConnection();
                    $extensionDays = intval($input['extension_days'] ?? 30);

                    // Get current license
                    $stmt = $db->prepare("SELECT valid_until FROM licenses WHERE id = ?");
                    $stmt->bind_param("i", $licenseId);
                    $stmt->execute();
                    $license = $stmt->get_result()->fetch_assoc();
                    $stmt->close();

                    if (!$license) {
                        echo json_encode(['success' => false, 'error' => 'License not found']);
                        break;
                    }

                    // Calculate new expiry date
                    // If current license is still valid, extend from valid_until
                    // If expired, extend from today
                    $currentExpiry = $license['valid_until'];
                    if ($currentExpiry && strtotime($currentExpiry) > strtotime('today')) {
                        $newExpiry = date('Y-m-d', strtotime($currentExpiry . " +{$extensionDays} days"));
                    } else {
                        $newExpiry = date('Y-m-d', strtotime("+{$extensionDays} days"));
                    }

                    // Update license
                    $stmt = $db->prepare("UPDATE licenses SET valid_until = ?, is_active = 1 WHERE id = ?");
                    $stmt->bind_param("si", $newExpiry, $licenseId);
                    $result = $stmt->execute();
                    $stmt->close();

                    if ($result) {
                        logAuditEvent($_SESSION['user_id'], 'license_extended', 'license', $licenseId,
                            "Extended license by {$extensionDays} days to {$newExpiry}");

                        echo json_encode([
                            'success' => true,
                            'message' => "License extended by {$extensionDays} days",
                            'new_expiry' => $newExpiry
                        ]);
                    } else {
                        echo json_encode(['success' => false, 'error' => 'Failed to extend license']);
                    }
                    break;

                case 'update':
                    // Update license details
                    $db = getDbConnection();
                    $stmt = $db->prepare("
                        UPDATE licenses SET
                            customer_name = ?,
                            customer_email = ?,
                            customer_phone = ?,
                            customer_hospital = ?,
                            max_activations = ?,
                            notes = ?
                        WHERE id = ?
                    ");
                    $stmt->bind_param(
                        "ssssiis",
                        $input['customer_name'],
                        $input['customer_email'],
                        $input['customer_phone'],
                        $input['customer_hospital'],
                        $input['max_activations'],
                        $input['notes'],
                        $licenseId
                    );
                    $result = $stmt->execute();
                    $stmt->close();

                    echo json_encode(['success' => $result, 'message' => 'License updated']);
                    break;
                    
                default:
                    echo json_encode(['success' => false, 'error' => 'Invalid action']);
            }
            break;
            
        case 'DELETE':
            // Permanently revoke license
            $input = json_decode(file_get_contents('php://input'), true);
            $licenseId = $input['id'] ?? 0;
            
            if (!$licenseId) {
                echo json_encode(['success' => false, 'error' => 'License ID required']);
                exit;
            }
            
            $result = $licenseManager->revokeLicense($licenseId);
            logAuditEvent($_SESSION['user_id'], 'license_revoked', 'license', $licenseId, "Revoked license");
            
            echo json_encode(['success' => $result, 'message' => 'License revoked']);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    logMessage("License management error: " . $e->getMessage(), 'error', 'license.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
