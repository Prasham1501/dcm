<?php
define('DICOM_VIEWER', true);
require_once __DIR__ . '/desktop-version/electron/www/includes/config.php';

$password = 'Admin@123';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

echo "Generating new hash for password: $password\n";
echo "Hash: $hash\n\n";

$db = getDbConnection();

// Delete and insert
$db->query("DELETE FROM users");
$stmt = $db->prepare("INSERT INTO users (id, username, password_hash, full_name, email, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)");

$id = 1;
$username = 'admin';
$fullName = 'System Administrator';
$email = 'admin@hospital.com';
$role = 'admin';
$isActive = 1;

$stmt->bind_param("isssssi", $id, $username, $hash, $fullName, $email, $role, $isActive);

if ($stmt->execute()) {
    echo "✅ User inserted successfully!\n\n";
    
    // Verify
    $verify = $db->query("SELECT id, username, email, role FROM users WHERE email='admin@hospital.com'");
    if ($row = $verify->fetch_assoc()) {
        echo "Verified user in database:\n";
        print_r($row);
    }
    
    // Test password
    $hashCheck = $db->query("SELECT password_hash FROM users WHERE email='admin@hospital.com'");
    if ($hashRow = $hashCheck->fetch_assoc()) {
        $dbHash = $hashRow['password_hash'];
        echo "\nPassword verification: " . (password_verify($password, $dbHash) ? "✅ SUCCESS" : "❌ FAIL") . "\n";
    }
} else {
    echo "❌ Failed to insert user: " . $stmt->error . "\n";
}

$stmt->close();
