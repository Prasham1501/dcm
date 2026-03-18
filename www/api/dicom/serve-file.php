<?php
/**
 * Serve DICOM files from local filesystem.
 * Used for loading DICOM files into Cornerstone.js via wadouri protocol.
 *
 * GET ?path=<absolute-path-to-dcm-file>
 * GET ?orthanc_id=<orthanc-instance-id>  (proxies to Orthanc)
 */

// Allow CORS for Cornerstone WADO loader
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Option 1: Serve from local file path
if (isset($_GET['path'])) {
    $filePath = $_GET['path'];

    // Basic security: block known dangerous extensions
    $blocked = ['.php', '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.html', '.htm'];
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if (in_array('.' . $ext, $blocked)) {
        http_response_code(400);
        echo 'Invalid file type';
        exit;
    }

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo 'File not found: ' . basename($filePath);
        exit;
    }

    $fileSize = filesize($filePath);
    header('Content-Type: application/dicom');
    header('Content-Length: ' . $fileSize);
    header('Accept-Ranges: bytes');
    header('Cache-Control: public, max-age=86400');

    // Support Range requests for large files
    if (isset($_SERVER['HTTP_RANGE'])) {
        $range = $_SERVER['HTTP_RANGE'];
        if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
            $start = intval($matches[1]);
            $end = $matches[2] !== '' ? intval($matches[2]) : $fileSize - 1;
            $length = $end - $start + 1;

            http_response_code(206);
            header("Content-Range: bytes $start-$end/$fileSize");
            header("Content-Length: $length");

            $fp = fopen($filePath, 'rb');
            fseek($fp, $start);
            echo fread($fp, $length);
            fclose($fp);
            exit;
        }
    }

    readfile($filePath);
    exit;
}

// Option 2: Proxy from Orthanc
if (isset($_GET['orthanc_id'])) {
    $instanceId = $_GET['orthanc_id'];

    // Sanitize
    if (!preg_match('/^[a-f0-9-]+$/i', $instanceId)) {
        http_response_code(400);
        echo 'Invalid Orthanc ID';
        exit;
    }

    $orthancUrl = 'http://localhost:8042/instances/' . $instanceId . '/file';
    $authHeader = 'Authorization: Basic ' . base64_encode('orthanc:orthanc');

    $ch = curl_init($orthancUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [$authHeader]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $data = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || $data === false) {
        http_response_code(502);
        echo 'Failed to fetch from Orthanc';
        exit;
    }

    header('Content-Type: application/dicom');
    header('Content-Length: ' . strlen($data));
    header('Cache-Control: public, max-age=86400');
    echo $data;
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Missing path or orthanc_id parameter']);
