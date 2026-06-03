<?php
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = getenv('DB_HOST') ?: 'localhost';
    $name = getenv('DB_NAME') ?: 'mediview';
    $user = getenv('DB_USER') ?: 'aaiacc_admin';
    $pass = getenv('DB_PASS') ?: 'Prasham123$';

    $pdo = new PDO(
        "mysql:host=$host;dbname=$name;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => true,
        ]
    );
    return $pdo;
}

/** 16-character random hex ID */
function generateId(): string {
    return bin2hex(random_bytes(8));
}

/** Current UTC datetime for MySQL DATETIME columns */
function nowDb(): string {
    return gmdate('Y-m-d H:i:s');
}
