<?php
// Temp test router: serve built viewer SPA (www/dist) + execute /api from dcm root.
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('/\.php$/i', $uri)) { return false; }
$docroot = $_SERVER['DOCUMENT_ROOT'];
$dist = $docroot . '/www/dist';
$real = realpath($dist . $uri);
$distReal = realpath($dist);
if ($uri !== '/' && $real && $distReal && strpos($real, $distReal) === 0 && is_file($real)) {
    $ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));
    $mimes = ['js'=>'application/javascript','mjs'=>'application/javascript','css'=>'text/css','html'=>'text/html','json'=>'application/json','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','ico'=>'image/x-icon','woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf','map'=>'application/json','webp'=>'image/webp'];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    readfile($real);
    return true;
}
header('Content-Type: text/html; charset=utf-8');
readfile($dist . '/index.html');
return true;
