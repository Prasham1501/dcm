<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Test Google Drive Connection
 *
 * POST /api/backup/test-gdrive-connection.php
 *
 * Tests Google Drive API connection
 * This is an alias for test-connection.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/test-connection.php';
