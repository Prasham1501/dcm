# AI Medical Imaging System - Complete Implementation Plan

## 📋 Executive Summary

This document provides a comprehensive implementation plan for adding AI-powered diagnostic assistance to your existing Hospital Information System (HIS) with DICOM viewer. The implementation focuses on **Ultrasound (USG)** imaging analysis with expandability to CT/MRI.

---

## 🔑 API Keys Required

### Primary: Claude API (Anthropic)
- **Purpose**: Multimodal image analysis for medical imaging
- **Get Key**: https://console.anthropic.com/
- **Model to Use**: `claude-sonnet-4-20250514` (best balance of speed/quality for medical imaging)
- **Cost**: ~$3 per 1M input tokens, $15 per 1M output tokens
- **Add to**: `config/.env` as `CLAUDE_API_KEY=your_key_here`

### Alternative: Google Gemini API
- **Purpose**: Backup multimodal analysis
- **Get Key**: https://aistudio.google.com/apikey
- **Model**: `gemini-1.5-pro-vision`
- **Cost**: Free tier available (60 queries/minute)
- **Add to**: `config/.env` as `GEMINI_API_KEY=your_key_here`

---

## 📁 Project Structure Changes

```
C:\xampp\htdocs\papa\dicom_again\claude\
├── ai/                              ← NEW DIRECTORY
│   ├── config.php                   ← AI configuration
│   ├── analyze.php                  ← Main AI analysis endpoint
│   ├── report-generator.php         ← AI report generation
│   ├── feedback.php                 ← Feedback collection endpoint
│   ├── history.php                  ← Analysis history endpoint
│   ├── templates/                   ← Report templates
│   │   ├── usg-general.json
│   │   ├── usg-abdomen.json
│   │   └── usg-obstetric.json
│   └── prompts/                     ← AI prompt templates
│       ├── usg-analysis.txt
│       ├── ct-analysis.txt
│       └── mri-analysis.txt
├── assets/
│   ├── js/
│   │   └── ai-integration.js        ← NEW: Frontend AI integration
│   └── css/
│       └── ai-styles.css            ← NEW: AI UI styles
├── config/
│   └── .env                         ← ADD: CLAUDE_API_KEY
└── database/
    └── migrations/
        └── 001_create_ai_tables.sql ← NEW: Database migration
```

---

## 🗄️ Database Schema

### File: `database/migrations/001_create_ai_tables.sql`

```sql
-- AI Analysis Results Table
CREATE TABLE IF NOT EXISTS ai_analysis (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    study_uid VARCHAR(255) NOT NULL,
    series_uid VARCHAR(255),
    instance_uid VARCHAR(255),
    patient_id VARCHAR(64),
    patient_name VARCHAR(255),
    
    -- Analysis metadata
    analysis_type ENUM('USG', 'CT', 'MRI', 'XRAY', 'OTHER') DEFAULT 'USG',
    body_region VARCHAR(100),
    model_used VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514',
    model_version VARCHAR(50),
    
    -- Results (JSON format)
    findings JSON COMMENT 'Structured findings from AI',
    measurements JSON COMMENT 'Extracted measurements',
    anomalies JSON COMMENT 'Detected abnormalities',
    generated_report TEXT COMMENT 'Full text report',
    
    -- Confidence metrics
    overall_confidence DECIMAL(5,4) COMMENT '0.0000 to 1.0000',
    quality_score DECIMAL(5,4) COMMENT 'Image quality assessment',
    
    -- Processing info
    processing_time_ms INT UNSIGNED,
    tokens_used INT UNSIGNED,
    api_cost DECIMAL(10,6),
    
    -- Status tracking
    status ENUM('pending', 'processing', 'completed', 'failed', 'reviewed') DEFAULT 'pending',
    error_message TEXT,
    
    -- Audit fields
    created_by INT UNSIGNED,
    reviewed_by INT UNSIGNED,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_study_uid (study_uid),
    INDEX idx_patient_id (patient_id),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Feedback Table (for RLHF)
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    analysis_id INT UNSIGNED NOT NULL,
    
    -- Feedback details
    feedback_type ENUM('thumbs_up', 'thumbs_down', 'correction', 'comment') NOT NULL,
    feedback_category ENUM('accuracy', 'completeness', 'formatting', 'clinical_relevance', 'other') DEFAULT 'accuracy',
    
    -- Detailed feedback
    original_finding TEXT COMMENT 'What AI reported',
    corrected_finding TEXT COMMENT 'Doctor correction',
    comments TEXT,
    severity_rating TINYINT UNSIGNED COMMENT '1-5 scale for error severity',
    
    -- User info
    user_id INT UNSIGNED NOT NULL,
    user_role VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (analysis_id) REFERENCES ai_analysis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Model Performance Metrics Table
CREATE TABLE IF NOT EXISTS ai_metrics (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    
    -- Time period
    metric_date DATE NOT NULL,
    analysis_type ENUM('USG', 'CT', 'MRI', 'XRAY', 'OTHER') NOT NULL,
    
    -- Performance metrics
    total_analyses INT UNSIGNED DEFAULT 0,
    successful_analyses INT UNSIGNED DEFAULT 0,
    failed_analyses INT UNSIGNED DEFAULT 0,
    
    -- Feedback metrics
    thumbs_up_count INT UNSIGNED DEFAULT 0,
    thumbs_down_count INT UNSIGNED DEFAULT 0,
    corrections_count INT UNSIGNED DEFAULT 0,
    
    -- Quality metrics
    avg_confidence DECIMAL(5,4),
    avg_processing_time_ms INT UNSIGNED,
    avg_tokens_used INT UNSIGNED,
    total_api_cost DECIMAL(10,4),
    
    -- Calculated metrics
    accuracy_rate DECIMAL(5,4) GENERATED ALWAYS AS (
        CASE WHEN (thumbs_up_count + thumbs_down_count) > 0 
        THEN thumbs_up_count / (thumbs_up_count + thumbs_down_count) 
        ELSE NULL END
    ) STORED,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_date_type (metric_date, analysis_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Prompt Templates Table
CREATE TABLE IF NOT EXISTS ai_prompts (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    
    -- Template info
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    analysis_type ENUM('USG', 'CT', 'MRI', 'XRAY', 'OTHER') NOT NULL,
    body_region VARCHAR(100),
    
    -- Prompt content
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    output_format ENUM('json', 'text', 'structured') DEFAULT 'json',
    
    -- Settings
    temperature DECIMAL(3,2) DEFAULT 0.30,
    max_tokens INT UNSIGNED DEFAULT 4000,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    version INT UNSIGNED DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default USG prompt template
INSERT INTO ai_prompts (name, description, analysis_type, body_region, system_prompt, user_prompt_template, output_format) VALUES
('usg_general', 'General Ultrasound Analysis', 'USG', 'general', 
'You are an expert radiologist assistant specializing in ultrasound imaging analysis. Your role is to:
1. Identify anatomical structures visible in the ultrasound image
2. Detect any abnormalities, lesions, or pathological findings
3. Extract visible measurements from the image
4. Provide a preliminary diagnostic impression
5. Suggest follow-up recommendations when appropriate

IMPORTANT: Always indicate confidence levels for your findings. Be conservative with diagnoses and recommend clinical correlation.',

'Analyze this ultrasound image and provide a structured report.

Patient Context (if available): {{patient_context}}
Clinical History (if available): {{clinical_history}}
Body Region: {{body_region}}

Provide your analysis in the following JSON format:
{
  "image_quality": {
    "score": 0.0-1.0,
    "issues": ["list any quality issues"]
  },
  "anatomical_structures": [
    {
      "name": "structure name",
      "visibility": "clear|partial|obscured",
      "appearance": "description",
      "normal": true/false
    }
  ],
  "measurements": [
    {
      "structure": "what was measured",
      "dimension": "length|width|depth|area|volume",
      "value": numeric_value,
      "unit": "cm|mm|ml",
      "normal_range": "X-Y unit",
      "is_normal": true/false
    }
  ],
  "findings": [
    {
      "description": "finding description",
      "location": "anatomical location",
      "severity": "mild|moderate|severe",
      "confidence": 0.0-1.0,
      "differential_diagnosis": ["possible conditions"]
    }
  ],
  "impression": "Overall diagnostic impression in 2-3 sentences",
  "recommendations": ["list of recommendations"],
  "confidence_overall": 0.0-1.0,
  "requires_review": true/false,
  "urgent_findings": true/false
}',
'json');
```

---

## 📄 Backend Implementation

### File: `ai/config.php`

```php
<?php
/**
 * AI Configuration for Medical Imaging Analysis
 * Hospital DICOM Viewer Pro v2.0
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/../includes/config.php';

// Claude API Configuration
define('CLAUDE_API_KEY', $_ENV['CLAUDE_API_KEY'] ?? '');
define('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages');
define('CLAUDE_MODEL', 'claude-sonnet-4-20250514');
define('CLAUDE_MAX_TOKENS', 4000);
define('CLAUDE_TEMPERATURE', 0.3);

// Gemini API Configuration (Backup)
define('GEMINI_API_KEY', $_ENV['GEMINI_API_KEY'] ?? '');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent');

// AI Processing Settings
define('AI_ANALYSIS_TIMEOUT', 60); // seconds
define('AI_MAX_IMAGE_SIZE', 20 * 1024 * 1024); // 20MB
define('AI_SUPPORTED_MODALITIES', ['USG', 'CT', 'MRI', 'XRAY']);
define('AI_DEFAULT_MODALITY', 'USG');

// Quality thresholds
define('AI_MIN_CONFIDENCE_THRESHOLD', 0.6);
define('AI_HIGH_CONFIDENCE_THRESHOLD', 0.85);

/**
 * Get AI API client based on configuration
 */
function getAIClient() {
    if (!empty(CLAUDE_API_KEY)) {
        return 'claude';
    } elseif (!empty(GEMINI_API_KEY)) {
        return 'gemini';
    }
    return null;
}

/**
 * Validate AI configuration
 */
function validateAIConfig() {
    $errors = [];
    
    if (empty(CLAUDE_API_KEY) && empty(GEMINI_API_KEY)) {
        $errors[] = 'No AI API key configured. Add CLAUDE_API_KEY or GEMINI_API_KEY to .env';
    }
    
    return $errors;
}
```

### File: `ai/analyze.php`

```php
<?php
/**
 * AI Image Analysis Endpoint
 * POST /ai/analyze.php
 * 
 * Accepts DICOM images and returns AI-powered analysis
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized', 401);
}

try {
    $startTime = microtime(true);
    $currentUser = getCurrentUser();
    
    // Get input data
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (empty($input['image_data']) && empty($input['instance_id'])) {
        sendErrorResponse('Either image_data (base64) or instance_id is required', 400);
    }
    
    $studyUid = sanitizeInput($input['study_uid'] ?? '');
    $seriesUid = sanitizeInput($input['series_uid'] ?? '');
    $instanceUid = sanitizeInput($input['instance_uid'] ?? '');
    $patientId = sanitizeInput($input['patient_id'] ?? '');
    $patientName = sanitizeInput($input['patient_name'] ?? '');
    $analysisType = sanitizeInput($input['analysis_type'] ?? 'USG');
    $bodyRegion = sanitizeInput($input['body_region'] ?? 'general');
    $clinicalHistory = sanitizeInput($input['clinical_history'] ?? '');
    
    // Get image data
    $imageData = null;
    $mediaType = 'image/jpeg';
    
    if (!empty($input['instance_id'])) {
        // Fetch from Orthanc and convert to JPEG
        $imageResult = fetchAndConvertDicomImage($input['instance_id']);
        $imageData = $imageResult['data'];
        $mediaType = $imageResult['media_type'];
    } else {
        // Use provided base64 data
        $imageData = $input['image_data'];
        $mediaType = $input['media_type'] ?? 'image/jpeg';
    }
    
    if (empty($imageData)) {
        sendErrorResponse('Failed to obtain image data', 400);
    }
    
    // Get appropriate prompt template
    $promptTemplate = getPromptTemplate($analysisType, $bodyRegion);
    
    // Build the analysis request
    $analysisResult = performClaudeAnalysis(
        $imageData,
        $mediaType,
        $promptTemplate,
        [
            'patient_context' => $patientName ? "Patient: $patientName" : '',
            'clinical_history' => $clinicalHistory,
            'body_region' => $bodyRegion
        ]
    );
    
    $endTime = microtime(true);
    $processingTimeMs = round(($endTime - $startTime) * 1000);
    
    // Parse and validate the response
    $parsedResult = parseAIResponse($analysisResult);
    
    // Save to database
    $db = getDbConnection();
    $stmt = $db->prepare("
        INSERT INTO ai_analysis (
            study_uid, series_uid, instance_uid, patient_id, patient_name,
            analysis_type, body_region, model_used, model_version,
            findings, measurements, anomalies, generated_report,
            overall_confidence, quality_score, processing_time_ms,
            tokens_used, api_cost, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
    ");
    
    $modelUsed = CLAUDE_MODEL;
    $modelVersion = '2024-01';
    $findingsJson = json_encode($parsedResult['findings'] ?? []);
    $measurementsJson = json_encode($parsedResult['measurements'] ?? []);
    $anomaliesJson = json_encode($parsedResult['anomalies'] ?? []);
    $generatedReport = generateTextReport($parsedResult);
    $overallConfidence = $parsedResult['confidence_overall'] ?? 0.75;
    $qualityScore = $parsedResult['image_quality']['score'] ?? 0.8;
    $tokensUsed = $analysisResult['usage']['input_tokens'] + $analysisResult['usage']['output_tokens'];
    $apiCost = calculateAPICost($tokensUsed);
    
    $stmt->bind_param(
        "sssssssssssssddiiids",
        $studyUid, $seriesUid, $instanceUid, $patientId, $patientName,
        $analysisType, $bodyRegion, $modelUsed, $modelVersion,
        $findingsJson, $measurementsJson, $anomaliesJson, $generatedReport,
        $overallConfidence, $qualityScore, $processingTimeMs,
        $tokensUsed, $apiCost, $currentUser['id']
    );
    
    if (!$stmt->execute()) {
        throw new Exception("Failed to save analysis: " . $stmt->error);
    }
    
    $analysisId = $stmt->insert_id;
    $stmt->close();
    
    // Log the analysis
    logMessage(
        "AI Analysis completed: ID=$analysisId, Study=$studyUid, Type=$analysisType, Confidence=$overallConfidence",
        'info',
        'ai_analysis.log'
    );
    
    // Return the result
    sendSuccessResponse([
        'analysis_id' => $analysisId,
        'study_uid' => $studyUid,
        'analysis_type' => $analysisType,
        'findings' => $parsedResult['findings'] ?? [],
        'measurements' => $parsedResult['measurements'] ?? [],
        'anatomical_structures' => $parsedResult['anatomical_structures'] ?? [],
        'impression' => $parsedResult['impression'] ?? '',
        'recommendations' => $parsedResult['recommendations'] ?? [],
        'confidence' => $overallConfidence,
        'quality_score' => $qualityScore,
        'urgent_findings' => $parsedResult['urgent_findings'] ?? false,
        'requires_review' => $parsedResult['requires_review'] ?? true,
        'generated_report' => $generatedReport,
        'processing_time_ms' => $processingTimeMs,
        'model_used' => $modelUsed
    ], 'Analysis completed successfully');
    
} catch (Exception $e) {
    logMessage("AI Analysis error: " . $e->getMessage(), 'error', 'ai_analysis.log');
    sendErrorResponse('Analysis failed: ' . $e->getMessage(), 500);
}

/**
 * Perform Claude API analysis
 */
function performClaudeAnalysis($imageData, $mediaType, $promptTemplate, $context) {
    $systemPrompt = $promptTemplate['system_prompt'];
    $userPrompt = $promptTemplate['user_prompt_template'];
    
    // Replace placeholders in user prompt
    foreach ($context as $key => $value) {
        $userPrompt = str_replace('{{' . $key . '}}', $value, $userPrompt);
    }
    
    $payload = [
        'model' => CLAUDE_MODEL,
        'max_tokens' => CLAUDE_MAX_TOKENS,
        'temperature' => CLAUDE_TEMPERATURE,
        'messages' => [
            [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'image',
                        'source' => [
                            'type' => 'base64',
                            'media_type' => $mediaType,
                            'data' => $imageData
                        ]
                    ],
                    [
                        'type' => 'text',
                        'text' => $userPrompt
                    ]
                ]
            ]
        ],
        'system' => $systemPrompt
    ];
    
    $ch = curl_init(CLAUDE_API_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, AI_ANALYSIS_TIMEOUT);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . CLAUDE_API_KEY,
        'anthropic-version: 2023-06-01'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$response) {
        throw new Exception("Claude API error: HTTP $httpCode - $error - $response");
    }
    
    return json_decode($response, true);
}

/**
 * Parse AI response and extract structured data
 */
function parseAIResponse($response) {
    if (empty($response['content'][0]['text'])) {
        throw new Exception('Empty response from AI');
    }
    
    $text = $response['content'][0]['text'];
    
    // Try to extract JSON from the response
    if (preg_match('/\{[\s\S]*\}/', $text, $matches)) {
        $jsonData = json_decode($matches[0], true);
        if ($jsonData !== null) {
            return $jsonData;
        }
    }
    
    // Fallback: return as unstructured text
    return [
        'findings' => [['description' => $text, 'confidence' => 0.7]],
        'impression' => $text,
        'confidence_overall' => 0.7,
        'requires_review' => true
    ];
}

/**
 * Fetch DICOM from Orthanc and convert to JPEG
 */
function fetchAndConvertDicomImage($instanceId) {
    // Get rendered PNG from Orthanc
    $orthancUrl = ORTHANC_URL . "/instances/$instanceId/rendered";
    
    $ch = curl_init($orthancUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    
    $imageData = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 || !$imageData) {
        throw new Exception("Failed to fetch image from Orthanc");
    }
    
    return [
        'data' => base64_encode($imageData),
        'media_type' => 'image/png'
    ];
}

/**
 * Get prompt template from database
 */
function getPromptTemplate($analysisType, $bodyRegion) {
    $db = getDbConnection();
    
    $stmt = $db->prepare("
        SELECT system_prompt, user_prompt_template, temperature, max_tokens
        FROM ai_prompts
        WHERE analysis_type = ? AND (body_region = ? OR body_region = 'general')
        AND is_active = 1
        ORDER BY CASE WHEN body_region = ? THEN 0 ELSE 1 END
        LIMIT 1
    ");
    
    $stmt->bind_param("sss", $analysisType, $bodyRegion, $bodyRegion);
    $stmt->execute();
    $result = $stmt->get_result();
    $template = $result->fetch_assoc();
    $stmt->close();
    
    if (!$template) {
        // Return default template
        return [
            'system_prompt' => 'You are an expert radiologist assistant. Analyze the medical image and provide structured findings.',
            'user_prompt_template' => 'Analyze this medical image and provide findings in JSON format.',
            'temperature' => 0.3,
            'max_tokens' => 4000
        ];
    }
    
    return $template;
}

/**
 * Generate text report from structured data
 */
function generateTextReport($data) {
    $report = "=== AI-ASSISTED DIAGNOSTIC REPORT ===\n\n";
    
    // Image Quality
    if (!empty($data['image_quality'])) {
        $report .= "IMAGE QUALITY: " . ($data['image_quality']['score'] * 100) . "%\n";
        if (!empty($data['image_quality']['issues'])) {
            $report .= "Issues: " . implode(', ', $data['image_quality']['issues']) . "\n";
        }
        $report .= "\n";
    }
    
    // Anatomical Structures
    if (!empty($data['anatomical_structures'])) {
        $report .= "ANATOMICAL STRUCTURES:\n";
        foreach ($data['anatomical_structures'] as $structure) {
            $status = $structure['normal'] ? 'Normal' : 'Abnormal';
            $report .= "- {$structure['name']}: {$structure['appearance']} ($status)\n";
        }
        $report .= "\n";
    }
    
    // Measurements
    if (!empty($data['measurements'])) {
        $report .= "MEASUREMENTS:\n";
        foreach ($data['measurements'] as $measurement) {
            $status = $measurement['is_normal'] ? '(Normal)' : '(Abnormal)';
            $report .= "- {$measurement['structure']}: {$measurement['value']} {$measurement['unit']} $status\n";
        }
        $report .= "\n";
    }
    
    // Findings
    if (!empty($data['findings'])) {
        $report .= "FINDINGS:\n";
        foreach ($data['findings'] as $finding) {
            $confidence = round($finding['confidence'] * 100);
            $report .= "- {$finding['description']} (Confidence: $confidence%)\n";
            if (!empty($finding['location'])) {
                $report .= "  Location: {$finding['location']}\n";
            }
        }
        $report .= "\n";
    }
    
    // Impression
    if (!empty($data['impression'])) {
        $report .= "IMPRESSION:\n{$data['impression']}\n\n";
    }
    
    // Recommendations
    if (!empty($data['recommendations'])) {
        $report .= "RECOMMENDATIONS:\n";
        foreach ($data['recommendations'] as $rec) {
            $report .= "- $rec\n";
        }
        $report .= "\n";
    }
    
    // Confidence
    if (isset($data['confidence_overall'])) {
        $report .= "Overall Confidence: " . round($data['confidence_overall'] * 100) . "%\n";
    }
    
    $report .= "\n--- This is an AI-assisted preliminary report. Clinical correlation and physician review required. ---\n";
    
    return $report;
}

/**
 * Calculate API cost based on tokens
 */
function calculateAPICost($tokens) {
    // Claude pricing: ~$3/1M input, $15/1M output (approximated)
    return ($tokens / 1000000) * 9; // Average cost
}
```

### File: `ai/feedback.php`

```php
<?php
/**
 * AI Feedback Collection Endpoint
 * POST /ai/feedback.php
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth/session.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized', 401);
}

$currentUser = getCurrentUser();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Submit feedback
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['analysis_id'])) {
            sendErrorResponse('analysis_id is required', 400);
        }
        
        if (empty($input['feedback_type'])) {
            sendErrorResponse('feedback_type is required', 400);
        }
        
        $analysisId = intval($input['analysis_id']);
        $feedbackType = sanitizeInput($input['feedback_type']);
        $feedbackCategory = sanitizeInput($input['feedback_category'] ?? 'accuracy');
        $originalFinding = $input['original_finding'] ?? null;
        $correctedFinding = $input['corrected_finding'] ?? null;
        $comments = $input['comments'] ?? null;
        $severityRating = isset($input['severity_rating']) ? intval($input['severity_rating']) : null;
        
        // Validate feedback type
        $validTypes = ['thumbs_up', 'thumbs_down', 'correction', 'comment'];
        if (!in_array($feedbackType, $validTypes)) {
            sendErrorResponse('Invalid feedback_type', 400);
        }
        
        $db = getDbConnection();
        
        // Verify analysis exists
        $checkStmt = $db->prepare("SELECT id FROM ai_analysis WHERE id = ?");
        $checkStmt->bind_param("i", $analysisId);
        $checkStmt->execute();
        if ($checkStmt->get_result()->num_rows === 0) {
            $checkStmt->close();
            sendErrorResponse('Analysis not found', 404);
        }
        $checkStmt->close();
        
        // Insert feedback
        $stmt = $db->prepare("
            INSERT INTO ai_feedback (
                analysis_id, feedback_type, feedback_category,
                original_finding, corrected_finding, comments,
                severity_rating, user_id, user_role
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $userRole = $currentUser['role'] ?? 'user';
        
        $stmt->bind_param(
            "isssssiis",
            $analysisId, $feedbackType, $feedbackCategory,
            $originalFinding, $correctedFinding, $comments,
            $severityRating, $currentUser['id'], $userRole
        );
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to save feedback: " . $stmt->error);
        }
        
        $feedbackId = $stmt->insert_id;
        $stmt->close();
        
        // Update analysis status if correction provided
        if ($feedbackType === 'correction' || $feedbackType === 'thumbs_down') {
            $updateStmt = $db->prepare("
                UPDATE ai_analysis SET status = 'reviewed', reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            ");
            $updateStmt->bind_param("ii", $currentUser['id'], $analysisId);
            $updateStmt->execute();
            $updateStmt->close();
        }
        
        logMessage(
            "AI Feedback submitted: ID=$feedbackId, Analysis=$analysisId, Type=$feedbackType",
            'info',
            'ai_feedback.log'
        );
        
        sendSuccessResponse([
            'feedback_id' => $feedbackId,
            'analysis_id' => $analysisId,
            'feedback_type' => $feedbackType
        ], 'Feedback submitted successfully');
        
    } catch (Exception $e) {
        logMessage("AI Feedback error: " . $e->getMessage(), 'error', 'ai_feedback.log');
        sendErrorResponse('Failed to submit feedback: ' . $e->getMessage(), 500);
    }
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get feedback statistics
    try {
        $analysisId = isset($_GET['analysis_id']) ? intval($_GET['analysis_id']) : null;
        
        $db = getDbConnection();
        
        if ($analysisId) {
            // Get feedback for specific analysis
            $stmt = $db->prepare("
                SELECT f.*, u.full_name as user_name
                FROM ai_feedback f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.analysis_id = ?
                ORDER BY f.created_at DESC
            ");
            $stmt->bind_param("i", $analysisId);
        } else {
            // Get overall statistics
            $stmt = $db->prepare("
                SELECT 
                    feedback_type,
                    feedback_category,
                    COUNT(*) as count,
                    AVG(severity_rating) as avg_severity
                FROM ai_feedback
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY feedback_type, feedback_category
            ");
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        $data = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        
        sendSuccessResponse($data);
        
    } catch (Exception $e) {
        sendErrorResponse('Failed to get feedback: ' . $e->getMessage(), 500);
    }
}
```

---

## 🎨 Frontend Implementation

### File: `assets/js/ai-integration.js`

```javascript
/**
 * AI Integration Module for DICOM Viewer
 * Handles AI analysis requests, results display, and feedback
 */

window.DICOM_VIEWER = window.DICOM_VIEWER || {};

window.DICOM_VIEWER.AIAssistant = class AIAssistant {
    constructor() {
        this.basePath = window.basePath || '';
        this.currentAnalysis = null;
        this.isAnalyzing = false;
        this.analysisHistory = [];
    }

    /**
     * Initialize AI Assistant UI
     */
    initialize() {
        this.createAIButton();
        this.createAnalysisModal();
        this.bindEvents();
        console.log('AI Assistant initialized');
    }

    /**
     * Create AI Analysis button in navbar
     */
    createAIButton() {
        const navbar = document.querySelector('.navbar .d-flex');
        if (!navbar) return;

        const aiButton = document.createElement('button');
        aiButton.id = 'aiAnalysisBtn';
        aiButton.className = 'btn btn-info me-2';
        aiButton.innerHTML = `
            <i class="bi bi-robot me-2"></i>
            <span>AI Analysis</span>
        `;
        aiButton.title = 'Analyze current image with AI';
        
        // Insert before settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.parentNode.insertBefore(aiButton, settingsBtn);
        } else {
            navbar.appendChild(aiButton);
        }
    }

    /**
     * Create analysis results modal
     */
    createAnalysisModal() {
        const modal = document.createElement('div');
        modal.id = 'aiAnalysisModal';
        modal.className = 'modal fade';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content bg-dark">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title">
                            <i class="bi bi-robot text-info me-2"></i>
                            AI Diagnostic Analysis
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="aiAnalysisContent">
                        <!-- Content will be dynamically inserted -->
                    </div>
                    <div class="modal-footer border-secondary">
                        <div class="d-flex justify-content-between w-100">
                            <div id="aiFeedbackButtons">
                                <span class="text-muted me-2">Was this helpful?</span>
                                <button class="btn btn-outline-success btn-sm" onclick="window.DICOM_VIEWER.aiAssistant.submitFeedback('thumbs_up')">
                                    <i class="bi bi-hand-thumbs-up"></i> Yes
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="window.DICOM_VIEWER.aiAssistant.submitFeedback('thumbs_down')">
                                    <i class="bi bi-hand-thumbs-down"></i> No
                                </button>
                                <button class="btn btn-outline-warning btn-sm" onclick="window.DICOM_VIEWER.aiAssistant.showCorrectionForm()">
                                    <i class="bi bi-pencil"></i> Suggest Correction
                                </button>
                            </div>
                            <div>
                                <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button class="btn btn-primary" onclick="window.DICOM_VIEWER.aiAssistant.addToReport()">
                                    <i class="bi bi-file-medical"></i> Add to Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    /**
     * Bind event handlers
     */
    bindEvents() {
        document.getElementById('aiAnalysisBtn')?.addEventListener('click', () => {
            this.analyzeCurrentImage();
        });

        // Keyboard shortcut: Ctrl+Shift+A for AI analysis
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.analyzeCurrentImage();
            }
        });
    }

    /**
     * Analyze current image
     */
    async analyzeCurrentImage() {
        if (this.isAnalyzing) {
            this.showNotification('Analysis already in progress...', 'warning');
            return;
        }

        const state = window.DICOM_VIEWER.STATE;
        
        if (!state.currentSeriesImages || state.currentSeriesImages.length === 0) {
            this.showNotification('Please load DICOM images first', 'error');
            return;
        }

        const currentImage = state.currentSeriesImages[state.currentImageIndex];
        if (!currentImage) {
            this.showNotification('No image selected', 'error');
            return;
        }

        this.isAnalyzing = true;
        this.showModal();
        this.showLoadingState();

        try {
            // Get image data
            let imageData, instanceId;
            
            if (currentImage.isOrthancImage && currentImage.orthancInstanceId) {
                instanceId = currentImage.orthancInstanceId;
            } else {
                // Get image from canvas
                const activeViewport = state.activeViewport;
                if (activeViewport) {
                    const canvas = activeViewport.querySelector('canvas');
                    if (canvas) {
                        imageData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
                    }
                }
            }

            const requestBody = {
                study_uid: currentImage.study_uid || '',
                series_uid: currentImage.series_uid || '',
                instance_uid: currentImage.instance_uid || currentImage.id,
                patient_id: currentImage.patient_id || '',
                patient_name: currentImage.patient_name || '',
                analysis_type: 'USG',
                body_region: 'general',
                clinical_history: ''
            };

            if (instanceId) {
                requestBody.instance_id = instanceId;
            } else if (imageData) {
                requestBody.image_data = imageData;
                requestBody.media_type = 'image/jpeg';
            } else {
                throw new Error('Could not obtain image data');
            }

            const response = await fetch(`${this.basePath}/ai/analyze.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || data.message || 'Analysis failed');
            }

            this.currentAnalysis = data.data;
            this.displayResults(data.data);
            this.analysisHistory.push(data.data);

        } catch (error) {
            console.error('AI Analysis error:', error);
            this.showError(error.message);
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Show modal
     */
    showModal() {
        const modal = new bootstrap.Modal(document.getElementById('aiAnalysisModal'));
        modal.show();
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const content = document.getElementById('aiAnalysisContent');
        content.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-info mb-3" style="width: 3rem; height: 3rem;"></div>
                <h5 class="text-light">Analyzing Image...</h5>
                <p class="text-muted">AI is examining the ultrasound image for findings</p>
                <div class="progress mt-3" style="height: 4px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-info" style="width: 100%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Display analysis results
     */
    displayResults(data) {
        const content = document.getElementById('aiAnalysisContent');
        
        const confidenceColor = data.confidence >= 0.85 ? 'success' : 
                               data.confidence >= 0.7 ? 'warning' : 'danger';
        
        const urgentBadge = data.urgent_findings ? 
            '<span class="badge bg-danger ms-2"><i class="bi bi-exclamation-triangle"></i> Urgent</span>' : '';

        content.innerHTML = `
            <div class="ai-results">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <span class="badge bg-info">${data.analysis_type}</span>
                        <span class="badge bg-${confidenceColor} ms-2">
                            Confidence: ${Math.round(data.confidence * 100)}%
                        </span>
                        ${urgentBadge}
                    </div>
                    <small class="text-muted">
                        Processed in ${data.processing_time_ms}ms
                    </small>
                </div>

                <!-- Quality Score -->
                ${data.quality_score ? `
                    <div class="alert alert-${data.quality_score >= 0.7 ? 'success' : 'warning'} py-2">
                        <i class="bi bi-image"></i>
                        Image Quality: ${Math.round(data.quality_score * 100)}%
                    </div>
                ` : ''}

                <!-- Anatomical Structures -->
                ${data.anatomical_structures && data.anatomical_structures.length > 0 ? `
                    <div class="mb-4">
                        <h6 class="text-info border-bottom border-info pb-2">
                            <i class="bi bi-diagram-3"></i> Anatomical Structures
                        </h6>
                        <div class="row g-2">
                            ${data.anatomical_structures.map(s => `
                                <div class="col-md-6">
                                    <div class="card bg-dark border-secondary">
                                        <div class="card-body py-2">
                                            <strong>${s.name}</strong>
                                            <span class="badge ${s.normal ? 'bg-success' : 'bg-warning'} ms-2">
                                                ${s.normal ? 'Normal' : 'Abnormal'}
                                            </span>
                                            <p class="small text-muted mb-0">${s.appearance}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Measurements -->
                ${data.measurements && data.measurements.length > 0 ? `
                    <div class="mb-4">
                        <h6 class="text-info border-bottom border-info pb-2">
                            <i class="bi bi-rulers"></i> Measurements
                        </h6>
                        <table class="table table-dark table-sm">
                            <thead>
                                <tr>
                                    <th>Structure</th>
                                    <th>Value</th>
                                    <th>Normal Range</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.measurements.map(m => `
                                    <tr>
                                        <td>${m.structure}</td>
                                        <td>${m.value} ${m.unit}</td>
                                        <td>${m.normal_range || '-'}</td>
                                        <td>
                                            <span class="badge ${m.is_normal ? 'bg-success' : 'bg-warning'}">
                                                ${m.is_normal ? 'Normal' : 'Abnormal'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <!-- Findings -->
                ${data.findings && data.findings.length > 0 ? `
                    <div class="mb-4">
                        <h6 class="text-info border-bottom border-info pb-2">
                            <i class="bi bi-search"></i> Findings
                        </h6>
                        ${data.findings.map(f => `
                            <div class="alert alert-dark border-start border-3 ${
                                f.severity === 'severe' ? 'border-danger' :
                                f.severity === 'moderate' ? 'border-warning' : 'border-info'
                            }">
                                <div class="d-flex justify-content-between">
                                    <strong>${f.description}</strong>
                                    <span class="badge bg-secondary">
                                        ${Math.round((f.confidence || 0.7) * 100)}% confidence
                                    </span>
                                </div>
                                ${f.location ? `<small class="text-muted">Location: ${f.location}</small>` : ''}
                                ${f.differential_diagnosis && f.differential_diagnosis.length > 0 ? `
                                    <div class="mt-2">
                                        <small class="text-warning">Differential: ${f.differential_diagnosis.join(', ')}</small>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Impression -->
                ${data.impression ? `
                    <div class="mb-4">
                        <h6 class="text-info border-bottom border-info pb-2">
                            <i class="bi bi-clipboard-check"></i> Impression
                        </h6>
                        <div class="alert alert-info">
                            ${data.impression}
                        </div>
                    </div>
                ` : ''}

                <!-- Recommendations -->
                ${data.recommendations && data.recommendations.length > 0 ? `
                    <div class="mb-4">
                        <h6 class="text-info border-bottom border-info pb-2">
                            <i class="bi bi-lightbulb"></i> Recommendations
                        </h6>
                        <ul class="list-group list-group-flush">
                            ${data.recommendations.map(r => `
                                <li class="list-group-item bg-dark text-light border-secondary">
                                    <i class="bi bi-check-circle text-success me-2"></i>
                                    ${r}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Disclaimer -->
                <div class="alert alert-secondary mt-4">
                    <small>
                        <i class="bi bi-info-circle"></i>
                        <strong>Note:</strong> This is an AI-assisted preliminary analysis. 
                        All findings should be reviewed and confirmed by a qualified physician. 
                        Clinical correlation is required.
                    </small>
                </div>
            </div>
        `;

        // Enable feedback buttons
        document.getElementById('aiFeedbackButtons').style.display = 'block';
    }

    /**
     * Show error state
     */
    showError(message) {
        const content = document.getElementById('aiAnalysisContent');
        content.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                <h5 class="text-light mt-3">Analysis Failed</h5>
                <p class="text-muted">${message}</p>
                <button class="btn btn-primary mt-3" onclick="window.DICOM_VIEWER.aiAssistant.analyzeCurrentImage()">
                    <i class="bi bi-arrow-clockwise"></i> Try Again
                </button>
            </div>
        `;
    }

    /**
     * Submit feedback
     */
    async submitFeedback(feedbackType) {
        if (!this.currentAnalysis) {
            this.showNotification('No analysis to provide feedback for', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.basePath}/ai/feedback.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysis_id: this.currentAnalysis.analysis_id,
                    feedback_type: feedbackType
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Thank you for your feedback!', 'success');
                
                // Disable feedback buttons after submission
                document.querySelectorAll('#aiFeedbackButtons button').forEach(btn => {
                    btn.disabled = true;
                });
            } else {
                throw new Error(data.error || 'Failed to submit feedback');
            }

        } catch (error) {
            console.error('Feedback error:', error);
            this.showNotification('Failed to submit feedback: ' + error.message, 'error');
        }
    }

    /**
     * Show correction form
     */
    showCorrectionForm() {
        const content = document.getElementById('aiAnalysisContent');
        const currentContent = content.innerHTML;
        
        content.innerHTML += `
            <div class="correction-form mt-4 p-3 bg-dark border border-warning rounded" id="correctionForm">
                <h6 class="text-warning mb-3">
                    <i class="bi bi-pencil"></i> Suggest Correction
                </h6>
                <div class="mb-3">
                    <label class="form-label">What needs to be corrected?</label>
                    <textarea class="form-control bg-dark text-light" id="correctionOriginal" rows="2" 
                        placeholder="Enter the AI finding that was incorrect..."></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">What should it say?</label>
                    <textarea class="form-control bg-dark text-light" id="correctionSuggested" rows="2"
                        placeholder="Enter your correction..."></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Additional comments (optional)</label>
                    <textarea class="form-control bg-dark text-light" id="correctionComments" rows="2"
                        placeholder="Any additional context..."></textarea>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-warning" onclick="window.DICOM_VIEWER.aiAssistant.submitCorrection()">
                        Submit Correction
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('correctionForm').remove()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('correctionForm').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Submit correction
     */
    async submitCorrection() {
        const original = document.getElementById('correctionOriginal').value;
        const corrected = document.getElementById('correctionSuggested').value;
        const comments = document.getElementById('correctionComments').value;

        if (!original || !corrected) {
            this.showNotification('Please fill in both the original and corrected fields', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.basePath}/ai/feedback.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    analysis_id: this.currentAnalysis.analysis_id,
                    feedback_type: 'correction',
                    feedback_category: 'accuracy',
                    original_finding: original,
                    corrected_finding: corrected,
                    comments: comments
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification('Correction submitted successfully!', 'success');
                document.getElementById('correctionForm').remove();
            } else {
                throw new Error(data.error || 'Failed to submit correction');
            }

        } catch (error) {
            console.error('Correction error:', error);
            this.showNotification('Failed to submit correction: ' + error.message, 'error');
        }
    }

    /**
     * Add analysis to medical report
     */
    addToReport() {
        if (!this.currentAnalysis) {
            this.showNotification('No analysis to add', 'error');
            return;
        }

        // If reporting system is available, add to report
        if (window.DICOM_VIEWER.MANAGERS.reportingSystem) {
            const reportingSystem = window.DICOM_VIEWER.MANAGERS.reportingSystem;
            
            // Format AI findings for report
            const aiFindings = this.formatForReport(this.currentAnalysis);
            
            // Add to report (this would need to be implemented in reporting system)
            if (reportingSystem.addAIFindings) {
                reportingSystem.addAIFindings(aiFindings);
                this.showNotification('AI findings added to report', 'success');
            } else {
                // Copy to clipboard as fallback
                navigator.clipboard.writeText(this.currentAnalysis.generated_report || aiFindings);
                this.showNotification('AI report copied to clipboard', 'success');
            }
        } else {
            // Copy to clipboard
            navigator.clipboard.writeText(this.currentAnalysis.generated_report || 'No report available');
            this.showNotification('AI report copied to clipboard', 'success');
        }

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('aiAnalysisModal'))?.hide();
    }

    /**
     * Format analysis for report
     */
    formatForReport(data) {
        let report = '';
        
        if (data.findings && data.findings.length > 0) {
            report += 'AI-DETECTED FINDINGS:\n';
            data.findings.forEach(f => {
                report += `- ${f.description}\n`;
            });
        }
        
        if (data.impression) {
            report += `\nIMPRESSION: ${data.impression}\n`;
        }
        
        if (data.recommendations && data.recommendations.length > 0) {
            report += '\nRECOMMENDATIONS:\n';
            data.recommendations.forEach(r => {
                report += `- ${r}\n`;
            });
        }
        
        return report;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.DICOM_VIEWER.showAISuggestion) {
            window.DICOM_VIEWER.showAISuggestion(message);
        } else {
            alert(message);
        }
    }
};

// Initialize AI Assistant when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.DICOM_VIEWER.aiAssistant = new window.DICOM_VIEWER.AIAssistant();
    
    // Initialize after a small delay to ensure other components are ready
    setTimeout(() => {
        window.DICOM_VIEWER.aiAssistant.initialize();
    }, 1000);
});
```

### File: `assets/css/ai-styles.css`

```css
/* AI Analysis Styles */

#aiAnalysisBtn {
    animation: pulse 2s infinite;
}

#aiAnalysisBtn:hover {
    animation: none;
    transform: scale(1.05);
}

@keyframes pulse {
    0%, 100% {
        box-shadow: 0 0 0 0 rgba(13, 202, 240, 0.4);
    }
    50% {
        box-shadow: 0 0 0 10px rgba(13, 202, 240, 0);
    }
}

/* Analysis Modal */
#aiAnalysisModal .modal-content {
    background: linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%);
    border: 1px solid rgba(13, 202, 240, 0.3);
}

#aiAnalysisModal .modal-header {
    border-bottom: 1px solid rgba(13, 202, 240, 0.2);
}

#aiAnalysisModal .modal-footer {
    border-top: 1px solid rgba(13, 202, 240, 0.2);
}

/* Results styling */
.ai-results h6 {
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.ai-results .card {
    transition: transform 0.2s, box-shadow 0.2s;
}

.ai-results .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(13, 202, 240, 0.15);
}

/* Confidence indicators */
.confidence-high {
    color: #198754;
}

.confidence-medium {
    color: #ffc107;
}

.confidence-low {
    color: #dc3545;
}

/* Findings severity */
.finding-severe {
    border-left-color: #dc3545 !important;
}

.finding-moderate {
    border-left-color: #ffc107 !important;
}

.finding-mild {
    border-left-color: #0dcaf0 !important;
}

/* Correction form */
.correction-form {
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Responsive adjustments */
@media (max-width: 768px) {
    #aiAnalysisModal .modal-dialog {
        margin: 0.5rem;
    }
    
    .ai-results .table {
        font-size: 0.85rem;
    }
    
    #aiFeedbackButtons {
        flex-direction: column;
        gap: 0.5rem;
    }
}
```

---

## 🔧 Configuration Updates

### Add to `config/.env`:

```env
# AI Configuration
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# AI Settings
AI_ANALYSIS_TIMEOUT=60
AI_MAX_IMAGE_SIZE=20971520
AI_DEFAULT_MODEL=claude-sonnet-4-20250514
```

### Update `index.php` - Add AI script and CSS:

In the `<head>` section, add:
```html
<link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/ai-styles.css">
```

Before the closing `</body>` tag, add:
```html
<script src="<?= BASE_PATH ?>/assets/js/ai-integration.js"></script>
```

---

## 📱 Claude Code Implementation Prompt

Copy and paste this prompt to start implementation:

```
I need to implement an AI-powered diagnostic assistant for my Hospital DICOM Viewer. Here's the context:

PROJECT LOCATION: C:\xampp\htdocs\papa\dicom_again\claude

EXISTING STACK:
- Frontend: HTML, CSS, JavaScript, Bootstrap 5
- Backend: PHP 8.2 with MySQLi
- PACS: Orthanc server
- Viewer: Cornerstone.js
- Database: MySQL (dicom_viewer_v2_production)

IMPLEMENTATION TASKS:

1. CREATE DATABASE TABLES:
   - Run the SQL migration from the plan to create: ai_analysis, ai_feedback, ai_metrics, ai_prompts tables
   - File: database/migrations/001_create_ai_tables.sql

2. CREATE AI BACKEND:
   - ai/config.php - Configuration for Claude/Gemini APIs
   - ai/analyze.php - Main analysis endpoint that:
     * Accepts image from frontend or fetches from Orthanc
     * Sends to Claude API with medical imaging prompt
     * Parses structured JSON response
     * Saves to database
     * Returns results
   - ai/feedback.php - Feedback collection endpoint

3. CREATE FRONTEND:
   - assets/js/ai-integration.js - AI integration module that:
     * Adds "AI Analysis" button to navbar
     * Creates analysis modal
     * Handles API calls
     * Displays results with findings, measurements, impression
     * Implements thumbs up/down feedback
     * Allows correction submission
   - assets/css/ai-styles.css - Styling for AI components

4. UPDATE INDEX.PHP:
   - Add AI CSS in <head>
   - Add AI JavaScript before </body>

5. UPDATE CONFIG/.ENV:
   - Add CLAUDE_API_KEY placeholder

API KEY NEEDED: Claude API key from https://console.anthropic.com/

IMPORTANT REQUIREMENTS:
- Must work with cPanel hosting (no Docker)
- Use Claude claude-sonnet-4-20250514 model for analysis
- Focus on USG (ultrasound) analysis first
- Implement feedback loop for model improvement
- Store all analyses in database for review
- Show confidence scores for all findings
- Add disclaimer about AI-assisted preliminary analysis

START IMPLEMENTATION:
Begin by creating the database migration file, then the backend files, then the frontend files, and finally update index.php. Test each component as you go.
```

---

## 📊 Testing Checklist

After implementation, verify:

- [ ] Database tables created successfully
- [ ] AI Analysis button appears in navbar
- [ ] Clicking button with no image shows error message
- [ ] Loading an image and clicking AI Analysis shows loading state
- [ ] Analysis completes and displays results
- [ ] Findings, measurements, impression sections populate
- [ ] Confidence scores display correctly
- [ ] Thumbs up/down buttons work
- [ ] Correction form submits successfully
- [ ] Analysis saved to database
- [ ] Feedback saved to database
- [ ] "Add to Report" copies/adds findings

---

## 🔒 Security Considerations

1. **API Key Security**: Never expose in frontend code; all calls go through PHP backend
2. **HIPAA Compliance**: Consider de-identifying images before sending to external APIs
3. **Audit Logging**: All analyses logged with user, timestamp, study info
4. **Access Control**: Only authenticated users can trigger analysis
5. **Rate Limiting**: Consider implementing per-user rate limits

---

## 📈 Future Enhancements

1. **Phase 2**: Add CT scan analysis prompts
2. **Phase 3**: Add MRI analysis prompts  
3. **Phase 4**: Implement batch analysis for series
4. **Phase 5**: Add model fine-tuning pipeline using feedback data
5. **Phase 6**: Add comparison with previous studies
6. **Phase 7**: Integrate with reporting workflow

---

## 💰 Cost Estimation

| Usage Level | Analyses/Month | Estimated Cost |
|-------------|----------------|----------------|
| Low         | 100            | ~$5-10         |
| Medium      | 500            | ~$25-50        |
| High        | 2000           | ~$100-200      |

Based on ~4000 tokens per analysis at Claude Sonnet pricing.

---

## 📞 Support

For issues with implementation:
1. Check browser console for JavaScript errors
2. Check PHP error logs in `/logs/ai_analysis.log`
3. Verify API key is correct and has credits
4. Test API directly with curl to isolate issues
