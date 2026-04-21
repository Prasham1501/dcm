<?php
// fix_db.php - Create missing app_settings table
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../auth/session.php';

$db = getDbConnection();

$sql = "CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` longtext,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($db->query($sql) === TRUE) {
    echo "Table app_settings created successfully or already exists.\n";
} else {
    echo "Error creating table: " . $db->error . "\n";
}

// Check system_settings too just in case
$check = $db->query("SHOW TABLES LIKE 'system_settings'");
if($check->num_rows > 0) {
    echo "Note: system_settings table exists. You might want to migrate data if needed.\n";
}
?>
