<?php
/**
 * Run Migration for Nodes and Printers
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Only admin
if (!isAdmin()) {
    die('Access denied');
}

$db = getDbConnection();
$sql = file_get_contents(__DIR__ . '/../migration_nodes_printers.txt');

// Split by semicolon but handle potential semicolons in strings (simple split for now)
$statements = array_filter(array_map('trim', explode(';', $sql)));

echo "<pre>";
foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    
    echo "Executing: " . substr($stmt, 0, 50) . "...\n";
    try {
        if ($db->query($stmt)) {
            echo "SUCCESS\n";
        } else {
            echo "ERROR: " . $db->error . "\n";
        }
    } catch (Exception $e) {
        echo "EXCEPTION: " . $e->getMessage() . "\n";
    }
    echo "-------------------\n";
}
echo "Migration Complete.</pre>";
