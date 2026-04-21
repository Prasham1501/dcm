# CLAUDE CODE IMPLEMENTATION PROMPT
# Copy everything below this line and paste into a new Claude Code session

---

## PROJECT CONTEXT

I have a Hospital Information System (HIS) with DICOM viewer that needs AI-powered diagnostic assistance.

**Project Location:** `C:\xampp\htdocs\papa\dicom_again\claude`

**Existing Stack:**
- Frontend: HTML, CSS, JavaScript, Bootstrap 5.3
- Backend: PHP 8.2 with MySQLi
- PACS Server: Orthanc (localhost:8042)
- DICOM Viewer: Cornerstone.js
- Database: MySQL `dicom_viewer_v2_production`
- Authentication: Session-based PHP auth
- Config: Environment variables in `config/.env`

**Key Existing Files:**
- `index.php` - Main DICOM viewer with Cornerstone.js
- `includes/config.php` - Database and app configuration
- `auth/session.php` - Authentication handling
- `api/get_dicom_from_orthanc.php` - Orthanc DICOM proxy
- `api/reports/` - Existing medical reports API

---

## IMPLEMENTATION OBJECTIVE

Build an AI-powered diagnostic assistant for **ULTRASOUND (USG)** imaging that:

1. Adds an "AI Analysis" button to the navbar in index.php
2. When clicked, captures the current DICOM image being viewed
3. Sends the image to Claude API for analysis
4. Displays structured results (findings, measurements, impression)
5. Implements thumbs up/down feedback for model improvement
6. Stores all analyses in the database for review

---

## STEP 1: CREATE DATABASE MIGRATION

Create file: `database/migrations/001_create_ai_tables.sql`

```sql
-- AI Analysis Results Table
CREATE TABLE IF NOT EXISTS ai_analysis (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    study_uid VARCHAR(255) NOT NULL,
    series_uid VARCHAR(255),
    instance_uid VARCHAR(255),
    patient_id VARCHAR(64),
    patient_name VARCHAR(255),
    analysis_type ENUM('USG', 'CT', 'MRI', 'XRAY', 'OTHER') DEFAULT 'USG',
    body_region VARCHAR(100),
    model_used VARCHAR(50) DEFAULT 'claude-sonnet-4-20250514',
    model_version VARCHAR(50),
    findings JSON,
    measurements JSON,
    anomalies JSON,
    generated_report TEXT,
    overall_confidence DECIMAL(5,4),
    quality_score DECIMAL(5,4),
    processing_time_ms INT UNSIGNED,
    tokens_used INT UNSIGNED,
    api_cost DECIMAL(10,6),
    status ENUM('pending', 'processing', 'completed', 'failed', 'reviewed') DEFAULT 'pending',
    error_message TEXT,
    created_by INT UNSIGNED,
    reviewed_by INT UNSIGNED,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_study_uid (study_uid),
    INDEX idx_patient_id (patient_id),
    INDEX idx_analysis_type (analysis_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Feedback Table
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    analysis_id INT UNSIGNED NOT NULL,
    feedback_type ENUM('thumbs_up', 'thumbs_down', 'correction', 'comment') NOT NULL,
    feedback_category ENUM('accuracy', 'completeness', 'formatting', 'clinical_relevance', 'other') DEFAULT 'accuracy',
    original_finding TEXT,
    corrected_finding TEXT,
    comments TEXT,
    severity_rating TINYINT UNSIGNED,
    user_id INT UNSIGNED NOT NULL,
    user_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_analysis_id (analysis_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (analysis_id) REFERENCES ai_analysis(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI Prompt Templates Table
CREATE TABLE IF NOT EXISTS ai_prompts (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    analysis_type ENUM('USG', 'CT', 'MRI', 'XRAY', 'OTHER') NOT NULL,
    body_region VARCHAR(100),
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    output_format ENUM('json', 'text', 'structured') DEFAULT 'json',
    temperature DECIMAL(3,2) DEFAULT 0.30,
    max_tokens INT UNSIGNED DEFAULT 4000,
    is_active BOOLEAN DEFAULT TRUE,
    version INT UNSIGNED DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default USG prompt
INSERT INTO ai_prompts (name, description, analysis_type, body_region, system_prompt, user_prompt_template) VALUES
('usg_general', 'General Ultrasound Analysis', 'USG', 'general',
'You are an expert radiologist assistant specializing in ultrasound imaging analysis. Analyze images for:
1. Anatomical structures visible
2. Any abnormalities or pathological findings
3. Measurements if visible
4. Preliminary diagnostic impression
5. Recommendations when appropriate

IMPORTANT: Always indicate confidence levels. Be conservative with diagnoses.',

'Analyze this ultrasound image. Provide analysis in JSON format:
{
  "image_quality": {"score": 0.0-1.0, "issues": []},
  "anatomical_structures": [{"name": "", "visibility": "clear|partial|obscured", "appearance": "", "normal": true/false}],
  "measurements": [{"structure": "", "dimension": "", "value": 0, "unit": "cm|mm", "normal_range": "", "is_normal": true/false}],
  "findings": [{"description": "", "location": "", "severity": "mild|moderate|severe", "confidence": 0.0-1.0, "differential_diagnosis": []}],
  "impression": "",
  "recommendations": [],
  "confidence_overall": 0.0-1.0,
  "requires_review": true/false,
  "urgent_findings": true/false
}');
```

---

## STEP 2: CREATE AI BACKEND FILES

### Create: `ai/config.php`

```php
<?php
/**
 * AI Configuration
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

require_once __DIR__ . '/../includes/config.php';

// Claude API
define('CLAUDE_API_KEY', $_ENV['CLAUDE_API_KEY'] ?? '');
define('CLAUDE_API_URL', 'https://api.anthropic.com/v1/messages');
define('CLAUDE_MODEL', 'claude-sonnet-4-20250514');
define('CLAUDE_MAX_TOKENS', 4000);
define('CLAUDE_TEMPERATURE', 0.3);

// Settings
define('AI_ANALYSIS_TIMEOUT', 60);
define('AI_MAX_IMAGE_SIZE', 20 * 1024 * 1024);
```

### Create: `ai/analyze.php`

This file should:
1. Accept POST request with either `image_data` (base64) or `instance_id` (Orthanc)
2. Get prompt template from database
3. Call Claude API with image and prompt
4. Parse JSON response
5. Save to ai_analysis table
6. Return results

Key implementation details:
- Use `curl` for API calls
- Handle both Orthanc images and canvas-captured images
- Parse structured JSON from Claude response
- Calculate processing time and API cost
- Log all analyses

### Create: `ai/feedback.php`

This file should:
1. Accept POST for submitting feedback (thumbs_up, thumbs_down, correction)
2. Accept GET for retrieving feedback statistics
3. Update analysis status when correction is provided

---

## STEP 3: CREATE FRONTEND

### Create: `assets/js/ai-integration.js`

This JavaScript module should:
1. Create AIAssistant class
2. Add "AI Analysis" button to navbar (before settings button)
3. Create modal for displaying results
4. Handle analysis flow:
   - Capture image from active viewport canvas
   - Send to backend
   - Display structured results
5. Implement feedback buttons (thumbs up/down)
6. Implement correction form
7. Add keyboard shortcut (Ctrl+Shift+A)

### Create: `assets/css/ai-styles.css`

Style the AI button, modal, results display, and feedback components.

---

## STEP 4: UPDATE EXISTING FILES

### Update `config/.env` - Add:
```
CLAUDE_API_KEY=your_api_key_here
```

### Update `index.php`:

1. Add in `<head>`:
```html
<link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/ai-styles.css">
```

2. Add before `</body>`:
```html
<script src="<?= BASE_PATH ?>/assets/js/ai-integration.js"></script>
```

---

## API KEY REQUIRED

You need a Claude API key from: https://console.anthropic.com/

Model to use: `claude-sonnet-4-20250514`

---

## IMPLEMENTATION ORDER

1. First, run the SQL migration to create tables
2. Create `ai/config.php`
3. Create `ai/analyze.php` with full Claude integration
4. Create `ai/feedback.php`
5. Create `assets/js/ai-integration.js`
6. Create `assets/css/ai-styles.css`
7. Update `index.php` to include new files
8. Add API key to `.env`
9. Test the complete flow

---

## TESTING STEPS

1. Load a DICOM study in the viewer
2. Click the "AI Analysis" button
3. Verify loading state appears
4. Verify analysis results display with:
   - Anatomical structures
   - Measurements (if any)
   - Findings
   - Impression
   - Recommendations
   - Confidence score
5. Click thumbs up/down
6. Submit a correction
7. Verify data saved to database

---

## CONSTRAINTS

- Must work on cPanel hosting (PHP only, no Python/Docker)
- Use existing authentication system
- Match existing Bootstrap 5 dark theme
- Keep code modular and maintainable
- Follow existing code patterns from the project

---

## START NOW

Begin implementation by first examining the current project structure, then create the database migration, then the backend files, and finally the frontend. Test each component before moving to the next.
