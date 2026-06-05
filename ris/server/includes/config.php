<?php
/**
 * RIS server shim: re-export the viewer's config.
 * Allows RIS API endpoints to keep using `__DIR__ . '/../../includes/config.php'`
 * without bundling a duplicate config.
 */
$viewerConfig = __DIR__ . '/../../www/includes/config.php';   // dev: project layout
if (!file_exists($viewerConfig)) {
    // prod: resources/ris-server/includes -> resources/www/includes
    $viewerConfig = __DIR__ . '/../../../www/includes/config.php';
}
if (!file_exists($viewerConfig)) {
    http_response_code(500);
    die('RIS shim: viewer includes/config.php not found');
}
if (!defined('DICOM_VIEWER')) define('DICOM_VIEWER', true);
require_once $viewerConfig;
