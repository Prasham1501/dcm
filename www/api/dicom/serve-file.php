<?php
/**
 * Serve DICOM files from local filesystem.
 * Used for loading DICOM files into Cornerstone.js via wadouri protocol.
 *
 * GET ?path=<absolute-path-to-dcm-file>
 * GET ?orthanc_id=<orthanc-instance-id>  (proxies to Orthanc)
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

function resolve_allowed_file(string $path): ?string {
    $real = realpath($path);
    if ($real === false || !is_file($real)) return null;
    $normalized = str_replace('\\', '/', $real);
    foreach (dicom_allowed_roots() as $root) {
        if (path_is_under_root($normalized, $root)) return $real;
    }
    return null;
}

function is_plausible_dicom_path(string $path): bool {
    $base = strtolower(basename($path));
    if ($base === 'dicomdir' || str_ends_with($base, '.dcm') || str_ends_with($base, '.dicom') || strpos($base, '.') === false) return true;
    return !preg_match('/\.(php|exe|bat|cmd|sh|ps1|vbs|js|html?|json|xml|ini|env|sql|pem|key|txt|csv|xlsx?|docx?|pdf|zip|dll)$/i', $base);
}

if (!same_origin_or_localhost()) {
    http_response_code(403);
    echo 'Forbidden origin';
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Option 1: Serve from local file path
if (isset($_GET['path'])) {
    $filePath = $_GET['path'];

    if (!is_plausible_dicom_path($filePath)) {
        http_response_code(400);
        echo 'Invalid file type';
        exit;
    }

    $safePath = resolve_allowed_file($filePath);
    if ($safePath === null) {
        if (!file_exists($filePath)) {
            http_response_code(404);
            echo 'File not found: ' . basename($filePath);
            exit;
        }
        http_response_code(403);
        echo 'File is outside allowed DICOM roots';
        exit;
    }

    if (!file_exists($safePath)) {
        http_response_code(404);
        echo 'File not found: ' . basename($safePath);
        exit;
    }

    $fileSize = filesize($safePath);
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
            $end = min($end, $fileSize - 1);
            if ($start < 0 || $start > $end) {
                http_response_code(416);
                header("Content-Range: bytes */$fileSize");
                exit;
            }
            $length = $end - $start + 1;

            http_response_code(206);
            header("Content-Range: bytes $start-$end/$fileSize");
            header("Content-Length: $length");

            $fp = fopen($safePath, 'rb');
            fseek($fp, $start);
            $remaining = $length;
            while ($remaining > 0 && !feof($fp)) {
                $chunk = min(1024 * 1024, $remaining);
                echo fread($fp, $chunk);
                $remaining -= $chunk;
                flush();
            }
            fclose($fp);
            exit;
        }
    }

    readfile($safePath);
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

    $orthancBase = defined('ORTHANC_URL') ? ORTHANC_URL : 'http://127.0.0.1:8042';
    $orthancUrl = rtrim($orthancBase, '/') . '/instances/' . $instanceId . '/file';
    $authHeader = 'Authorization: Basic ' . base64_encode(ORTHANC_USERNAME . ':' . ORTHANC_PASSWORD);

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
