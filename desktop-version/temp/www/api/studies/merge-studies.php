<?php
/**
 * Permanent Study Merge API
 * 
 * Merges multiple studies into a single study permanently.
 * All images from merged studies are combined, and original studies are deleted.
 */

// Suppress HTML errors, output only JSON
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json');

define('DICOM_VIEWER', true);

// Include config (contains getDbConnection for mysqli)
require_once __DIR__ . '/../../includes/config.php';

session_start();

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Only POST method allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['study_uids']) || !is_array($input['study_uids'])) {
    echo json_encode(['success' => false, 'error' => 'Missing study_uids array']);
    exit;
}

$studyUIDs = $input['study_uids'];

if (count($studyUIDs) < 2) {
    echo json_encode(['success' => false, 'error' => 'At least 2 studies required for merge']);
    exit;
}

try {
    $mysqli = getDbConnection();
    
    // Start transaction
    $mysqli->autocommit(false);
    
    // Build placeholders for IN clause
    $placeholders = implode(',', array_fill(0, count($studyUIDs), '?'));
    $types = str_repeat('s', count($studyUIDs));
    
    // Fetch all studies to be merged (ORDER BY study_date DESC to get latest first)
    $stmt = $mysqli->prepare("SELECT * FROM cached_studies WHERE study_instance_uid IN ($placeholders) ORDER BY study_date DESC, study_time DESC");
    $stmt->bind_param($types, ...$studyUIDs);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $studies = [];
    while ($row = $result->fetch_assoc()) {
        $studies[] = $row;
    }
    $stmt->close();
    
    if (count($studies) < 2) {
        throw new Exception('Could not find enough studies to merge. Found: ' . count($studies));
    }
    
    // Use the LATEST study as the base (first in array due to ORDER BY DESC)
    $primaryStudy = $studies[0];
    $primaryUID = $primaryStudy['study_instance_uid'];
    $primaryOrthancId = $primaryStudy['orthanc_id'];
    
    // Collect all orthanc_ids for the studies being merged (except primary)
    $mergedOrthancIds = [];
    $totalImageCount = intval($primaryStudy['instance_count'] ?? 0);
    
    for ($i = 1; $i < count($studies); $i++) {
        $mergedOrthancIds[] = $studies[$i]['orthanc_id'];
        $totalImageCount += intval($studies[$i]['instance_count'] ?? 0);
    }
    
    // Update the primary study description to indicate merge
    $originalDesc = $primaryStudy['study_description'] ?: 'Study';
    $mergedDesc = $originalDesc . ' (Merged: ' . count($studies) . ' studies)';
    $mergedStudyIds = json_encode(array_column(array_slice($studies, 1), 'study_instance_uid'));
    $mergedOrthancIdsStr = implode(',', $mergedOrthancIds);
    
    // Update primary study with new instance count, description, and merged IDs
    $updateStmt = $mysqli->prepare("
        UPDATE cached_studies 
        SET study_description = ?,
            instance_count = ?,
            merged_study_ids = ?,
            merged_orthanc_ids = ?
        WHERE study_instance_uid = ?
    ");
    $updateStmt->bind_param('sisss', $mergedDesc, $totalImageCount, $mergedStudyIds, $mergedOrthancIdsStr, $primaryUID);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Delete the merged studies from cached_studies (keep only primary)
    // Need to build a query that excludes the primary
    $deleteUIDs = [];
    for ($i = 1; $i < count($studies); $i++) {
        $deleteUIDs[] = $studies[$i]['study_instance_uid'];
    }
    
    if (!empty($deleteUIDs)) {
        $deletePlaceholders = implode(',', array_fill(0, count($deleteUIDs), '?'));
        $deleteTypes = str_repeat('s', count($deleteUIDs));
        $deleteStmt = $mysqli->prepare("DELETE FROM cached_studies WHERE study_instance_uid IN ($deletePlaceholders)");
        $deleteStmt->bind_param($deleteTypes, ...$deleteUIDs);
        $deleteStmt->execute();
        $deleteStmt->close();
    }
    
    // Update the patient's study count
    $patientId = $primaryStudy['patient_id'];
    $countStmt = $mysqli->prepare("SELECT COUNT(*) as cnt FROM cached_studies WHERE patient_id = ?");
    $countStmt->bind_param('s', $patientId);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $newCount = $countResult->fetch_assoc()['cnt'];
    $countStmt->close();
    
    $updatePatientStmt = $mysqli->prepare("UPDATE cached_patients SET study_count = ? WHERE patient_id = ?");
    $updatePatientStmt->bind_param('is', $newCount, $patientId);
    $updatePatientStmt->execute();
    $updatePatientStmt->close();
    
    // Commit transaction
    $mysqli->commit();
    $mysqli->autocommit(true);
    
    echo json_encode([
        'success' => true,
        'message' => 'Studies merged successfully',
        'merged_study' => [
            'study_instance_uid' => $primaryUID,
            'orthanc_id' => $primaryOrthancId,
            'study_description' => $mergedDesc,
            'total_images' => $totalImageCount,
            'studies_merged' => count($studies)
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($mysqli)) {
        $mysqli->rollback();
        $mysqli->autocommit(true);
    }
    echo json_encode([
        'success' => false,
        'error' => 'Merge failed: ' . $e->getMessage()
    ]);
}
