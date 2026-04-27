<?php
declare(strict_types=1);

class Response {

    public static function json(mixed $data, int $status = 200): never {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status = 400, array $extra = []): never {
        self::json(array_merge(['error' => $message], $extra), $status);
    }

    public static function ok(array $extra = []): never {
        self::json(array_merge(['ok' => true], $extra));
    }

    public static function pdf(string $filePath, string $filename): never {
        if (!file_exists($filePath)) self::error('File not found', 404);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: private, no-cache');
        readfile($filePath);
        exit;
    }

    public static function download(string $filePath, string $filename): never {
        if (!file_exists($filePath)) self::error('File not found', 404);
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes($filename) . '"');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }

    public static function redirect(string $url, int $status = 302): never {
        http_response_code($status);
        header("Location: $url");
        exit;
    }
}
