<?php
declare(strict_types=1);

class UploadController {

    private const MAX_SIZE  = 5 * 1024 * 1024; // 5 MB
    private const ALLOWED   = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

    public function store(Request $req): void {
        $file = $req->file('file');
        if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
            Response::error('No file uploaded or upload error', 400);
        }

        if ($file['size'] > self::MAX_SIZE) {
            Response::error('File too large (max 5 MB)', 400);
        }

        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED, true)) {
            Response::error('File type not allowed', 400);
        }

        $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = generateId() . '.' . strtolower($ext);
        $dir      = __DIR__ . '/../uploads/' . date('Y/m');

        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            Response::error('Upload directory error', 500);
        }

        $dest = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('Failed to save file', 500);
        }

        $url = rtrim(getenv('APP_URL'), '/') . '/api/uploads/' . date('Y/m') . '/' . $filename;
        Response::json(['url' => $url, 'filename' => $filename], 201);
    }
}
