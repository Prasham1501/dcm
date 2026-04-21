<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Disable Auto-Sync API Endpoint
 *
 * POST /api/sync/disable-sync.php
 * Disables automatic sync
 *
 * This is an alias for disable-auto.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/disable-auto.php';
