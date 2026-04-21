<?php
/**
 * Export Study Images as JPG
 *
 * This endpoint fetches all instances of a study from Orthanc,
 * converts them to JPG format, and creates a downloadable ZIP file.
 */

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Require authentication
requireLogin();

header('Content-Type: application/json');

try {
    // Get study UID from request
    $studyUID = $_GET['study_uid'] ?? null;

    if (!$studyUID) {
        throw new Exception('Study UID is required');
    }

    // Get Orthanc configuration
    $orthancUrl = $_ENV['ORTHANC_URL'] ?? 'http://localhost:8042';
    $orthancUser = $_ENV['ORTHANC_USERNAME'] ?? 'orthanc';
    $orthancPass = $_ENV['ORTHANC_PASSWORD'] ?? 'orthanc';

    // Create auth header
    $authHeader = 'Authorization: Basic ' . base64_encode("$orthancUser:$orthancPass");

    // Step 1: Find the study by StudyInstanceUID
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$orthancUrl/tools/find");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        $authHeader
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'Level' => 'Study',
        'Query' => [
            'StudyInstanceUID' => $studyUID
        ]
    ]));

    $studyIds = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (empty($studyIds)) {
        throw new Exception('Study not found in Orthanc');
    }

    $orthancStudyId = $studyIds[0];

    // Step 2: Get all instances in the study
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "$orthancUrl/studies/$orthancStudyId/instances");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [$authHeader]);

    $instances = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (empty($instances)) {
        throw new Exception('No instances found for this study');
    }

    // Step 3: Create temporary directory for images
    $tempDir = sys_get_temp_dir() . '/dicom_export_' . uniqid();
    if (!mkdir($tempDir, 0777, true)) {
        throw new Exception('Failed to create temporary directory');
    }

    // Step 4: Download and convert each instance to JPG
    $imageCount = 0;
    $patientName = 'Unknown';
    $studyDate = date('Y-m-d');

    foreach ($instances as $instance) {
        $instanceId = $instance['ID'];

        // Get instance metadata on first iteration
        if ($imageCount === 0) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "$orthancUrl/instances/$instanceId/simplified-tags");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [$authHeader]);
            $tags = json_decode(curl_exec($ch), true);
            curl_close($ch);

            $patientName = $tags['PatientName'] ?? 'Unknown';
            $studyDate = $tags['StudyDate'] ?? date('Ymd');

            // Format study date
            if (strlen($studyDate) === 8) {
                $studyDate = substr($studyDate, 0, 4) . '-' . substr($studyDate, 4, 2) . '-' . substr($studyDate, 6, 2);
            }
        }

        // Get preview image from Orthanc (already in JPG format)
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "$orthancUrl/instances/$instanceId/preview");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [$authHeader]);

        $imageData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $imageData) {
            $imageCount++;
            $filename = sprintf('%s_Image_%04d.jpg',
                preg_replace('/[^a-zA-Z0-9_-]/', '_', $patientName),
                $imageCount
            );

            file_put_contents("$tempDir/$filename", $imageData);
        }
    }

    if ($imageCount === 0) {
        // Clean up
        rmdir($tempDir);
        throw new Exception('No images could be exported');
    }

    // Step 5: Create ZIP file
    $zipFilename = sprintf('Study_%s_%s_%d_images.zip',
        preg_replace('/[^a-zA-Z0-9_-]/', '_', $patientName),
        str_replace('-', '', $studyDate),
        $imageCount
    );

    $zipPath = sys_get_temp_dir() . '/' . $zipFilename;

    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new Exception('Failed to create ZIP file');
    }

    // Add all images to ZIP
    $files = scandir($tempDir);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            $zip->addFile("$tempDir/$file", $file);
        }
    }

    $zip->close();

    // Step 6: Clean up temporary images
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            unlink("$tempDir/$file");
        }
    }
    rmdir($tempDir);

    // Step 7: Send ZIP file to browser
    if (file_exists($zipPath)) {
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
        header('Content-Length: ' . filesize($zipPath));
        header('Cache-Control: no-cache');

        readfile($zipPath);

        // Clean up ZIP file
        unlink($zipPath);
        exit;
    } else {
        throw new Exception('ZIP file was not created successfully');
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}