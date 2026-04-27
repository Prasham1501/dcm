<?php
declare(strict_types=1);

// Load .env if it exists (uses vlucas/phpdotenv when composer is installed)
$envFile = dirname(__DIR__) . '/.env';
if (file_exists($envFile)) {
    if (class_exists('Dotenv\Dotenv')) {
        $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
        $dotenv->load();
    } else {
        // Fallback: manual parse (works before composer install)
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k); $v = trim($v);
            if (!isset($_ENV[$k])) { $_ENV[$k] = $v; putenv("$k=$v"); }
        }
    }
}

// Error reporting
if ((getenv('APP_ENV') ?: 'production') === 'local') {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
}

// Always UTC
date_default_timezone_set('UTC');
