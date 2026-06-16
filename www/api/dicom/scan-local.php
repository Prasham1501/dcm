<?php
/**
 * Scan a local directory for DICOM files.
 * Returns file paths and basic DICOM metadata for loading into the viewer.
 *
 * GET ?dir=<absolute-directory-path>&limit=100
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

function same_origin_or_localhost(): bool {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true;
    $host = parse_url($origin, PHP_URL_HOST);
    return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
}

function dicom_allowed_roots(): array {
    $roots = [APP_ROOT, dirname(APP_ROOT), ORTHANC_STORAGE_PATH, getenv('DICOM_STORAGE_PATH') ?: ''];
    $extra = getenv('DICOM_ALLOWED_ROOTS') ?: '';
    foreach (preg_split('/[;|]/', $extra) as $root) {
        $root = trim($root);
        if ($root !== '') $roots[] = $root;
    }
    $out = [];
    foreach ($roots as $root) {
        if (!$root) continue;
        $real = realpath($root);
        if ($real !== false) $out[] = rtrim(str_replace('\\', '/', $real), '/');
    }
    return array_values(array_unique($out));
}

function path_is_under_root(string $path, string $root): bool {
    $path = rtrim(str_replace('\\', '/', $path), '/');
    return $path === $root || str_starts_with($path . '/', $root . '/');
}

function resolve_allowed_dir(string $path): ?string {
    $real = realpath($path);
    if ($real === false || !is_dir($real)) return null;
    $normalized = str_replace('\\', '/', $real);
    foreach (dicom_allowed_roots() as $root) {
        if (path_is_under_root($normalized, $root)) return $real;
    }
    return null;
}

header('Content-Type: application/json');
if (!same_origin_or_localhost()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden origin']);
    exit;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');

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

$safeDir = resolve_allowed_dir($dir);
if ($safeDir === null) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Directory is outside allowed DICOM roots']);
    exit;
}

$files = [];
$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($safeDir, RecursiveDirectoryIterator::SKIP_DOTS),
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
    'directory' => str_replace('\\', '/', $safeDir),
    'count' => count($files),
    'files' => $files,
]);
