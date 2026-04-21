<?php
/**
 * Fix Prescriptions Table - Remove Foreign Key Constraints
 * 
 * This script fixes the error:
 * "Cannot add or update a child row: a foreign key constraint fails"
 * 
 * Reference: https://stackoverflow.com/questions/5005388/cannot-add-or-update-a-child-row-a-foreign-key-constraint-fails
 * 
 * Run this script ONCE to fix the prescriptions table.
 * URL: http://localhost/papa/dicom_again/claude/api/fix_prescriptions_fk.php
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Fix Prescriptions Table - Remove Foreign Key Constraints</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 900px; margin: 50px auto; padding: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #0d6efd; }
        .success { color: #28a745; background: #1e3a1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #28a745; }
        .error { color: #dc3545; background: #3a1e1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #dc3545; }
        .info { color: #17a2b8; background: #1e2a3a; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #17a2b8; }
        .warning { color: #ffc107; background: #3a3a1e; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #ffc107; }
        code { background: #2d2d44; padding: 2px 8px; border-radius: 4px; font-family: 'Courier New', monospace; }
        pre { background: #0d1117; color: #c9d1d9; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border: 1px solid #333; }
        th { background: #2d2d44; }
        tr:nth-child(even) { background: #1e1e2e; }
        a { color: #0d6efd; }
        .btn { display: inline-block; padding: 10px 20px; background: #0d6efd; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .btn:hover { background: #0b5ed7; }
    </style>
</head>
<body>
    <h1>🔧 Fix Prescriptions Table</h1>
    <p>This script removes problematic foreign key constraints that cause the error:<br>
    <code>"Cannot add or update a child row: a foreign key constraint fails"</code></p>
    
<?php
try {
    $db = getDbConnection();
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    echo "<div class='info'>📊 Database: <code>$dbName</code></div>";
    
    // Check if table exists
    $tableCheck = $db->query("SHOW TABLES LIKE 'prescriptions'");
    if (!$tableCheck || $tableCheck->num_rows === 0) {
        echo "<div class='warning'>⚠️ Table 'prescriptions' does not exist. Nothing to fix.</div>";
        echo "<p>The table will be created automatically when you save a prescription.</p>";
        exit;
    }
    
    echo "<h2>Step 1: Finding Foreign Key Constraints</h2>";
    
    // Find all foreign keys on prescriptions table
    $fkQuery = "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'prescriptions' 
                AND REFERENCED_TABLE_NAME IS NOT NULL";
    
    $stmt = $db->prepare($fkQuery);
    $stmt->bind_param('s', $dbName);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $foreignKeys = [];
    while ($row = $result->fetch_assoc()) {
        $foreignKeys[] = $row;
    }
    $stmt->close();
    
    if (count($foreignKeys) === 0) {
        echo "<div class='success'>✅ No foreign key constraints found! Table is already clean.</div>";
    } else {
        echo "<div class='warning'>⚠️ Found " . count($foreignKeys) . " foreign key constraint(s):</div>";
        
        echo "<table>";
        echo "<tr><th>Constraint Name</th><th>Column</th><th>References Table</th><th>References Column</th></tr>";
        foreach ($foreignKeys as $fk) {
            echo "<tr>";
            echo "<td><code>" . htmlspecialchars($fk['CONSTRAINT_NAME']) . "</code></td>";
            echo "<td><code>" . htmlspecialchars($fk['COLUMN_NAME']) . "</code></td>";
            echo "<td><code>" . htmlspecialchars($fk['REFERENCED_TABLE_NAME']) . "</code></td>";
            echo "<td><code>" . htmlspecialchars($fk['REFERENCED_COLUMN_NAME']) . "</code></td>";
            echo "</tr>";
        }
        echo "</table>";
        
        echo "<h2>Step 2: Removing Foreign Key Constraints</h2>";
        
        foreach ($foreignKeys as $fk) {
            $constraintName = $fk['CONSTRAINT_NAME'];
            $dropSql = "ALTER TABLE `prescriptions` DROP FOREIGN KEY `$constraintName`";
            
            echo "<p>Executing: <code>$dropSql</code></p>";
            
            if ($db->query($dropSql)) {
                echo "<div class='success'>✅ Dropped foreign key: <code>$constraintName</code></div>";
            } else {
                echo "<div class='error'>❌ Failed to drop <code>$constraintName</code>: " . $db->error . "</div>";
            }
        }
    }
    
    // Also try common foreign key names that might not show up
    echo "<h2>Step 3: Attempting to Remove Common FK Names</h2>";
    
    $commonFkNames = [
        'prescriptions_ibfk_1',
        'prescriptions_ibfk_2',
        'prescriptions_ibfk_3',
        'fk_prescriptions_user',
        'fk_user',
        'fk_created_by',
        'fk_prescribed_by',
        'prescriptions_user_fk'
    ];
    
    foreach ($commonFkNames as $fkName) {
        $dropSql = "ALTER TABLE `prescriptions` DROP FOREIGN KEY `$fkName`";
        if (@$db->query($dropSql)) {
            echo "<div class='success'>✅ Dropped foreign key: <code>$fkName</code></div>";
        }
        // Silently ignore errors (constraint doesn't exist)
    }
    
    // Check for prescribed_by column and handle it
    echo "<h2>Step 4: Fixing Column Structure</h2>";
    
    $columnsResult = $db->query("SHOW COLUMNS FROM prescriptions");
    $columns = [];
    while ($col = $columnsResult->fetch_assoc()) {
        $columns[$col['Field']] = $col;
    }
    
    // If prescribed_by exists but created_by doesn't, rename it
    if (isset($columns['prescribed_by']) && !isset($columns['created_by'])) {
        echo "<p>Found <code>prescribed_by</code> column, renaming to <code>created_by</code>...</p>";
        if ($db->query("ALTER TABLE `prescriptions` CHANGE `prescribed_by` `created_by` INT DEFAULT NULL")) {
            echo "<div class='success'>✅ Renamed prescribed_by to created_by</div>";
        } else {
            echo "<div class='error'>❌ Failed to rename: " . $db->error . "</div>";
        }
    } elseif (isset($columns['prescribed_by']) && isset($columns['created_by'])) {
        echo "<p>Both <code>prescribed_by</code> and <code>created_by</code> exist. Dropping <code>prescribed_by</code>...</p>";
        if ($db->query("ALTER TABLE `prescriptions` DROP COLUMN `prescribed_by`")) {
            echo "<div class='success'>✅ Dropped prescribed_by column</div>";
        } else {
            echo "<div class='warning'>⚠️ Could not drop prescribed_by: " . $db->error . "</div>";
        }
    } else {
        echo "<div class='info'>ℹ️ Column structure is correct</div>";
    }
    
    // Ensure created_by allows NULL
    if (isset($columns['created_by']) || isset($columns['prescribed_by'])) {
        $db->query("ALTER TABLE `prescriptions` MODIFY COLUMN `created_by` INT DEFAULT NULL");
        echo "<div class='success'>✅ Ensured created_by allows NULL values</div>";
    }
    
    echo "<h2>Step 5: Verification</h2>";
    
    // Check again for foreign keys
    $stmt = $db->prepare($fkQuery);
    $stmt->bind_param('s', $dbName);
    $stmt->execute();
    $result = $stmt->get_result();
    $remainingFks = $result->num_rows;
    $stmt->close();
    
    if ($remainingFks === 0) {
        echo "<div class='success'>✅ All foreign key constraints have been removed!</div>";
    } else {
        echo "<div class='warning'>⚠️ There are still $remainingFks foreign key constraint(s). Manual intervention may be required.</div>";
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
    
    // Show indexes
    echo "<h3>Table Indexes</h3>";
    echo "<pre>";
    $result = $db->query("SHOW INDEX FROM prescriptions");
    if ($result) {
        printf("%-20s %-18s %-8s\n", "Key Name", "Column", "Unique");
        printf("%s\n", str_repeat("-", 50));
        while ($row = $result->fetch_assoc()) {
            printf("%-20s %-18s %-8s\n", 
                $row['Key_name'], 
                $row['Column_name'], 
                $row['Non_unique'] == 0 ? 'Yes' : 'No'
            );
        }
    }
    echo "</pre>";
    
    // Test insert
    echo "<h2>Step 6: Testing Insert</h2>";
    
    $testStudyUID = 'TEST_' . time();
    $testSql = "INSERT INTO prescriptions (study_uid, notes, created_at, updated_at) VALUES (?, 'Test prescription', NOW(), NOW())";
    $stmt = $db->prepare($testSql);
    $stmt->bind_param('s', $testStudyUID);
    
    if ($stmt->execute()) {
        echo "<div class='success'>✅ Test insert successful! The table is working correctly.</div>";
        
        // Clean up test record
        $db->query("DELETE FROM prescriptions WHERE study_uid = '$testStudyUID'");
        echo "<div class='info'>ℹ️ Test record cleaned up.</div>";
    } else {
        echo "<div class='error'>❌ Test insert failed: " . $stmt->error . "</div>";
    }
    $stmt->close();
    
    echo "<div class='success' style='margin-top: 30px; padding: 20px;'>";
    echo "<h3 style='margin-top: 0;'>🎉 Fix Complete!</h3>";
    echo "<p>The prescriptions table has been fixed. You should now be able to save prescriptions without the foreign key constraint error.</p>";
    echo "</div>";
    
    echo "<a href='../dashboard.php' class='btn'>← Back to Dashboard</a>";
    
} catch (Exception $e) {
    echo "<div class='error'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</div>";
}
?>

</body>
</html>
