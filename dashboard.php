<?php
// Start session and check authentication
define('DICOM_VIEWER', true);
require_once __DIR__ . '/auth/session.php';

// Redirect to login if not authenticated
requireLogin();

// Redirect to patient list page (HTML-based workflow)
header('Location: ' . BASE_PATH . '/pages/patients.html');
exit;