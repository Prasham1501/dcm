<?php
// Test login functionality
define('DICOM_VIEWER', true);
require_once __DIR__ . '/desktop-version/electron/www/auth/session.php';

echo "=== Testing Login Functionality ===\n\n";

// Test credentials
$email = 'admin@hospital.com';
$password = 'Admin@123';

echo "Testing login with:\n";
echo "Email: $email\n";
echo "Password: $password\n\n";

// Attempt login
$result = loginUser($email, $password);

if ($result['success']) {
    echo "✅ LOGIN SUCCESSFUL!\n";
    echo "User details:\n";
    print_r($result['user']);
} else {
    echo "❌ LOGIN FAILED!\n";
    echo "Error: " . $result['error'] . "\n";
}

// Check database directly
echo "\n=== Database Check ===\n";
$db = getDbConnection();
$stmt = $db->prepare("SELECT id, username, email, role, is_active FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$dbResult = $stmt->get_result();

if ($dbResult->num_rows > 0) {
    $user = $dbResult->fetch_assoc();
    echo "✅ User found in database:\n";
    print_r($user);
} else {
    echo "❌ User NOT found in database\n";
}
$stmt->close();

// Test password hash
echo "\n=== Password Hash Test ===\n";
$stmt = $db->prepare("SELECT password_hash FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$hashResult = $stmt->get_result();
if ($hashResult->num_rows > 0) {
    $hashData = $hashResult->fetch_assoc();
    $hash = $hashData['password_hash'];
    echo "Hash from DB: " . substr($hash, 0, 30) . "...\n";
    $verified = password_verify($password, $hash);
    echo "Password verification: " . ($verified ? "✅ PASS" : "❌ FAIL") . "\n";
}
$stmt->close();
