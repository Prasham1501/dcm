<?php
$password = 'Admin@123';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
echo "New hash for 'Admin@123': " . $hash . "\n";
echo "Verification test: " . (password_verify($password, $hash) ? 'SUCCESS' : 'FAILED') . "\n";
