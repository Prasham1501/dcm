<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * API: Get Last Backup Status
 *
 * GET /api/backup/backup-status.php
 *
 * Returns last backup status and configuration
 * This is an alias for status.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Include the main implementation
require_once __DIR__ . '/status.php';
