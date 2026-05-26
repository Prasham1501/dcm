<?php
/** POST /api/cloud/list.php — list bundles in the user's remote folder. */
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') cloud_error('POST only', 405);

$body         = cloud_read_body();
$provider     = (string)($body['provider']      ?? '');
$token        = trim((string)($body['access_token'] ?? ''));
$remoteFolder = (string)($body['remote_folder'] ?? '/dcm-backups');

if (!in_array($provider, ['dropbox', 'google'], true)) cloud_error('Unsupported provider', 400);
if ($token === '') cloud_error('Access token is required', 400);

$data = $provider === 'dropbox'
    ? cloud_dropbox_list($token, $remoteFolder)
    : cloud_gdrive_list($token, $remoteFolder);
cloud_json(['ok' => true] + $data);
