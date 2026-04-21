<?php
/**
 * Simple API Test
 */
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output

define('DICOM_VIEWER', true);

// Start output buffering to catch any unwanted output
ob_start();

require_once __DIR__ . '/../../includes/config.php';

// Clear any buffered output
ob_end_clean();

// Now set header
header('Content-Type: application/json');

// Check if user is logged in
session_start();

$debug = [
    'session_started' => session_status() === PHP_SESSION_ACTIVE,
    'user_id_set' => isset($_SESSION['user_id']),
    'user_id' => $_SESSION['user_id'] ?? null,
    'role' => $_SESSION['role'] ?? null,
    'session_vars' => array_keys($_SESSION)
];

echo json_encode([
    'success' => true,
    'debug' => $debug
]);
