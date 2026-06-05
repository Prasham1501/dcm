<?php
/**
 * RIS PHP router for `php -S host:port router.php`.
 *
 *   1. If the requested path exists under ris/server/  → serve it directly
 *      (returning false lets the built-in server handle it natively).
 *   2. Otherwise, fall back to the viewer's www/ root.
 *
 * Layout (dev):   <repo>/ris/server  +  <repo>/www
 * Layout (prod):  <resources>/ris-server  +  <resources>/www
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$rel = ltrim($uri, '/');

// 1) Local RIS file?
$risFile = __DIR__ . '/' . $rel;
if ($rel !== '' && is_file($risFile)) {
    return false;
}

// 2) Fall back to viewer www/
$candidates = [
    __DIR__ . '/../../www/' . $rel,   // dev:  ris/server -> www
    __DIR__ . '/../www/' . $rel,      // prod: ris-server -> www  (resources sibling)
];
foreach ($candidates as $c) {
    $real = realpath($c);
    if ($real && is_file($real)) {
        $_SERVER['SCRIPT_FILENAME'] = $real;
        $_SERVER['SCRIPT_NAME']     = '/' . $rel;
        chdir(dirname($real));
        require $real;
        return true;
    }
}

// 3) Nothing matched — let the server emit 404.
return false;
