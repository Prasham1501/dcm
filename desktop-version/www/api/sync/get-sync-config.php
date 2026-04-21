<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Get Sync Configuration API Endpoint
 *
 * GET /api/sync/get-sync-config.php
 * Returns current sync configuration (password masked)
 *
 * This is an alias for get-config.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/get-config.php';
