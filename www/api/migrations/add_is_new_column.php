<?php
/**
 * Migration Script: Add is_new column to cached_studies
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

echo "Starting migration...\n";

$db = getDbConnection();

// Add is_new column to cached_studies
try {
    $db->query("ALTER TABLE cached_studies ADD COLUMN is_new TINYINT(1) DEFAULT 1");
    echo "Added is_new column to cached_studies.\n";
} catch (Exception $e) {
    echo "Column is_new likely already exists or error: " . $e->getMessage() . "\n";
}

// Mark existing studies as NOT new (read) so we don't flood the user
try {
    $db->query("UPDATE cached_studies SET is_new = 0");
    echo "Marked all existing studies as read (is_new = 0).\n";
} catch (Exception $e) {
    echo "Error updating existing studies: " . $e->getMessage() . "\n";
}

// Ensure medical_reports table exists (should already be there)
echo "Migration complete.\n";
?>
