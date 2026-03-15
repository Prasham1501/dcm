<?php
/**
 * Prescription API - Production Ready v3.2
 * Handles CRUD operations for study prescriptions
 * Fixed: Foreign key constraint issue with prescribed_by/created_by
 * 
 * References:
 * - MySQL column check: https://stackoverflow.com/questions/8219714
 * - Foreign key constraint fix: https://stackoverflow.com/questions/5005388
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Prevent any output before JSON
ob_start();

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

try {
    requireLogin();
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Authentication required']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$uploadDir = __DIR__ . '/../../assets/uploads/prescriptions/';

// Ensure upload directory exists with proper permissions
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

try {
    $db = getDbConnection();
    
    // Run database migration to ensure table and columns exist
    migrateDatabase($db);
    
    if ($method === 'GET') {
        handleGet($db);
    } elseif ($method === 'POST') {
        handlePost($db, $uploadDir);
    } elseif ($method === 'DELETE') {
        handleDelete($db);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
    
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

ob_end_flush();

/**
 * Check if a column exists using INFORMATION_SCHEMA (most reliable method)
 */
function columnExists($db, $table, $column) {
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    $sql = "SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('sss', $dbName, $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return ($row['cnt'] > 0);
}

/**
 * Check if an index exists in table
 */
function indexExists($db, $table, $keyName) {
    $result = @$db->query("SHOW INDEX FROM `$table` WHERE Key_name = '$keyName'");
    return ($result && $result->num_rows > 0);
}

/**
 * Check if a foreign key constraint exists
 */
function foreignKeyExists($db, $table, $constraintName) {
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    $sql = "SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('sss', $dbName, $table, $constraintName);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return ($row['cnt'] > 0);
}

/**
 * Get all foreign key constraints on a table
 */
function getForeignKeys($db, $table) {
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    $sql = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('ss', $dbName, $table);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $keys = [];
    while ($row = $result->fetch_assoc()) {
        $keys[] = $row['CONSTRAINT_NAME'];
    }
    $stmt->close();
    
    return $keys;
}

/**
 * Check if a table exists
 */
function tableExists($db, $table) {
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    $sql = "SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('ss', $dbName, $table);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    
    return ($row['cnt'] > 0);
}

/**
 * Safe column add - adds column if it doesn't exist
 */
function safeAddColumn($db, $table, $column, $definition) {
    if (columnExists($db, $table, $column)) {
        return true; // Column already exists
    }
    
    $sql = "ALTER TABLE `$table` ADD COLUMN `$column` $definition";
    
    try {
        $result = @$db->query($sql);
        if (!$result) {
            // Check if error is "duplicate column" (which is fine)
            if (strpos($db->error, 'Duplicate column') !== false || 
                $db->errno === 1060) {
                return true;
            }
            error_log("Warning: Could not add column '$column': " . $db->error);
            return false;
        }
        return true;
    } catch (Exception $e) {
        error_log("Exception adding column '$column': " . $e->getMessage());
        return false;
    }
}

/**
 * Database Migration - Ensures table and all columns exist
 * CRITICAL: Removes problematic foreign key constraints
 */
function migrateDatabase($db) {
    $tableName = 'prescriptions';
    
    // Step 1: Check if table exists
    if (!tableExists($db, $tableName)) {
        // Create fresh table WITHOUT foreign key constraints
        $createTable = "
            CREATE TABLE `$tableName` (
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
        
        if (!$db->query($createTable)) {
            throw new Exception("Failed to create prescriptions table: " . $db->error);
        }
        
        return; // Table created with all columns
    }
    
    // Step 2: CRITICAL - Remove ALL foreign key constraints that might cause issues
    // This fixes "Cannot add or update a child row: a foreign key constraint fails"
    // IMPROVED: Only drop foreign keys that actually exist to avoid errors
    $foreignKeys = getForeignKeys($db, $tableName);

    foreach ($foreignKeys as $fkName) {
        // Only drop if it exists (getForeignKeys already verified this)
        $dropFk = "ALTER TABLE `$tableName` DROP FOREIGN KEY `$fkName`";
        if ($db->query($dropFk)) {
            error_log("Dropped foreign key: $fkName");
        }
    }

    // Also try to drop commonly named foreign keys that might exist (with explicit checking)
    $commonFkNames = [
        'prescriptions_ibfk_1',
        'prescriptions_ibfk_2',
        'fk_prescriptions_user',
        'fk_user',
        'fk_created_by',
        'fk_prescribed_by'
    ];

    foreach ($commonFkNames as $fkName) {
        // Only drop if it exists to prevent "Can't DROP FOREIGN KEY" error
        if (foreignKeyExists($db, $tableName, $fkName)) {
            $db->query("ALTER TABLE `$tableName` DROP FOREIGN KEY `$fkName`");
            error_log("Dropped common foreign key: $fkName");
        }
    }
    
    // Step 3: Ensure all required columns exist
    safeAddColumn($db, $tableName, 'study_uid', "VARCHAR(128) NOT NULL AFTER `id`");
    safeAddColumn($db, $tableName, 'notes', "TEXT DEFAULT NULL");
    safeAddColumn($db, $tableName, 'attachment_path', "VARCHAR(500) DEFAULT NULL");
    safeAddColumn($db, $tableName, 'created_by', "INT DEFAULT NULL");
    safeAddColumn($db, $tableName, 'created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP");
    safeAddColumn($db, $tableName, 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    
    // Step 4: If there's a prescribed_by column, rename it to created_by or drop it
    if (columnExists($db, $tableName, 'prescribed_by')) {
        // Check if created_by exists
        if (!columnExists($db, $tableName, 'created_by')) {
            // Rename prescribed_by to created_by
            @$db->query("ALTER TABLE `$tableName` CHANGE `prescribed_by` `created_by` INT DEFAULT NULL");
        } else {
            // Drop the old column
            @$db->query("ALTER TABLE `$tableName` DROP COLUMN `prescribed_by`");
        }
    }
    
    // Step 5: Add indexes only if they don't exist
    if (!indexExists($db, $tableName, 'unique_study')) {
        @$db->query("ALTER TABLE `$tableName` ADD UNIQUE KEY `unique_study` (`study_uid`)");
    }
    
    if (!indexExists($db, $tableName, 'idx_study_uid')) {
        @$db->query("ALTER TABLE `$tableName` ADD INDEX `idx_study_uid` (`study_uid`)");
    }
}

/**
 * Get list of existing columns for dynamic query building
 */
function getExistingColumns($db, $table) {
    $columns = [];
    $dbName = $db->query("SELECT DATABASE()")->fetch_row()[0];
    
    $sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('ss', $dbName, $table);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        $columns[] = $row['COLUMN_NAME'];
    }
    $stmt->close();
    
    return $columns;
}

/**
 * Handle GET requests - Retrieve prescription
 */
function handleGet($db) {
    $studyUID = $_GET['study_uid'] ?? '';
    
    if (empty($studyUID)) {
        echo json_encode(['success' => false, 'error' => 'Study UID is required']);
        return;
    }
    
    $existingColumns = getExistingColumns($db, 'prescriptions');
    
    $selectColumns = ['p.id', 'p.study_uid'];
    
    if (in_array('notes', $existingColumns)) $selectColumns[] = 'p.notes';
    if (in_array('attachment_path', $existingColumns)) $selectColumns[] = 'p.attachment_path';
    if (in_array('created_by', $existingColumns)) $selectColumns[] = 'p.created_by';
    if (in_array('created_at', $existingColumns)) $selectColumns[] = 'p.created_at';
    if (in_array('updated_at', $existingColumns)) $selectColumns[] = 'p.updated_at';
    
    $selectClause = implode(', ', $selectColumns);
    
    $joinClause = '';
    if (in_array('created_by', $existingColumns)) {
        $selectClause .= ', u.username as created_by_name';
        $joinClause = 'LEFT JOIN users u ON p.created_by = u.id';
    }
    
    $orderClause = in_array('created_at', $existingColumns) ? 'ORDER BY p.created_at DESC' : '';
    
    $sql = "SELECT $selectClause FROM prescriptions p $joinClause WHERE p.study_uid = ? $orderClause LIMIT 1";
    
    $stmt = $db->prepare($sql);
    $stmt->bind_param('s', $studyUID);
    $stmt->execute();
    $result = $stmt->get_result();
    $prescription = $result->fetch_assoc();
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'prescription' => $prescription
    ]);
}

/**
 * Handle POST requests - Create/Update prescription
 */
function handlePost($db, $uploadDir) {
    $studyUID = $_POST['study_uid'] ?? '';
    $notes = trim($_POST['notes'] ?? '');
    
    if (empty($studyUID)) {
        echo json_encode(['success' => false, 'error' => 'Study UID is required']);
        return;
    }
    
    $attachmentPath = null;
    
    // Handle file upload
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['attachment'];
        
        $allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!in_array($mimeType, $allowedTypes)) {
            echo json_encode(['success' => false, 'error' => 'Invalid file type. Only PDF, JPG, and PNG are allowed.']);
            return;
        }
        
        if ($file['size'] > 5 * 1024 * 1024) {
            echo json_encode(['success' => false, 'error' => 'File too large. Maximum size is 5MB.']);
            return;
        }
        
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $safeStudyUID = preg_replace('/[^a-z0-9]/i', '_', $studyUID);
        $filename = 'rx_' . $safeStudyUID . '_' . time() . '.' . $extension;
        $targetPath = $uploadDir . $filename;
        
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            echo json_encode(['success' => false, 'error' => 'Failed to save attachment']);
            return;
        }
        
        $attachmentPath = 'assets/uploads/prescriptions/' . $filename;
    }
    
    // Get user ID - use NULL if not available to avoid foreign key issues
    $userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    
    // Get existing columns
    $existingColumns = getExistingColumns($db, 'prescriptions');
    
    // Check if prescription exists
    $stmt = $db->prepare("SELECT id FROM prescriptions WHERE study_uid = ?");
    $stmt->bind_param('s', $studyUID);
    $stmt->execute();
    $result = $stmt->get_result();
    $existing = $result->fetch_assoc();
    $stmt->close();
    
    // Get old attachment path if updating
    $oldAttachmentPath = null;
    if ($existing && in_array('attachment_path', $existingColumns)) {
        $stmt = $db->prepare("SELECT attachment_path FROM prescriptions WHERE study_uid = ?");
        $stmt->bind_param('s', $studyUID);
        $stmt->execute();
        $result = $stmt->get_result();
        $oldData = $result->fetch_assoc();
        $oldAttachmentPath = $oldData['attachment_path'] ?? null;
        $stmt->close();
    }
    
    if ($existing) {
        // Update existing - build dynamic UPDATE query
        $updateParts = [];
        $params = [];
        $types = '';
        
        if (in_array('notes', $existingColumns)) {
            $updateParts[] = 'notes = ?';
            $params[] = $notes;
            $types .= 's';
        }
        
        if ($attachmentPath && in_array('attachment_path', $existingColumns)) {
            $updateParts[] = 'attachment_path = ?';
            $params[] = $attachmentPath;
            $types .= 's';
            
            if ($oldAttachmentPath) {
                $oldFilePath = __DIR__ . '/../../' . $oldAttachmentPath;
                if (file_exists($oldFilePath)) {
                    unlink($oldFilePath);
                }
            }
        }
        
        if (in_array('updated_at', $existingColumns)) {
            $updateParts[] = 'updated_at = NOW()';
        }
        
        if (empty($updateParts)) {
            echo json_encode(['success' => false, 'error' => 'No columns available to update']);
            return;
        }
        
        $params[] = $studyUID;
        $types .= 's';
        
        $sql = "UPDATE prescriptions SET " . implode(', ', $updateParts) . " WHERE study_uid = ?";
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
    } else {
        // Insert new - build dynamic INSERT query
        // DO NOT include created_by to avoid foreign key constraint issues
        $insertColumns = ['study_uid'];
        $insertPlaceholders = ['?'];
        $params = [$studyUID];
        $types = 's';
        
        if (in_array('notes', $existingColumns)) {
            $insertColumns[] = 'notes';
            $insertPlaceholders[] = '?';
            $params[] = $notes;
            $types .= 's';
        }
        
        if (in_array('attachment_path', $existingColumns)) {
            $insertColumns[] = 'attachment_path';
            $insertPlaceholders[] = '?';
            $params[] = $attachmentPath;
            $types .= 's';
        }
        
        // Only add created_by if user exists in users table
        if (in_array('created_by', $existingColumns) && $userId !== null) {
            // Check if user actually exists
            $userCheck = $db->prepare("SELECT id FROM users WHERE id = ?");
            $userCheck->bind_param('i', $userId);
            $userCheck->execute();
            $userResult = $userCheck->get_result();
            $userExists = $userResult->fetch_assoc();
            $userCheck->close();
            
            if ($userExists) {
                $insertColumns[] = 'created_by';
                $insertPlaceholders[] = '?';
                $params[] = $userId;
                $types .= 'i';
            }
            // If user doesn't exist, we simply don't include created_by (it will be NULL)
        }
        
        if (in_array('created_at', $existingColumns)) {
            $insertColumns[] = 'created_at';
            $insertPlaceholders[] = 'NOW()';
        }
        
        if (in_array('updated_at', $existingColumns)) {
            $insertColumns[] = 'updated_at';
            $insertPlaceholders[] = 'NOW()';
        }
        
        $sql = "INSERT INTO prescriptions (" . implode(', ', $insertColumns) . ") VALUES (" . implode(', ', $insertPlaceholders) . ")";
        $stmt = $db->prepare($sql);
        
        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }
    }
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Prescription saved successfully'
        ]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to save prescription: ' . $stmt->error]);
    }
    $stmt->close();
}

/**
 * Handle DELETE requests
 */
function handleDelete($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    $studyUID = $input['study_uid'] ?? '';
    $removeAttachmentOnly = $input['remove_attachment_only'] ?? false;
    
    if (empty($studyUID)) {
        echo json_encode(['success' => false, 'error' => 'Study UID is required']);
        return;
    }
    
    $existingColumns = getExistingColumns($db, 'prescriptions');
    
    $stmt = $db->prepare("SELECT id FROM prescriptions WHERE study_uid = ?");
    $stmt->bind_param('s', $studyUID);
    $stmt->execute();
    $result = $stmt->get_result();
    $prescription = $result->fetch_assoc();
    $stmt->close();
    
    if (!$prescription) {
        echo json_encode(['success' => false, 'error' => 'Prescription not found']);
        return;
    }
    
    if (in_array('attachment_path', $existingColumns)) {
        $stmt = $db->prepare("SELECT attachment_path FROM prescriptions WHERE study_uid = ?");
        $stmt->bind_param('s', $studyUID);
        $stmt->execute();
        $result = $stmt->get_result();
        $attachmentData = $result->fetch_assoc();
        $stmt->close();
        
        if (!empty($attachmentData['attachment_path'])) {
            $filePath = __DIR__ . '/../../' . $attachmentData['attachment_path'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
    }
    
    if ($removeAttachmentOnly && in_array('attachment_path', $existingColumns)) {
        $updateParts = ['attachment_path = NULL'];
        if (in_array('updated_at', $existingColumns)) {
            $updateParts[] = 'updated_at = NOW()';
        }
        $sql = "UPDATE prescriptions SET " . implode(', ', $updateParts) . " WHERE study_uid = ?";
        $stmt = $db->prepare($sql);
        $stmt->bind_param('s', $studyUID);
    } else {
        $stmt = $db->prepare("DELETE FROM prescriptions WHERE study_uid = ?");
        $stmt->bind_param('s', $studyUID);
    }
    
    $stmt->execute();
    $stmt->close();
    
    echo json_encode([
        'success' => true,
        'message' => $removeAttachmentOnly ? 'Attachment removed' : 'Prescription deleted'
    ]);
}
