<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../auth/session.php';
echo json_encode(['status' => 'ok', 'test' => 3, 'logged_in' => isLoggedIn()]);
