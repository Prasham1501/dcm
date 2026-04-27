<?php
declare(strict_types=1);

class DownloadController {

    /** Serve EXE or redirect to external download URL */
    public function exe(Request $req): void {
        $exeUrl = Settings::get('app.exe_url');
        $ver    = Settings::get('app.exe_version', '1.0.0');

        if (!$exeUrl) {
            Response::error('Download not available yet. Check back soon.', 503);
        }

        // External URL (e.g. GitHub releases / S3) → redirect
        if (str_starts_with($exeUrl, 'http')) {
            Response::redirect($exeUrl);
        }

        // Local file
        $path = __DIR__ . '/../../' . ltrim($exeUrl, '/');
        if (!file_exists($path)) Response::error('File not found', 404);

        Response::download($path, "Mediview-v{$ver}-Setup.exe");
    }

    /** JSON version info (desktop EXE polls this for updates) */
    public function version(Request $req): void {
        Response::json([
            'version'    => Settings::get('app.exe_version', '1.0.0'),
            'changelog'  => Settings::get('app.exe_changelog', ''),
            'download_url' => rtrim(getenv('APP_URL'), '/') . '/api/download/exe',
        ]);
    }
}
