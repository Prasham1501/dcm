<?php
if (($_GET['secret'] ?? '') !== 'mediview2026') { http_response_code(403); die('Forbidden'); }
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
$licId  = 'ab5819d6159d7e8b';
if ($action === 'expire') {
    $past = gmdate('Y-m-d H:i:s', time() - 86400);
    db()->prepare("UPDATE licenses SET expires_at=? WHERE id=?")->execute([$past, $licId]);
    echo json_encode(['done' => 'expired', 'expires_at' => $past]);
} elseif ($action === 'restore') {
    $future = gmdate('Y-m-d H:i:s', time() + 30 * 86400);
    db()->prepare("UPDATE licenses SET expires_at=?, status='active' WHERE id=?")->execute([$future, $licId]);
    echo json_encode(['done' => 'restored', 'expires_at' => $future]);
} else {
    echo json_encode(['error' => 'use ?action=expire or ?action=restore']);
}
