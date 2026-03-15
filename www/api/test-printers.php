<?php
/**
 * Test endpoint to check printer configuration
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('DICOM_VIEWER', true);

require_once __DIR__ . '/../auth/session.php';

header('Content-Type: application/json');

$response = [
    'isLoggedIn' => isLoggedIn(),
    'isElectron' => isset($_SERVER['HTTP_USER_AGENT']) && strpos($_SERVER['HTTP_USER_AGENT'], 'Electron') !== false,
    'sessionData' => [
        'user_id' => $_SESSION['user_id'] ?? null,
        'license_id' => $_SESSION['license_id'] ?? null,
        'username' => $_SESSION['username'] ?? null
    ]
];

if (isLoggedIn()) {
    try {
        $db = getDbConnection();

        // Check if table exists
        $tableCheck = $db->query("SHOW TABLES LIKE 'hospital_printers'");
        $response['tableExists'] = $tableCheck->num_rows > 0;

        if ($response['tableExists']) {
            // Get all printers
            $licenseId = $_SESSION['license_id'] ?? null;
            $stmt = $db->prepare("SELECT * FROM hospital_printers WHERE (license_id = ? OR license_id IS NULL)");
            $stmt->bind_param("i", $licenseId);
            $stmt->execute();
            $result = $stmt->get_result();
            $response['printers'] = $result->fetch_all(MYSQLI_ASSOC);
            $response['printerCount'] = count($response['printers']);
            $stmt->close();
        } else {
            $response['error'] = 'Table hospital_printers does not exist';
        }
    } catch (Exception $e) {
        $response['error'] = $e->getMessage();
    }
} else {
    $response['error'] = 'Not logged in';
}

echo json_encode($response, JSON_PRETTY_PRINT);
?>
