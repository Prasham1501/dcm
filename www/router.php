<?php
/**
 * PHP Router for SPA + API coexistence
 *
 * Routes:
 * - /api/* -> PHP API endpoints
 * - /auth/* -> PHP auth handlers
 * - Static files (.css, .js, .png, etc.) -> served directly
 * - Everything else -> React SPA (index.html)
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files directly
$staticExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'map', 'json'];
$ext = pathinfo($uri, PATHINFO_EXTENSION);
if (in_array(strtolower($ext), $staticExtensions)) {
    $filePath = __DIR__ . $uri;
    if (file_exists($filePath)) {
        return false; // Let PHP built-in server handle it
    }
}

// API routes -> serve PHP files
if (preg_match('#^/api/#', $uri)) {
    $phpFile = __DIR__ . $uri;
    if (file_exists($phpFile)) {
        require $phpFile;
        return true;
    }
    http_response_code(404);
    echo json_encode(['error' => 'API endpoint not found']);
    return true;
}

// Auth routes
if (preg_match('#^/auth/#', $uri)) {
    $phpFile = __DIR__ . $uri;
    if (file_exists($phpFile)) {
        require $phpFile;
        return true;
    }
}

// PHP pages (legacy support)
if (preg_match('#\.php$#', $uri)) {
    $phpFile = __DIR__ . $uri;
    if (file_exists($phpFile)) {
        require $phpFile;
        return true;
    }
}

// Serve assets from dist directory
$distFile = __DIR__ . '/dist' . $uri;
if (file_exists($distFile) && !is_dir($distFile)) {
    $mimeTypes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
    ];
    $fileExt = pathinfo($distFile, PATHINFO_EXTENSION);
    if (isset($mimeTypes[$fileExt])) {
        header('Content-Type: ' . $mimeTypes[$fileExt]);
    }
    readfile($distFile);
    return true;
}

// Everything else -> React SPA
$indexFile = __DIR__ . '/dist/index.html';
if (file_exists($indexFile)) {
    readfile($indexFile);
    return true;
}

// Fallback: if dist doesn't exist yet (during dev), show a message
http_response_code(200);
echo '<!DOCTYPE html><html><head><title>DICOM Viewer Pro</title></head><body>';
echo '<h1>DICOM Viewer Pro</h1><p>React app not built yet. Run <code>cd www && npm run build</code></p>';
echo '</body></html>';
return true;
