<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Test FTP Connection API Endpoint
 *
 * POST /api/sync/test-ftp-connection.php
 * Tests FTP connectivity
 *
 * This is an alias for test-connection.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/test-connection.php';
