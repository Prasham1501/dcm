<?php
/**
 * Settings Test Script
 * Tests if settings are being saved and applied correctly
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Settings Test</title>
    <style>
        body { font-family: monospace; background: #1a1a1a; color: #0f0; padding: 20px; }
        .pass { color: #0f0; }
        .fail { color: #f00; }
        .info { color: #0af; }
        h2 { color: #ff0; }
        pre { background: #000; padding: 10px; border: 1px solid #333; }
    </style>
</head>
<body>
    <h1>🧪 DICOM Viewer Settings Test</h1>
    
<?php
echo "<h2>1. Testing Database Connection</h2>\n";
try {
    $db = getDbConnection();
    echo "<p class='pass'>✓ Database connected successfully</p>\n";
} catch (Exception $e) {
    echo "<p class='fail'>✗ Database connection failed: " . $e->getMessage() . "</p>\n";
    exit;
}

echo "<h2>2. Checking System Settings Table</h2>\n";
$result = $db->query("SHOW TABLES LIKE 'system_settings'");
if ($result->num_rows > 0) {
    echo "<p class='pass'>✓ system_settings table exists</p>\n";
    
    $count = $db->query("SELECT COUNT(*) as cnt FROM system_settings")->fetch_assoc();
    echo "<p class='info'>Found {$count['cnt']} settings in database</p>\n";
} else {
    echo "<p class='fail'>✗ system_settings table does not exist</p>\n";
}

echo "<h2>3. Checking Hospital Data Config Table</h2>\n";
$result = $db->query("SHOW TABLES LIKE 'hospital_data_config'");
if ($result->num_rows > 0) {
    echo "<p class='pass'>✓ hospital_data_config table exists</p>\n";
} else {
    echo "<p class='fail'>✗ hospital_data_config table does not exist</p>\n";
}

echo "<h2>4. Checking Imported Studies Table</h2>\n";
$result = $db->query("SHOW TABLES LIKE 'imported_studies'");
if ($result->num_rows > 0) {
    echo "<p class='pass'>✓ imported_studies table exists</p>\n";
} else {
    echo "<p class='fail'>✗ imported_studies table does not exist</p>\n";
}

echo "<h2>5. Testing Settings Retrieval</h2>\n";
$settings = $db->query("SELECT * FROM system_settings ORDER BY category, setting_key");
if ($settings) {
    echo "<p class='pass'>✓ Can retrieve settings</p>\n";
    echo "<pre>\n";
    while ($row = $settings->fetch_assoc()) {
        echo sprintf("%-30s = %s\n", $row['setting_key'], 
                    $row['is_sensitive'] ? '********' : $row['setting_value']);
    }
    echo "</pre>\n";
} else {
    echo "<p class='fail'>✗ Cannot retrieve settings</p>\n";
}

echo "<h2>6. Testing Orthanc Connection</h2>\n";
$orthancUrl = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='orthanc_url'")->fetch_assoc()['setting_value'] ?? ORTHANC_URL;
$orthancUser = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='orthanc_username'")->fetch_assoc()['setting_value'] ?? ORTHANC_USER;
$orthancPass = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='orthanc_password'")->fetch_assoc()['setting_value'] ?? ORTHANC_PASS;

echo "<p class='info'>Testing connection to: $orthancUrl</p>\n";

$ch = curl_init($orthancUrl . '/system');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERPWD, $orthancUser . ':' . $orthancPass);
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200 && $response) {
    $systemInfo = json_decode($response, true);
    echo "<p class='pass'>✓ Orthanc connection successful</p>\n";
    echo "<pre>\n";
    echo "Orthanc Version: " . ($systemInfo['Version'] ?? 'Unknown') . "\n";
    echo "Orthanc Name: " . ($systemInfo['Name'] ?? 'Unknown') . "\n";
    echo "DICOM AET: " . ($systemInfo['DicomAet'] ?? 'Unknown') . "\n";
    echo "DICOM Port: " . ($systemInfo['DicomPort'] ?? 'Unknown') . "\n";
    echo "</pre>\n";
} else {
    echo "<p class='fail'>✗ Orthanc connection failed (HTTP $httpCode)</p>\n";
}

echo "<h2>7. Testing DICOM Settings</h2>\n";
$dicomAet = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='dicom_ae_title'")->fetch_assoc()['setting_value'] ?? 'NOT SET';
$dicomPort = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='dicom_port'")->fetch_assoc()['setting_value'] ?? 'NOT SET';
$dicomHost = $db->query("SELECT setting_value FROM system_settings WHERE setting_key='dicom_host'")->fetch_assoc()['setting_value'] ?? 'NOT SET';

echo "<pre>\n";
echo "AE Title: $dicomAet\n";
echo "Port: $dicomPort\n";
echo "Host: $dicomHost\n";
echo "</pre>\n";

if ($dicomAet !== 'NOT SET' && $dicomPort !== 'NOT SET') {
    echo "<p class='pass'>✓ DICOM settings are configured</p>\n";
    echo "<p class='info'>You can send DICOM files to: $dicomHost:$dicomPort with AET=$dicomAet</p>\n";
} else {
    echo "<p class='fail'>✗ DICOM settings not fully configured</p>\n";
}

echo "<h2>8. Summary</h2>\n";
echo "<p class='info'>All core functionality tested!</p>\n";
echo "<p class='info'>Visit <a href='../admin/settings.php' style='color:#0af'>Settings Page</a> to configure</p>\n";
echo "<p class='info'>Visit <a href='../admin/hospital-config.php' style='color:#0af'>Hospital Config</a> to import</p>\n";
?>

<h2>9. Next Steps</h2>
<ul>
    <li>Configure custom DICOM port in Settings page</li>
    <li>Test by sending DICOM from your modality</li>
    <li>Import existing studies via Hospital Config</li>
</ul>

</body>
</html>
