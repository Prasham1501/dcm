<?php
/**
 * AI Configuration for Medical Imaging Analysis
 * Hospital DICOM Viewer Pro v2.0
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/../includes/config.php';

// Gemini API Configuration
define('GEMINI_API_KEY', $_ENV['GEMINI_API_KEY'] ?? '');
// Using gemini-2.0-flash as identified from available models
define('GEMINI_MODEL', 'gemini-2.0-flash');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent');

// AI Processing Settings
define('AI_ANALYSIS_TIMEOUT', 60); // seconds
define('AI_MAX_IMAGE_SIZE', 20 * 1024 * 1024); // 20MB
define('AI_SUPPORTED_MODALITIES', ['USG', 'CT', 'MRI', 'XRAY']);
define('AI_DEFAULT_MODALITY', 'USG');

// Quality thresholds
define('AI_MIN_CONFIDENCE_THRESHOLD', 0.6);
define('AI_HIGH_CONFIDENCE_THRESHOLD', 0.85);

/**
 * Validate AI configuration
 */
function validateAIConfig() {
    $errors = [];
    
    if (empty(GEMINI_API_KEY)) {
        $errors[] = 'No AI API key configured. Add GEMINI_API_KEY to .env';
    }
    
    return $errors;
}
?>
