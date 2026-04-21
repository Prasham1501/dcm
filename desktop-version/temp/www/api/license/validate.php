<?php
/**
 * License Validation API
 * 
 * GET  - Check current license status
 * POST - Validate and heartbeat a license
 */

define('DICOM_VIEWER', true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../includes/LicenseManager.php';

$licenseManager = new LicenseManager();

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET':
            // Check local license status
            $status = $licenseManager->checkLocalLicense();
            echo json_encode(['success' => true, 'license' => $status]);
            break;
            
        case 'POST':
            // Validate license and send heartbeat
            $input = json_decode(file_get_contents('php://input'), true);
            $machineId = $input['machine_id'] ?? LicenseManager::generateMachineId();
            
            $local = $licenseManager->getLocalLicense();
            
            if (!$local || empty($local['license_key'])) {
                echo json_encode(['success' => false, 'error' => 'No license installed']);
                exit;
            }
            
            // Validate with server
            $validation = $licenseManager->validateLicense($local['license_key'], $machineId);
            
            if ($validation['valid']) {
                // Update heartbeat
                $license = $licenseManager->getLicenseByKey($local['license_key']);
                if ($license) {
                    $licenseManager->updateHeartbeat($license['id'], $machineId);
                    $licenseManager->updateLocalLicense($local['license_key'], $machineId, $license);
                }
                
                echo json_encode([
                    'success' => true,
                    'valid' => true,
                    'license' => $validation['license']
                ]);
            } else {
                // License invalid - update local cache
                if (isset($validation['revoked']) && $validation['revoked']) {
                    $licenseManager->markLocalRevoked();
                }
                
                echo json_encode([
                    'success' => true,
                    'valid' => false,
                    'error' => $validation['error'],
                    'revoked' => $validation['revoked'] ?? false,
                    'expired' => $validation['expired'] ?? false
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    logMessage("License validation error: " . $e->getMessage(), 'error', 'license.log');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
