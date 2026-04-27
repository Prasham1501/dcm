<?php
declare(strict_types=1);

// ── Bootstrap ──────────────────────────────────────────────────────────────
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/config/settings.php';

// ── Core ───────────────────────────────────────────────────────────────────
require_once __DIR__ . '/core/Router.php';
require_once __DIR__ . '/core/Request.php';
require_once __DIR__ . '/core/Response.php';
require_once __DIR__ . '/core/Auth.php';
require_once __DIR__ . '/core/Mailer.php';
require_once __DIR__ . '/core/Validator.php';
require_once __DIR__ . '/core/RateLimiter.php';
require_once __DIR__ . '/core/AuditLog.php';

// ── Middleware ─────────────────────────────────────────────────────────────
require_once __DIR__ . '/middleware/AuthMiddleware.php';
require_once __DIR__ . '/middleware/AdminMiddleware.php';

// ── Lib ────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/lib/Money.php';
require_once __DIR__ . '/lib/LicenseKey.php';
require_once __DIR__ . '/lib/GoogleAuth.php';
require_once __DIR__ . '/lib/RazorpayClient.php';
require_once __DIR__ . '/lib/GeminiClient.php';
require_once __DIR__ . '/lib/PdfInvoice.php';

// ── Controllers ────────────────────────────────────────────────────────────
require_once __DIR__ . '/controllers/PublicController.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/LicenseController.php';
require_once __DIR__ . '/controllers/DeviceController.php';
require_once __DIR__ . '/controllers/WalletController.php';
require_once __DIR__ . '/controllers/InvoiceController.php';
require_once __DIR__ . '/controllers/TicketController.php';
require_once __DIR__ . '/controllers/BugController.php';
require_once __DIR__ . '/controllers/TeamController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/AuditController.php';
require_once __DIR__ . '/controllers/ApiKeyController.php';
require_once __DIR__ . '/controllers/ReferralController.php';
require_once __DIR__ . '/controllers/ChatController.php';
require_once __DIR__ . '/controllers/ContactController.php';
require_once __DIR__ . '/controllers/DownloadController.php';
require_once __DIR__ . '/controllers/AdminController.php';
require_once __DIR__ . '/controllers/SettingsController.php';
require_once __DIR__ . '/controllers/WebhookController.php';
require_once __DIR__ . '/controllers/UploadController.php';

// Composer autoload (when available — needed for Razorpay, Dompdf, etc.)
$autoload = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoload)) require_once $autoload;

// ── CORS ───────────────────────────────────────────────────────────────────
$allowedOrigins = array_filter([
    getenv('APP_URL') ?: null,
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1',
]);

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && (in_array($origin, $allowedOrigins, true) || str_starts_with($origin, 'file://'))) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Expose-Headers: X-Refreshed-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Dispatch ───────────────────────────────────────────────────────────────
$router  = new Router();
$request = new Request();

require_once __DIR__ . '/routes.php';

try {
    $router->dispatch($request);
} catch (\Throwable $e) {
    $isDev = (getenv('APP_ENV') ?: 'production') === 'local';
    error_log('[API] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    Response::error(
        $isDev ? $e->getMessage() : 'An internal error occurred',
        500,
        $isDev ? ['file' => $e->getFile(), 'line' => $e->getLine()] : []
    );
}
