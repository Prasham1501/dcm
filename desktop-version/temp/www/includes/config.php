<?php
/**
 * Hospital DICOM Viewer Pro - Desktop Edition
 * Configuration File
 * 
 * Standalone config for offline desktop operation - NO COMPOSER REQUIRED
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// =====================================================
// DEBUG MODE - Enhanced logging for desktop
// =====================================================
define('DEBUG_MODE', true);
define('DEBUG_SQL', true);
define('DEBUG_ORTHANC', true);
define('DESKTOP_MODE', true);

// =====================================================
// Path Configuration
// =====================================================
$scriptDir = __DIR__;
$wwwDir = dirname($scriptDir);
$desktopDir = dirname($wwwDir);
$configDir = $desktopDir . '/config';
$dataDir = getenv('APP_DATA_PATH') ?: $desktopDir . '/data';

// For PHP built-in server, BASE_PATH should be empty
define('BASE_PATH', '');
define('BASE_URL', 'http://localhost:8080');
define('APP_ROOT', $wwwDir);

// =====================================================
// Load Environment Variables from .env file
// =====================================================
$envFile = $configDir . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");
        if (!empty($name)) {
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

// =====================================================
// Database Configuration
// =====================================================
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASSWORD', getenv('DB_PASSWORD') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'dicom_viewer_pro');

// =====================================================
// Orthanc Configuration
// =====================================================
define('ORTHANC_URL', getenv('ORTHANC_URL') ?: 'http://localhost:8043');
define('ORTHANC_USERNAME', getenv('ORTHANC_USERNAME') ?: 'orthanc');
define('ORTHANC_PASSWORD', getenv('ORTHANC_PASSWORD') ?: 'orthanc');
define('ORTHANC_DICOMWEB_ROOT', getenv('ORTHANC_DICOMWEB_ROOT') ?: '/dicom-web');
define('ORTHANC_STORAGE_PATH', getenv('ORTHANC_STORAGE_PATH') ?: $dataDir . '/orthanc/storage');

// Backward compatibility aliases
define('ORTHANC_USER', ORTHANC_USERNAME);
define('ORTHANC_PASS', ORTHANC_PASSWORD);

// =====================================================
// Session Configuration
// =====================================================
define('SESSION_LIFETIME', (int)(getenv('SESSION_LIFETIME') ?: 600)); // 10 minutes
define('SESSION_SECURE', filter_var(getenv('SESSION_SECURE') ?: 'false', FILTER_VALIDATE_BOOLEAN));
define('SESSION_NAME', getenv('SESSION_NAME') ?: 'DICOM_DESKTOP_SESSION');

// =====================================================
// Application Configuration
// =====================================================
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_NAME', getenv('APP_NAME') ?: 'Hospital DICOM Viewer Pro - Desktop');
define('APP_VERSION', getenv('APP_VERSION') ?: '2.0.0-desktop');
define('APP_TIMEZONE', getenv('APP_TIMEZONE') ?: 'Asia/Kolkata');
define('ENVIRONMENT', APP_ENV);

// Set timezone
date_default_timezone_set(APP_TIMEZONE);

// =====================================================
// Logging Configuration
// =====================================================
define('LOG_LEVEL', getenv('LOG_LEVEL') ?: 'debug');
define('LOG_PATH', $dataDir . '/logs');

// Create log directory if it doesn't exist
if (!file_exists(LOG_PATH)) {
    @mkdir(LOG_PATH, 0755, true);
}

// =====================================================
// Security Configuration
// =====================================================
define('BCRYPT_COST', (int)(getenv('BCRYPT_COST') ?: 12));

// =====================================================
// Backup Configuration
// =====================================================
define('BACKUP_ENABLED', filter_var(getenv('BACKUP_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN));
define('BACKUP_SCHEDULE', getenv('BACKUP_SCHEDULE') ?: 'daily');
define('BACKUP_TIME', getenv('BACKUP_TIME') ?: '02:00');
define('BACKUP_RETENTION_DAYS', (int)(getenv('BACKUP_RETENTION_DAYS') ?: 30));
define('BACKUP_LOCAL_PATH', $dataDir . '/backups');

// Create backup directory if it doesn't exist
if (!file_exists(BACKUP_LOCAL_PATH)) {
    @mkdir(BACKUP_LOCAL_PATH, 0755, true);
}

// =====================================================
// Google Drive Configuration (optional - works when internet available)
// =====================================================
define('GOOGLE_CLIENT_ID', getenv('GOOGLE_CLIENT_ID') ?: '');
define('GOOGLE_CLIENT_SECRET', getenv('GOOGLE_CLIENT_SECRET') ?: '');
define('GOOGLE_REDIRECT_URI', getenv('GOOGLE_REDIRECT_URI') ?: '');
define('GOOGLE_DRIVE_FOLDER', getenv('GOOGLE_DRIVE_FOLDER') ?: 'DICOM_Viewer_Backups');

// =====================================================
// FTP Configuration (optional)
// =====================================================
define('FTP_HOST', getenv('FTP_HOST') ?: '');
define('FTP_USERNAME', getenv('FTP_USERNAME') ?: '');
define('FTP_PASSWORD', getenv('FTP_PASSWORD') ?: '');
define('FTP_PORT', (int)(getenv('FTP_PORT') ?: 21));
define('FTP_PATH', getenv('FTP_PATH') ?: '/public_html/dicom_viewer/');
define('FTP_PASSIVE', filter_var(getenv('FTP_PASSIVE') ?: 'true', FILTER_VALIDATE_BOOLEAN));

// =====================================================
// Sync Configuration
// =====================================================
define('SYNC_ENABLED', filter_var(getenv('SYNC_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN));
define('SYNC_INTERVAL', (int)(getenv('SYNC_INTERVAL') ?: 120));
define('HOSPITAL_DATA_PATH', getenv('HOSPITAL_DATA_PATH') ?: '');
define('MONITORING_ENABLED', filter_var(getenv('MONITORING_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN));

// =====================================================
// CORS Configuration
// =====================================================
define('CORS_ALLOWED_ORIGINS', getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost,http://localhost:8080');
define('CORS_ALLOWED_METHODS', getenv('CORS_ALLOWED_METHODS') ?: 'GET,POST,PUT,DELETE,OPTIONS');
define('CORS_ALLOWED_HEADERS', getenv('CORS_ALLOWED_HEADERS') ?: 'Content-Type,Authorization');

// =====================================================
// Offline Mode Configuration
// =====================================================
define('OFFLINE_MODE_ENABLED', filter_var(getenv('OFFLINE_MODE_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN));

// =====================================================
// Error Reporting
// =====================================================
if (DEBUG_MODE || APP_ENV === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(error_level: E_ALL & ~E_DEPRECATED & ~E_STRICT);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', LOG_PATH . '/php_errors.log');
}

// =====================================================
// Database Connection (MySQLi)
// =====================================================
$dbConnection = null;

/**
 * Get database connection (MySQLi)
 */
function getDbConnection() {
    global $dbConnection;
    
    if ($dbConnection !== null) {
        // Check if connection is still alive
        if (@$dbConnection->ping()) {
            return $dbConnection;
        }
    }
    
    if (DEBUG_MODE) {
        logMessage("Creating database connection to " . DB_HOST . ":" . DB_PORT, 'debug', 'database.log');
    }
    
    $dbConnection = @new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, (int)DB_PORT);
    
    if ($dbConnection->connect_error) {
        $error = "Database connection failed: " . $dbConnection->connect_error;
        logMessage($error, 'error', 'database.log');
        throw new Exception($error);
    }
    
    // Set charset
    $dbConnection->set_charset('utf8mb4');
    
    return $dbConnection;
}

/**
 * Close Database Connection
 */
function closeDbConnection() {
    global $dbConnection;
    if ($dbConnection !== null && $dbConnection instanceof mysqli) {
        // Suppress all errors - connection may already be closed
        try {
            // Check if connect_errno is set (means connection failed during init)
            if (!$dbConnection->connect_errno) {
                @$dbConnection->close();
            }
        } catch (Exception $e) {
            // Connection already closed or error - ignore
        } catch (Error $e) {
            // PHP 7+ errors - ignore
        }
        $dbConnection = null;
    }
}

// =====================================================
// Logging Functions
// =====================================================

/**
 * Log message to file
 */
function logMessage($message, $level = 'info', $file = 'app.log') {
    $logLevels = ['debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3];
    $currentLevel = $logLevels[strtolower(LOG_LEVEL)] ?? 1;
    $messageLevel = $logLevels[strtolower($level)] ?? 1;
    
    if ($messageLevel >= $currentLevel) {
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [" . strtoupper($level) . "] {$message}" . PHP_EOL;
        
        $logFile = LOG_PATH . '/' . $file;
        
        // Create logs directory if it doesn't exist
        if (!is_dir(LOG_PATH)) {
            @mkdir(LOG_PATH, 0755, true);
        }
        
        @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
}

/**
 * Debug log helper
 */
function debugLog($message, $level = 'INFO', $category = 'general') {
    if (!DEBUG_MODE && strtoupper($level) === 'DEBUG') {
        return;
    }
    logMessage("[$category] $message", strtolower($level), date('Y-m-d') . '.log');
}

/**
 * Log database query
 */
function debugDatabase($query, $params = [], $result = null) {
    if (!DEBUG_SQL) return;
    
    $message = "Query: " . substr($query, 0, 500);
    if (!empty($params)) {
        $message .= " | Params: " . json_encode($params);
    }
    logMessage($message, 'debug', 'database.log');
}

/**
 * Log Orthanc operations
 */
function debugOrthanc($action, $url, $response = null, $error = null) {
    if (!DEBUG_ORTHANC) return;
    
    $message = "[$action] $url";
    if ($error) {
        $message .= " | Error: $error";
        logMessage($message, 'error', 'orthanc.log');
    } else {
        logMessage($message, 'debug', 'orthanc.log');
    }
}

/**
 * Log error with stack trace
 */
function debugError($exception) {
    $message = get_class($exception) . ": " . $exception->getMessage();
    $message .= " in " . $exception->getFile() . ":" . $exception->getLine();
    logMessage($message, 'error', 'errors.log');
    logMessage("Stack trace: " . $exception->getTraceAsString(), 'debug', 'errors.log');
}

// =====================================================
// Response Helper Functions
// =====================================================

/**
 * Send JSON Response
 */
function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Send Error Response
 */
function sendErrorResponse($message, $statusCode = 400) {
    sendJsonResponse(['error' => $message, 'success' => false], $statusCode);
}

/**
 * Send Success Response
 */
function sendSuccessResponse($data = [], $message = 'Success') {
    sendJsonResponse(['success' => true, 'message' => $message, 'data' => $data], 200);
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Sanitize Input
 */
function sanitizeInput($input) {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

/**
 * Validate Email
 */
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Generate Random Token
 */
function generateToken($length = 32) {
    return bin2hex(random_bytes($length));
}

/**
 * Check if internet is available
 */
function isInternetAvailable() {
    static $lastCheck = null;
    static $lastResult = null;
    
    // Cache result for 30 seconds
    if ($lastCheck !== null && (time() - $lastCheck) < 30) {
        return $lastResult;
    }
    
    $lastCheck = time();
    $connected = @fsockopen("www.google.com", 80, $errno, $errstr, 2);
    if ($connected) {
        fclose($connected);
        $lastResult = true;
    } else {
        $lastResult = false;
    }
    
    return $lastResult;
}

/**
 * Check if Orthanc is available
 */
function isOrthancAvailable() {
    static $lastCheck = null;
    static $lastResult = null;
    
    // Cache result for 10 seconds
    if ($lastCheck !== null && (time() - $lastCheck) < 10) {
        return $lastResult;
    }
    
    $lastCheck = time();
    
    $ch = curl_init(ORTHANC_URL . '/system');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $lastResult = ($httpCode === 200);
    return $lastResult;
}

// =====================================================
// Register shutdown handler
// =====================================================
register_shutdown_function('closeDbConnection');

// =====================================================
// Startup log
// =====================================================
if (DEBUG_MODE) {
    debugLog("Application started - Desktop Mode", 'INFO', 'system');
}
    