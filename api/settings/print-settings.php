<?php
/**
 * Print Settings API
 * Manage print configuration settings
 */
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$db = getDbConnection();

try {
    if ($method === 'GET') {
        // Get print settings
        $result = $db->query("SELECT * FROM app_settings WHERE setting_key LIKE 'print_%'");
        $settings = [];

        while ($row = $result->fetch_assoc()) {
            $key = str_replace('print_', '', $row['setting_key']);
            $value = $row['setting_value'];

            // Convert boolean strings to actual booleans
            if ($value === 'true' || $value === '1') {
                $value = true;
            } elseif ($value === 'false' || $value === '0') {
                $value = false;
            }

            $settings[$key] = $value;
        }

        // Return defaults if no settings found
        if (empty($settings)) {
            $settings = [
                'includePatientInfo' => true,
                'includeStudyInfo' => true,
                'includeInstitutionInfo' => true,
                'includeAnnotations' => true,
                'includeWindowLevel' => true,
                'includeMeasurements' => true,
                'includeTimestamp' => true,
                'paperSize' => 'A4',
                'orientation' => 'landscape',
                'quality' => 'high',
                'colorMode' => 'grayscale',
                'margins' => 'normal'
            ];
        }

        echo json_encode(['success' => true, 'settings' => $settings]);
    }
    elseif ($method === 'POST') {
        // Update print settings (admin only)
        if (!isAdmin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Admin access required']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input)) {
            throw new Exception("Invalid input data");
        }

        // Update each setting
        $stmt = $db->prepare("INSERT INTO app_settings (setting_key, setting_value, updated_at)
                              VALUES (?, ?, NOW())
                              ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()");

        foreach ($input as $key => $value) {
            $settingKey = 'print_' . $key;
            $settingValue = is_bool($value) ? ($value ? 'true' : 'false') : $value;

            $stmt->bind_param("ss", $settingKey, $settingValue);
            $stmt->execute();
        }

        echo json_encode(['success' => true, 'message' => 'Print settings saved successfully']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
