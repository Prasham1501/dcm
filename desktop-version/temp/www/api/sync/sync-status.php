<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Sync Status API Endpoint
 *
 * GET /api/sync/sync-status.php
 * Returns sync status and history
 *
 * This is an alias for status.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/status.php';
