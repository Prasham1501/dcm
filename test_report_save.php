<?php
// Test report save API
define('DICOM_VIEWER', true);
require_once __DIR__ . '/desktop-version/electron/www/includes/config.php';
require_once __DIR__ . '/desktop-version/electron/www/auth/session.php';

// Simulate user session
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin';
$_SESSION['logged_in'] = true;

// Test data
$testData = [
    'study_uid' => 'TEST_STUDY_UID_123',
    'patient_id' => 'TEST_PT_001',
    'patient_name' => 'Test Patient',
    'template_name' => 'General',
    'title' => 'Test Medical Report',
    'indication' => 'Test indication',
    'technique' => 'Test technique',
    'findings' => 'Test findings',
    'impression' => 'Test impression',
    'reporting_physician_name' => 'Dr. Test'
];

echo "Testing report save with data:\n";
print_r($testData);

try {
    $db = getDbConnection();
    
    $stmt = $db->prepare("
        INSERT INTO medical_reports (
            study_uid,
            patient_id,
            patient_name,
            template_name,
            title,
            indication,
            technique,
            findings,
            impression,
            reporting_physician_id,
            reporting_physician_name,
            created_by,
            status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    ");
    
    $null_val = null;
    $created_by = 1;
    
    $stmt->bind_param(
        "sssssssssssi",
        $testData['study_uid'],
        $testData['patient_id'],
        $testData['patient_name'],
        $testData['template_name'],
        $testData['title'],
        $testData['indication'],
        $testData['technique'],
        $testData['findings'],
        $testData['impression'],
        $null_val,
        $testData['reporting_physician_name'],
        $created_by
    );
    
    if ($stmt->execute()) {
        echo "\n✅ SUCCESS! Report saved with ID: " . $stmt->insert_id . "\n";
        
        // Clean up test data
        $db->query("DELETE FROM medical_reports WHERE study_uid = 'TEST_STUDY_UID_123'");
        echo "✅ Test data cleaned up\n";
    } else {
        echo "\n❌ FAILED: " . $stmt->error . "\n";
    }
    
    $stmt->close();
    
} catch (Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
}
