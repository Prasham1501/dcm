<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Logout Script
 */

// Start session and load config
define('DICOM_VIEWER', true);
require_once __DIR__ . '/auth/session.php';

// Logout user
logoutUser();

// Redirect to login
header('Location: ' . BASE_PATH . '/login.php?logged_out=1');
exit;
