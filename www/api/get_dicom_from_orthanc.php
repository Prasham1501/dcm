<?php
/**
 * DICOM File Proxy - Fetches DICOM files from Orthanc
 * Uses PHP native functions to extract from ZIP (no ZipArchive dependency)
 */

// Start output buffering
ob_start();
ini_set('display_errors', 0);
error_reporting(0);

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';

ob_clean();

header('Content-Type: application/dicom');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$instanceId = $_GET['instanceId'] ?? '';

if (empty($instanceId)) {
    http_response_code(400);
    echo 'Instance ID required';
    exit;
}

try {
    // Download ZIP from Orthanc
    $orthancUrl = ORTHANC_URL . "/tools/create-archive";

    $ch = curl_init($orthancUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['Resources' => [$instanceId]]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);

    $zipData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$zipData) {
        throw new Exception("Failed to fetch from Orthanc: HTTP $httpCode");
    }

    // Extract DICOM using pure PHP (no ZIP extension required)
    $dicomData = extractDicomFromZip($zipData);

    if (!$dicomData) {
        throw new Exception('No DICOM file found in archive');
    }

    // Send DICOM data
    ob_clean();
    header('Content-Length: ' . strlen($dicomData));
    header('Content-Disposition: inline; filename="' . $instanceId . '.dcm"');
    header('Cache-Control: public, max-age=31536000');

    echo $dicomData;
    exit;

} catch (Exception $e) {
    ob_clean();
    http_response_code(500);
    error_log("DICOM fetch error for $instanceId: " . $e->getMessage());
    echo 'Error: ' . $e->getMessage();
    exit;
}

/**
 * Extract DICOM file from ZIP archive using pure PHP
 * No ZIP extension required - reads ZIP structure manually
 */
function extractDicomFromZip($zipData) {
    // ZIP file signature
    $pos = 0;
    $length = strlen($zipData);

    while ($pos < $length) {
        // Look for local file header signature (0x04034b50)
        $header = substr($zipData, $pos, 4);
        if ($header !== "\x50\x4b\x03\x04") {
            // End of entries or invalid ZIP
            break;
        }

        // Read local file header (30 bytes minimum)
        $headerData = unpack(
            'vversion/vflags/vmethod/vmodtime/vmoddate/Vcrc/Vcompsize/Vuncompsize/vfilenamelen/vextralen',
            substr($zipData, $pos + 4, 26)
        );

        $pos += 30;

        // Read filename
        $filename = substr($zipData, $pos, $headerData['filenamelen']);
        $pos += $headerData['filenamelen'];

        // Skip extra field
        $pos += $headerData['extralen'];

        // Check if this is a DICOM file
        if (stripos($filename, '.dcm') !== false) {
            // Read compressed data
            $compressedData = substr($zipData, $pos, $headerData['compsize']);

            // Decompress if needed
            if ($headerData['method'] === 0) {
                // Stored (no compression)
                return $compressedData;
            } else if ($headerData['method'] === 8) {
                // Deflate compression
                $dicomData = @gzinflate($compressedData);
                if ($dicomData !== false) {
                    return $dicomData;
                }
            }
        }

        // Move to next entry
        $pos += $headerData['compsize'];
    }

    return null;
}
