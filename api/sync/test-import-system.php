<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Test Script for Hospital Data Import System
 *
 * This script tests the import system functionality
 * Run this from command line: php test-import-system.php
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../includes/classes/HospitalDataImporter.php';

echo "Hospital Data Import System - Test Script\n";
echo "==========================================\n\n";

// Test 1: Class Instantiation
echo "Test 1: Class Instantiation\n";
try {
    $importer = new HospitalDataImporter();
    echo "✓ HospitalDataImporter class instantiated successfully\n\n";
} catch (Exception $e) {
    echo "✗ Failed to instantiate class: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 2: Database Connection
echo "Test 2: Database Connection\n";
try {
    $db = getDbConnection();
    echo "✓ Database connection successful\n\n";
} catch (Exception $e) {
    echo "✗ Database connection failed: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 3: Check Tables Exist
echo "Test 3: Database Tables\n";
$tables = ['import_jobs', 'import_history', 'sync_configuration'];
foreach ($tables as $table) {
    $result = $db->query("SHOW TABLES LIKE '{$table}'");
    if ($result && $result->num_rows > 0) {
        echo "✓ Table '{$table}' exists\n";
    } else {
        echo "✗ Table '{$table}' not found\n";
    }
}
echo "\n";

// Test 4: Test DICOM File Detection (if test file exists)
echo "Test 4: DICOM File Detection\n";
// Create a temporary test file with DICM header
$testFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'test_dicom.dcm';
$testContent = str_repeat("\x00", 128) . "DICM" . str_repeat("\x00", 100);
file_put_contents($testFile, $testContent);

if ($importer->isDicomFile($testFile)) {
    echo "✓ DICOM file detection working correctly\n";
} else {
    echo "✗ DICOM file detection failed\n";
}

// Clean up test file
unlink($testFile);
echo "\n";

// Test 5: File Hash Calculation
echo "Test 5: File Hash Calculation\n";
$testFile2 = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'test_hash.txt';
file_put_contents($testFile2, 'test content');
$hash = $importer->calculateFileHash($testFile2);
if ($hash && strlen($hash) === 32) {
    echo "✓ File hash calculation working (MD5: {$hash})\n";
} else {
    echo "✗ File hash calculation failed\n";
}
unlink($testFile2);
echo "\n";

// Test 6: Create Test Import Job
echo "Test 6: Create Import Job\n";
try {
    $jobId = $importer->createImportJob('C:\\Test\\Path', 'manual', 10, 1024);
    if ($jobId) {
        echo "✓ Import job created successfully (Job ID: {$jobId})\n";

        // Test 7: Get Job Details
        echo "\nTest 7: Get Job Details\n";
        $job = $importer->getJobDetails($jobId);
        if ($job) {
            echo "✓ Job details retrieved successfully\n";
            echo "  - Job Type: {$job['job_type']}\n";
            echo "  - Status: {$job['status']}\n";
            echo "  - Total Files: {$job['total_files']}\n";
        } else {
            echo "✗ Failed to retrieve job details\n";
        }

        // Test 8: Update Job Progress
        echo "\nTest 8: Update Job Progress\n";
        $updated = $importer->updateJobProgress($jobId, 5, 4, 1);
        if ($updated) {
            echo "✓ Job progress updated successfully\n";
            $job = $importer->getJobDetails($jobId);
            echo "  - Processed: {$job['files_processed']}\n";
            echo "  - Imported: {$job['files_imported']}\n";
            echo "  - Failed: {$job['files_failed']}\n";
        } else {
            echo "✗ Failed to update job progress\n";
        }

        // Clean up test job
        echo "\nCleaning up test job...\n";
        $db->query("DELETE FROM import_jobs WHERE id = {$jobId}");
        echo "✓ Test job deleted\n";

    } else {
        echo "✗ Failed to create import job\n";
    }
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
}

echo "\n==========================================\n";
echo "Test Suite Completed\n";
echo "==========================================\n";
