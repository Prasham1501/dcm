<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Configuration Loader
 *
 * Loads environment variables and provides database connection
 * Uses MySQLi as specified in requirements
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load Composer autoloader
require_once __DIR__ . '/../vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../config');
$dotenv->load();

// Database Configuration
define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_USER', $_ENV['DB_USER'] ?? 'root');
define('DB_PASSWORD', $_ENV['DB_PASSWORD'] ?? '');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'dicom_viewer_v2_production');

// Orthanc Configuration
define('ORTHANC_URL', $_ENV['ORTHANC_URL'] ?? 'http://localhost:8042');
define('ORTHANC_USERNAME', $_ENV['ORTHANC_USERNAME'] ?? 'orthanc');
define('ORTHANC_PASSWORD', $_ENV['ORTHANC_PASSWORD'] ?? 'orthanc');
define('ORTHANC_DICOMWEB_ROOT', $_ENV['ORTHANC_DICOMWEB_ROOT'] ?? '/dicom-web');
define('ORTHANC_STORAGE_PATH', $_ENV['ORTHANC_STORAGE_PATH'] ?? 'C:\Orthanc\OrthancStorage');

// Backward compatibility aliases for legacy code
define('ORTHANC_USER', ORTHANC_USERNAME);
define('ORTHANC_PASS', ORTHANC_PASSWORD);

// Session Configuration
define('SESSION_LIFETIME', $_ENV['SESSION_LIFETIME'] ?? 28800);
define('SESSION_SECURE', filter_var($_ENV['SESSION_SECURE'] ?? false, FILTER_VALIDATE_BOOLEAN));
define('SESSION_NAME', $_ENV['SESSION_NAME'] ?? 'DICOM_VIEWER_SESSION');

// Application Configuration
define('APP_ENV', $_ENV['APP_ENV'] ?? 'development');
define('APP_URL', $_ENV['APP_URL'] ?? 'http://localhost');
define('APP_NAME', $_ENV['APP_NAME'] ?? 'Hospital DICOM Viewer Pro v2.0');
define('APP_VERSION', $_ENV['APP_VERSION'] ?? '2.0.0');
define('APP_TIMEZONE', $_ENV['APP_TIMEZONE'] ?? 'UTC');

// Set PHP timezone
date_default_timezone_set(APP_TIMEZONE);

// Backward compatibility alias
define('ENVIRONMENT', APP_ENV);

// Auto-detect base path
// For this specific environment, we hardcode it to ensure stability across subdirectories
$basePath = '/papa/dicom_again/claude';
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$baseUrl = $protocol . '://' . $host . $basePath;

// Only define if not already defined
if (!defined('BASE_PATH')) {
    define('BASE_PATH', $basePath);
}
if (!defined('BASE_URL')) {
    define('BASE_URL', $baseUrl);
}

// Security Configuration
define('BCRYPT_COST', $_ENV['BCRYPT_COST'] ?? 12);

// Logging Configuration
define('LOG_LEVEL', $_ENV['LOG_LEVEL'] ?? 'info');
define('LOG_PATH', __DIR__ . '/' . ($_ENV['LOG_PATH'] ?? '../logs'));

// Google Drive Configuration
define('GOOGLE_CLIENT_ID', $_ENV['GOOGLE_CLIENT_ID'] ?? '');
define('GOOGLE_CLIENT_SECRET', $_ENV['GOOGLE_CLIENT_SECRET'] ?? '');
define('GOOGLE_REDIRECT_URI', $_ENV['GOOGLE_REDIRECT_URI'] ?? '');
define('GOOGLE_DRIVE_FOLDER', $_ENV['GOOGLE_DRIVE_FOLDER'] ?? 'DICOM_Viewer_Backups');

// FTP Configuration
define('FTP_HOST', $_ENV['FTP_HOST'] ?? '');
define('FTP_USERNAME', $_ENV['FTP_USERNAME'] ?? '');
define('FTP_PASSWORD', $_ENV['FTP_PASSWORD'] ?? '');
define('FTP_PORT', $_ENV['FTP_PORT'] ?? 21);
define('FTP_PATH', $_ENV['FTP_PATH'] ?? '/public_html/dicom_viewer/');
define('FTP_PASSIVE', filter_var($_ENV['FTP_PASSIVE'] ?? true, FILTER_VALIDATE_BOOLEAN));

// Sync Configuration
define('SYNC_ENABLED', filter_var($_ENV['SYNC_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN));
define('SYNC_INTERVAL', $_ENV['SYNC_INTERVAL'] ?? 120);
define('HOSPITAL_DATA_PATH', $_ENV['HOSPITAL_DATA_PATH'] ?? '');
define('MONITORING_ENABLED', filter_var($_ENV['MONITORING_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN));

// Backup Configuration
define('BACKUP_ENABLED', filter_var($_ENV['BACKUP_ENABLED'] ?? false, FILTER_VALIDATE_BOOLEAN));
define('BACKUP_SCHEDULE', $_ENV['BACKUP_SCHEDULE'] ?? 'daily');
define('BACKUP_TIME', $_ENV['BACKUP_TIME'] ?? '02:00');
define('BACKUP_RETENTION_DAYS', $_ENV['BACKUP_RETENTION_DAYS'] ?? 30);

// CORS Configuration
define('CORS_ALLOWED_ORIGINS', $_ENV['CORS_ALLOWED_ORIGINS'] ?? 'http://localhost');
define('CORS_ALLOWED_METHODS', $_ENV['CORS_ALLOWED_METHODS'] ?? 'GET,POST,PUT,DELETE,OPTIONS');
define('CORS_ALLOWED_HEADERS', $_ENV['CORS_ALLOWED_HEADERS'] ?? 'Content-Type,Authorization');

// Set Timezone
date_default_timezone_set(APP_TIMEZONE);

// Error Reporting
if (APP_ENV === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', LOG_PATH . '/php_errors.log');
}

/**
 * Get Database Connection (MySQLi)
 *
 * @return mysqli Database connection
 * @throws Exception If connection fails
 */
function getDbConnection() {
    static $connection = null;

    if ($connection === null) {
        $connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

        if ($connection->connect_error) {
            error_log("Database connection failed: " . $connection->connect_error);
            throw new Exception("Database connection failed");
        }

        // Set charset to UTF-8
        $connection->set_charset("utf8mb4");
    }

    return $connection;
}

/**
 * Close Database Connection
 */
function closeDbConnection() {
    $connection = getDbConnection();
    if ($connection) {
        $connection->close();
    }
}

/**
 * Log message to file
 *
 * @param string $message Message to log
 * @param string $level Log level (debug, info, warning, error)
 * @param string $file Log file name (default: app.log)
 */
function logMessage($message, $level = 'info', $file = 'app.log') {
    $logLevels = ['debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3];
    $currentLevel = $logLevels[LOG_LEVEL] ?? 1;
    $messageLevel = $logLevels[$level] ?? 1;

    if ($messageLevel >= $currentLevel) {
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;

        $logFile = LOG_PATH . '/' . $file;

        // Create logs directory if it doesn't exist
        if (!is_dir(LOG_PATH)) {
            mkdir(LOG_PATH, 0755, true);
        }

        file_put_contents($logFile, $logEntry, FILE_APPEND);
    }
}

/**
 * Send JSON Response
 *
 * @param mixed $data Data to send
 * @param int $statusCode HTTP status code
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Send Error Response
 *
 * @param string $message Error message
 * @param int $statusCode HTTP status code
 */
function sendErrorResponse($message, $statusCode = 400) {
    sendJsonResponse(['error' => $message, 'success' => false], $statusCode);
}

/**
 * Send Success Response
 *
 * @param mixed $data Success data
 * @param string $message Success message
 */
function sendSuccessResponse($data = [], $message = 'Success') {
    sendJsonResponse(['success' => true, 'message' => $message, 'data' => $data], 200);
}

/**
 * Sanitize Input
 *
 * @param string $input Input to sanitize
 * @return string Sanitized input
 */
function sanitizeInput($input) {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

/**
 * Validate Email
 *
 * @param string $email Email to validate
 * @return bool True if valid
 */
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Generate Random Token
 *
 * @param int $length Token length
 * @return string Random token
 */
function generateToken($length = 32) {
    return bin2hex(random_bytes($length));
}

// Register shutdown function to close database connection
register_shutdown_function('closeDbConnection');
