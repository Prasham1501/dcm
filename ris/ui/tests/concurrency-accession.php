<?php
/**
 * Concurrency worker: opens its own DB connection and draws ONE accession number.
 * Launched many times in parallel by concurrency-accession.ps1 to prove that the
 * RisCounters SELECT ... FOR UPDATE locking never hands out a duplicate.
 */
require_once __DIR__ . '/../includes/ris/RisCounters.php';

$host = getenv('TEST_DB_HOST') ?: '127.0.0.1';
$port = (int) (getenv('TEST_DB_PORT') ?: 3306);
$name = getenv('TEST_DB_NAME') ?: 'dicom_viewer_pro_test';

$db = new mysqli($host, 'root', '', $name, $port);
if ($db->connect_error) {
    fwrite(STDERR, 'DB connect failed: ' . $db->connect_error);
    exit(2);
}
echo (new RisCounters($db))->next('accession');
