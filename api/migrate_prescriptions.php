<?php
/**
 * Database Migration Script for Prescriptions Table v2.0
 * Run this script to ensure the prescriptions table has all required columns
 * and NO problematic foreign key constraints.
 * 
 * URL: http://localhost/papa/dicom_again/claude/api/migrate_prescriptions.php
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Prescriptions Table Migration</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #eee; }
        h1, h2, h3 { color: #0d6efd; }
        .success { color: #28a745; background: #1e3a1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #28a745; }
        .error { color: #dc3545; background: #3a1e1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #dc3545; }
        .info { color: #17a2b8; background: #1e2a3a; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #17a2b8; }
        .warning { color: #ffc107; background: #3a3a1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #ffc107; }
        code { background: #2d2d44; padding: 2px 8px; border-radius: 4px; }
        pre { background: #0d1117; color: #c9d1d9; padding: 16px; border-radius: 6px; overflow-x: auto; }
        ul { list-style-type: none; padding-left: 0; }
        ul li { padding: 5px 0; }
        ul li:before { content: "✓ "; color: #28a745; }
        a { color: #0d6efd; }
        .btn { display: inline-block; padding: 10px 20px; background: #0d6efd; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px 10px 0; }
        .btn:hover { background: #0b5ed7; }
        .btn-warning { background: #ffc107; color: #000; }
        .btn-warning:hover { background: #e0a800; }
    </style>
</head>
<body>
    <h1>📋 Prescriptions Table Migration</h1>
    
<?php
try {
    $db = getDbConnection();
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    echo "<div class='info'>📊 Database: <code>$dbName</code></div>";
    
    // Check if table exists
    $tableCheck = $db->query("SHOW TABLES LIKE 'prescriptions'");
    $tableExists = ($tableCheck && $tableCheck->num_rows > 0);
    
    if (!$tableExists) {
        echo "<div class='info'>📝 Table does not exist. Creating new table...</div>";
        
        // Create WITHOUT foreign key constraints
        $createSql = "
            CREATE TABLE `prescriptions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `study_uid` VARCHAR(128) NOT NULL,
                `notes` TEXT DEFAULT NULL,
                `attachment_path` VARCHAR(500) DEFAULT NULL,
                `created_by` INT DEFAULT NULL,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `unique_study` (`study_uid`),
                INDEX `idx_study_uid` (`study_uid`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ";
        
        if ($db->query($createSql)) {
            echo "<div class='success'>✅ Table created successfully with all columns!</div>";
        } else {
            echo "<div class='error'>❌ Failed to create table: " . $db->error . "</div>";
        }
    } else {
        echo "<div class='info'>📝 Table exists. Checking and fixing structure...</div>";
        
        // STEP 1: Remove ALL foreign key constraints
        echo "<h2>Step 1: Removing Foreign Key Constraints</h2>";
        
        $fkQuery = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'prescriptions' 
                    AND REFERENCED_TABLE_NAME IS NOT NULL";
        
        $stmt = $db->prepare($fkQuery);
        $stmt->bind_param('s', $dbName);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $fkRemoved = 0;
        while ($row = $result->fetch_assoc()) {
            $fkName = $row['CONSTRAINT_NAME'];
            if ($db->query("ALTER TABLE `prescriptions` DROP FOREIGN KEY `$fkName`")) {
                echo "<div class='success'>✅ Removed foreign key: <code>$fkName</code></div>";
                $fkRemoved++;
            }
        }
        $stmt->close();
        
        // Try common names too
        $commonFks = ['prescriptions_ibfk_1', 'prescriptions_ibfk_2', 'fk_prescriptions_user'];
        foreach ($commonFks as $fkName) {
            if (@$db->query("ALTER TABLE `prescriptions` DROP FOREIGN KEY `$fkName`")) {
                echo "<div class='success'>✅ Removed foreign key: <code>$fkName</code></div>";
                $fkRemoved++;
            }
        }
        
        if ($fkRemoved === 0) {
            echo "<div class='info'>ℹ️ No foreign key constraints found to remove.</div>";
        }
        
        // STEP 2: Check columns
        echo "<h2>Step 2: Checking Columns</h2>";
        
        $result = $db->query("SHOW COLUMNS FROM prescriptions");
        $existingColumns = [];
        while ($row = $result->fetch_assoc()) {
            $existingColumns[$row['Field']] = $row;
        }
        
        echo "<p>Current columns: <code>" . implode(', ', array_keys($existingColumns)) . "</code></p>";
        
        // Required columns
        $requiredColumns = [
            'study_uid' => 'VARCHAR(128) NOT NULL',
            'notes' => 'TEXT DEFAULT NULL',
            'attachment_path' => 'VARCHAR(500) DEFAULT NULL',
            'created_by' => 'INT DEFAULT NULL',
            'created_at' => 'DATETIME DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        ];
        
        foreach ($requiredColumns as $column => $definition) {
            if (!isset($existingColumns[$column])) {
                $sql = "ALTER TABLE `prescriptions` ADD COLUMN `$column` $definition";
                if ($db->query($sql)) {
                    echo "<div class='success'>✅ Added column: <code>$column</code></div>";
                } else if ($db->errno !== 1060) { // Ignore duplicate column error
                    echo "<div class='error'>❌ Failed to add <code>$column</code>: " . $db->error . "</div>";
                }
            } else {
                echo "<div class='info'>✓ Column exists: <code>$column</code></div>";
            }
        }
        
        // Handle prescribed_by -> created_by rename
        if (isset($existingColumns['prescribed_by'])) {
            if (!isset($existingColumns['created_by'])) {
                if ($db->query("ALTER TABLE `prescriptions` CHANGE `prescribed_by` `created_by` INT DEFAULT NULL")) {
                    echo "<div class='success'>✅ Renamed prescribed_by to created_by</div>";
                }
            } else {
                @$db->query("ALTER TABLE `prescriptions` DROP COLUMN `prescribed_by`");
            }
        }
        
        // STEP 3: Ensure indexes exist
        echo "<h2>Step 3: Checking Indexes</h2>";
        
        $indexCheck = $db->query("SHOW INDEX FROM prescriptions WHERE Key_name = 'unique_study'");
        if ($indexCheck && $indexCheck->num_rows === 0) {
            @$db->query("ALTER TABLE `prescriptions` ADD UNIQUE KEY `unique_study` (`study_uid`)");
            echo "<div class='success'>✅ Added unique_study index</div>";
        } else {
            echo "<div class='info'>✓ unique_study index exists</div>";
        }
        
        $indexCheck = $db->query("SHOW INDEX FROM prescriptions WHERE Key_name = 'idx_study_uid'");
        if ($indexCheck && $indexCheck->num_rows === 0) {
            @$db->query("ALTER TABLE `prescriptions` ADD INDEX `idx_study_uid` (`study_uid`)");
            echo "<div class='success'>✅ Added idx_study_uid index</div>";
        } else {
            echo "<div class='info'>✓ idx_study_uid index exists</div>";
        }
    }
    
    // Show final table structure
    echo "<h2>Final Table Structure</h2>";
    echo "<pre>";
    $result = $db->query("DESCRIBE prescriptions");
    if ($result) {
        printf("%-18s %-25s %-6s %-5s %-20s\n", "Column", "Type", "Null", "Key", "Default");
        printf("%s\n", str_repeat("-", 80));
        while ($row = $result->fetch_assoc()) {
            printf("%-18s %-25s %-6s %-5s %-20s\n", 
                $row['Field'], 
                $row['Type'], 
                $row['Null'], 
                $row['Key'], 
                $row['Default'] ?? 'NULL'
            );
        }
    }
    echo "</pre>";
    
    // Test the table
    echo "<h2>Testing Table</h2>";
    
    $testStudyUID = 'MIGRATION_TEST_' . time();
    $testSql = "INSERT INTO prescriptions (study_uid, notes, created_at, updated_at) VALUES (?, 'Migration test', NOW(), NOW())";
    $stmt = $db->prepare($testSql);
    $stmt->bind_param('s', $testStudyUID);
    
    if ($stmt->execute()) {
        echo "<div class='success'>✅ Test insert successful!</div>";
        $db->query("DELETE FROM prescriptions WHERE study_uid = '$testStudyUID'");
        echo "<div class='info'>ℹ️ Test record cleaned up.</div>";
    } else {
        echo "<div class='error'>❌ Test insert failed: " . $stmt->error . "</div>";
    }
    $stmt->close();
    
    echo "<div class='success' style='margin-top: 20px; padding: 20px;'>";
    echo "<h3 style='margin-top: 0;'>🎉 Migration Complete!</h3>";
    echo "<p>The prescriptions table is ready to use.</p>";
    echo "</div>";
    
    echo "<p style='margin-top: 20px;'>";
    echo "<a href='../dashboard.php' class='btn'>← Back to Dashboard</a>";
    echo "<a href='fix_prescriptions_fk.php' class='btn btn-warning'>Run FK Fix Script</a>";
    echo "</p>";
    
} catch (Exception $e) {
    echo "<div class='error'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</div>";
}
?>

</body>
</html>
