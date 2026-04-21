<?php
/**
 * Scan a local directory for DICOM files.
 * Returns file paths and basic DICOM metadata for loading into the viewer.
 *
 * GET ?dir=<absolute-directory-path>&limit=100
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dir = $_GET['dir'] ?? '';
$limit = min(500, max(1, intval($_GET['limit'] ?? 100)));

if (empty($dir) || !is_dir($dir)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid directory: ' . $dir]);
    exit;
}

$files = [];
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
    RecursiveIteratorIterator::LEAVES_ONLY
);

$count = 0;
foreach ($iterator as $file) {
    if ($count >= $limit) break;
    $ext = strtolower($file->getExtension());
    if ($ext === 'dcm' || $ext === 'dicom' || $ext === '') {
        // For files without extension, check if they might be DICOM
        $path = str_replace('\\', '/', $file->getPathname());
        if ($ext === '') {
            // Quick check: DICOM files start with specific bytes
            $fp = fopen($path, 'rb');
            if ($fp) {
                fseek($fp, 128);
                $magic = fread($fp, 4);
                fclose($fp);
                if ($magic !== 'DICM') continue;
            } else {
                continue;
            }
        }
        $files[] = [
            'path' => $path,
            'filename' => $file->getFilename(),
            'size' => $file->getSize(),
        ];
        $count++;
    }
}

// Sort by filename
usort($files, function($a, $b) {
    return strnatcmp($a['filename'], $b['filename']);
});

echo json_encode([
    'success' => true,
    'directory' => str_replace('\\', '/', $dir),
    'count' => count($files),
    'files' => $files,
]);
