<?php
/** POST /api/cloud/download.php — streams a remote bundle back as a zip. */
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') cloud_error('POST only', 405);

$body     = cloud_read_body();
$provider = (string)($body['provider'] ?? '');
$token    = trim((string)($body['access_token'] ?? ''));
$path     = (string)($body['path'] ?? '');

if (!in_array($provider, ['dropbox', 'google'], true)) cloud_error('Unsupported provider', 400);
if ($token === '' || $path === '') cloud_error('Missing access_token or path', 400);

if ($provider === 'dropbox') cloud_dropbox_download($token, $path);
else                         cloud_gdrive_download($token, $path);
