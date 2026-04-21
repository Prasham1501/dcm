<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Enable Auto-Sync API Endpoint
 *
 * POST /api/sync/enable-sync.php
 * Enables automatic sync
 *
 * This is an alias for enable-auto.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/enable-auto.php';
