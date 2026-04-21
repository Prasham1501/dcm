<?php
header('Content-Type: application/json');
session_start();

echo json_encode([
    'success' => true,
    'test' => 'working',
    'session_id' => session_id(),
    'user_id' => $_SESSION['user_id'] ?? 'not set',
    'role' => $_SESSION['role'] ?? 'not set'
]);
