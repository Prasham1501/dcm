# CLAUDE CODE IMPLEMENTATION PROMPT - AI DIAGNOSTIC ASSISTANT

**Copy this entire prompt and paste it into a new Claude Code chat to begin implementation.**

---

## PROJECT OVERVIEW

I need you to implement an AI-powered diagnostic assistant for my DICOM Viewer Pro medical imaging application. This is a production system used by radiologists to analyze ultrasound (USG), CT, MRI, and X-Ray studies.

**Project Location:** `C:\xampp\htdocs\papa\dicom_again\claude`

**What you need to build:**
1. AI Analysis button in the navbar that analyzes the currently viewed DICOM study
2. Backend API that sends DICOM images to Claude Vision API for analysis
3. Display AI-generated findings, measurements, and anomaly detection in a modal
4. Store results in database with feedback mechanism (thumbs up/down)
5. Generate structured medical reports from AI findings

---

## CURRENT ARCHITECTURE (CRITICAL - READ CAREFULLY)

### Tech Stack
- **Backend:** PHP 8.2+ with MySQLi (NOT PDO)
- **Frontend:** Bootstrap 5.3.3, Cornerstone.js for DICOM rendering
- **Database:** MySQL - `dicom_viewer_v2_production`
- **PACS Server:** Orthanc (localhost:8042)
- **Authentication:** PHP sessions (NO JWT)
- **Deployment:** cPanel hosting (no Docker)

### Key Files & Locations

**Main Entry Point:**
- `index.php` - DICOM viewer with multi-viewport layout
  - Line 378: Where to add AI Analysis button (navbar, after settings button)
  - Before `</body>`: Where to add AI modal HTML
  - Line 676: Where to include AI JavaScript

**Configuration:**
- `includes/config.php` - Database connection, helper functions
- `config/.env` - Environment variables (database, Orthanc credentials)
- `auth/session.php` - Session management and authentication

**JavaScript Structure:**
- `js/main.js` - Main application, initializes managers
  - Line 35: Where to add AI manager initialization
  - Namespace: `window.DICOM_VIEWER`
- `js/components/` - Feature components (reporting, notes, etc.)
- `js/managers/` - Manager classes (viewport, MPR, enhancement)

**API Structure:**
- `api/auth/` - Authentication endpoints
- `api/reports/` - Medical reports (REFERENCE PATTERN)
- `api/measurements/` - Measurements
- `api/notes/` - Clinical notes
- **NEW: `api/ai/`** - AI analysis endpoints (you'll create this)

**Database Schema:**
- Uses MySQLi prepared statements
- Existing tables: users, sessions, cached_patients, cached_studies, medical_reports, measurements
- Migration location: `setup/` directory
- Run migrations: `admin/run-migration.php`

### Existing Patterns to Follow

**IMPORTANT:** Study these existing implementations as templates:

1. **Reporting System** (BEST REFERENCE):
   - Component: `js/components/reporting-system.js`
   - API: `api/reports/create.php`, `api/reports/by-study.php`
   - Database: `medical_reports`, `report_versions` tables
   - Modal-based UI with Bootstrap 5
   - Follow this pattern for AI analysis

2. **Medical Notes:**
   - Component: `js/components/medical-notes.js`
   - API: `api/notes/create.php`
   - Database: `clinical_notes` table

3. **Measurements:**
   - API: `api/measurements/create.php`
   - Database: `measurements` table with JSON storage

### Data Flow

**How DICOM images are loaded:**
```
1. User opens study: index.php?studyUID=xxx
2. JavaScript: js/orthanc-autoload.js detects studyUID
3. API call: api/load_study_fast.php?studyUID=xxx
4. Backend queries Orthanc: /studies/{id}/series, /series/{id}/instances
5. Returns image list with metadata
6. Cornerstone.js renders images via: api/get_dicom_from_orthanc.php?instanceId=xxx
7. This proxy fetches: Orthanc /instances/{id}/file
```

**Current study context available in JavaScript:**
```javascript
// Get study context
const urlParams = new URLSearchParams(window.location.search);
const studyUID = urlParams.get('studyUID');
const orthancId = urlParams.get('study_id');

// Get current images
const state = window.DICOM_VIEWER.STATE;
const currentImages = state.currentSeriesImages; // Array of image objects

// Get active viewport
const viewport = window.DICOM_VIEWER.MANAGERS.viewportManager.activeViewport;
const enabledElement = cornerstone.getEnabledElement(viewport);
const currentImage = enabledElement.image;

// Extract DICOM metadata
const patientName = currentImage.data.string('x00100010');
const studyDescription = currentImage.data.string('x00081030');
```

---

## IMPLEMENTATION REQUIREMENTS

### PHASE 1: Database Setup

Create migration file: `setup/migration_ai_analysis.sql`

**Tables needed:**

1. **ai_analyses** - Store AI analysis results
```sql
CREATE TABLE ai_analyses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    study_uid VARCHAR(255) NOT NULL,
    series_uid VARCHAR(255),
    instance_uid VARCHAR(255),
    patient_id VARCHAR(255),
    analysis_type ENUM('USG', 'CT', 'MRI', 'X-RAY', 'general') DEFAULT 'general',
    modality VARCHAR(50),
    ai_model_used VARCHAR(100) DEFAULT 'claude-3-5-sonnet-20241022',
    analysis_results JSON NOT NULL,
    findings_summary TEXT,
    anomalies_detected JSON,
    measurements_extracted JSON,
    confidence_score DECIMAL(5,2),
    processing_time_ms INT,
    image_count INT DEFAULT 1,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_by INT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_study (study_uid),
    INDEX idx_instance (instance_uid),
    INDEX idx_patient (patient_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

2. **ai_feedback** - User feedback for improving model
```sql
CREATE TABLE ai_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    feedback_type ENUM('thumbs_up', 'thumbs_down', 'corrected') DEFAULT 'thumbs_up',
    accuracy_rating TINYINT CHECK (accuracy_rating BETWEEN 1 AND 5),
    comments TEXT,
    corrections JSON,
    is_training_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_analysis (analysis_id),
    INDEX idx_feedback_type (feedback_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

3. **ai_configuration** - AI settings
```sql
CREATE TABLE ai_configuration (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    updated_by INT UNSIGNED,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ai_configuration (config_key, config_value, description) VALUES
('ai_enabled', 'true', 'Enable/disable AI analysis feature'),
('ai_model', 'claude-3-5-sonnet-20241022', 'AI model version to use'),
('ai_api_provider', 'anthropic', 'AI API provider'),
('ai_max_images_per_analysis', '10', 'Maximum images per request'),
('ai_confidence_threshold', '0.70', 'Minimum confidence to display results'),
('ai_auto_analyze', 'false', 'Auto-analyze on study open');
```

**Add to config/.env:**
```env
ANTHROPIC_API_KEY=your_api_key_here
AI_MODEL=claude-3-5-sonnet-20241022
AI_MAX_TOKENS=4096
AI_ENABLED=true
```

---

### PHASE 2: Backend API Implementation

Create directory: `api/ai/`

**File 1: `api/ai/analyze-study.php`** - Main AI analysis endpoint

**Requirements:**
- Accept POST request with `{studyUID, analysisType, maxImages}`
- Authenticate user via session
- Fetch DICOM instances from Orthanc
- Convert DICOM to PNG/JPEG (apply window/level for best visualization)
- Send to Claude Vision API with medical prompt
- Parse JSON response
- Save to `ai_analyses` table
- Return formatted results

**Critical functions needed:**
```php
function fetchDicomFromOrthanc($instanceId) {
    // GET from Orthanc: /instances/{instanceId}/file
    // Return binary DICOM data
}

function convertDicomToImage($dicomBinary) {
    // Use ImageMagick or PHP-DICOM library
    // Apply window/level settings
    // Return base64 PNG
}

function callClaudeVisionAPI($images, $prompt) {
    // POST to https://api.anthropic.com/v1/messages
    // Headers: x-api-key, anthropic-version: 2023-06-01
    // Body: {model, max_tokens, messages: [{role: user, content: [{type: image, source: {type: base64, media_type, data}}, {type: text, text: prompt}]}]}
    // Return parsed JSON response
}

function saveToDB($studyUID, $results, $userId) {
    // INSERT into ai_analyses
    // Use mysqli prepared statement
}
```

**Medical Prompt Template (USG Abdomen):**
```
You are an expert radiologist analyzing an abdominal ultrasound study.

CLINICAL CONTEXT:
- Modality: Ultrasound (USG)
- Region: Abdomen
- Images provided: {count} images from study

TASK:
Analyze the ultrasound images and provide a structured diagnostic report.

ORGANS TO EVALUATE:
- Liver: size, echogenicity, focal lesions, portal vein
- Gallbladder: wall thickness, stones, polyps
- Pancreas: size, echogenicity, duct dilation
- Spleen: size, focal lesions
- Kidneys: size, echogenicity, hydronephrosis, stones, masses
- Bladder: wall thickness, masses
- Abdominal cavity: ascites, masses

OUTPUT FORMAT (valid JSON only):
{
  "findings": [
    {
      "organ": "Liver",
      "observations": "Normal size and echogenicity",
      "measurements": {
        "length": "14.5 cm",
        "width": "10.2 cm"
      },
      "anomalies": []
    },
    {
      "organ": "Right Kidney",
      "observations": "Simple cyst in upper pole",
      "measurements": {
        "length": "10.8 cm",
        "cyst_size": "2.3 x 1.8 cm"
      },
      "anomalies": [
        {
          "type": "Simple renal cyst",
          "location": "Right kidney, upper pole",
          "size": "2.3 x 1.8 cm",
          "characteristics": "Anechoic, well-defined, posterior acoustic enhancement",
          "severity": "mild",
          "confidence": 0.92,
          "clinical_significance": "Benign, no follow-up needed"
        }
      ]
    }
  ],
  "summary": "Abdominal ultrasound shows normal liver, gallbladder, spleen, pancreas, and left kidney. Simple cyst in right kidney upper pole measuring 2.3 x 1.8 cm, consistent with benign simple cyst.",
  "impression": [
    "Simple cyst in right kidney upper pole (2.3 x 1.8 cm)",
    "Otherwise normal abdominal ultrasound"
  ],
  "recommendations": [
    "No follow-up needed for renal cyst",
    "Correlate with clinical findings"
  ],
  "overall_confidence": 0.88
}

IMPORTANT GUIDELINES:
- Only report findings visible in the provided images
- Use standard medical terminology
- Assign confidence scores (0.0-1.0) to anomalies
- Include measurements when visible or calculable
- Classify severity as: mild, moderate, severe
- Be conservative with diagnosis - suggest clinical correlation when uncertain
- If image quality is poor, mention it in findings
```

**File 2: `api/ai/get-analysis.php`** - Retrieve cached results

```php
// GET /api/ai/get-analysis.php?studyUID=xxx
// Query ai_analyses table
// Return most recent analysis for study
```

**File 3: `api/ai/save-feedback.php`** - User feedback endpoint

```php
// POST /api/ai/save-feedback.php
// Body: {analysisId, feedbackType, rating, comments}
// Insert into ai_feedback table
// Update accuracy metrics
```

**File 4: `api/ai/config.php`** - Shared configuration

```php
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

// AI API configuration
define('AI_API_URL', 'https://api.anthropic.com/v1/messages');
define('AI_API_KEY', $_ENV['ANTHROPIC_API_KEY'] ?? '');
define('AI_MODEL', $_ENV['AI_MODEL'] ?? 'claude-3-5-sonnet-20241022');
define('AI_MAX_TOKENS', (int)($_ENV['AI_MAX_TOKENS'] ?? 4096));

// Orthanc configuration
define('ORTHANC_URL', $_ENV['ORTHANC_URL']);
define('ORTHANC_USER', $_ENV['ORTHANC_USERNAME']);
define('ORTHANC_PASS', $_ENV['ORTHANC_PASSWORD']);
```

---

### PHASE 3: Frontend Implementation

**File 1: `js/components/ai-analysis.js`** - Main AI component

**Structure:**
```javascript
(function() {
    'use strict';

    window.DICOM_VIEWER = window.DICOM_VIEWER || {};

    class AIAnalysis {
        constructor() {
            this.modal = null;
            this.currentAnalysis = null;
            this.basePath = window.location.pathname.split('/').slice(0, -1).join('/');
        }

        initialize() {
            this.createModal();
            this.attachEventListeners();
        }

        attachEventListeners() {
            // AI button in navbar
            const aiBtn = document.getElementById('aiAnalysisBtn');
            if (aiBtn) {
                aiBtn.addEventListener('click', () => this.showAnalysisModal());
            }
        }

        showAnalysisModal() {
            // Get current study context
            const context = this.getStudyContext();

            // Check if analysis already exists
            this.checkExistingAnalysis(context.studyUID);

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('aiAnalysisModal'));
            modal.show();
        }

        getStudyContext() {
            const urlParams = new URLSearchParams(window.location.search);
            const state = window.DICOM_VIEWER.STATE || {};

            return {
                studyUID: urlParams.get('studyUID') || state.currentStudyUID,
                orthancId: urlParams.get('study_id'),
                currentImageIndex: state.currentImageIndex || 0,
                totalImages: state.currentSeriesImages?.length || 0,
                images: state.currentSeriesImages || []
            };
        }

        async checkExistingAnalysis(studyUID) {
            try {
                const response = await fetch(`${this.basePath}/api/ai/get-analysis.php?studyUID=${studyUID}`);
                const data = await response.json();

                if (data.success && data.analysis) {
                    this.displayResults(data.analysis);
                    document.getElementById('aiAnalyzeBtn').textContent = 'Re-analyze Study';
                } else {
                    this.clearResults();
                    document.getElementById('aiAnalyzeBtn').textContent = 'Analyze Study';
                }
            } catch (error) {
                console.error('Error checking existing analysis:', error);
            }
        }

        async analyzeStudy() {
            const context = this.getStudyContext();
            const analysisType = document.getElementById('aiAnalysisType')?.value || 'general';
            const maxImages = 10;

            // Show loading state
            this.showLoading();

            try {
                const response = await fetch(`${this.basePath}/api/ai/analyze-study.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studyUID: context.studyUID,
                        orthancId: context.orthancId,
                        analysisType: analysisType,
                        maxImages: maxImages
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.currentAnalysis = data.analysis;
                    this.displayResults(data.analysis);
                } else {
                    this.showError(data.message || 'Analysis failed');
                }
            } catch (error) {
                console.error('AI analysis error:', error);
                this.showError('Network error. Please try again.');
            }
        }

        displayResults(analysis) {
            const resultsDiv = document.getElementById('aiAnalysisResults');
            const results = JSON.parse(analysis.analysis_results);

            let html = `
                <div class="ai-results">
                    <div class="alert alert-info">
                        <strong>Analysis completed:</strong> ${new Date(analysis.created_at).toLocaleString()}
                        <br><strong>Model:</strong> ${analysis.ai_model_used}
                        <br><strong>Confidence:</strong> ${(analysis.confidence_score * 100).toFixed(1)}%
                        <br><strong>Processing time:</strong> ${(analysis.processing_time_ms / 1000).toFixed(2)}s
                    </div>
            `;

            // Summary
            if (results.summary) {
                html += `
                    <div class="card bg-dark border-primary mb-3">
                        <div class="card-header bg-primary text-white">
                            <h6 class="mb-0">Summary</h6>
                        </div>
                        <div class="card-body">
                            <p>${results.summary}</p>
                        </div>
                    </div>
                `;
            }

            // Findings
            if (results.findings && results.findings.length > 0) {
                html += `<h6 class="mt-3 mb-2">Detailed Findings:</h6>`;

                results.findings.forEach(finding => {
                    html += `
                        <div class="card bg-dark border-secondary mb-2">
                            <div class="card-header">
                                <strong>${finding.organ}</strong>
                            </div>
                            <div class="card-body">
                                <p><strong>Observations:</strong> ${finding.observations}</p>
                    `;

                    // Measurements
                    if (finding.measurements && Object.keys(finding.measurements).length > 0) {
                        html += `<p><strong>Measurements:</strong></p><ul class="mb-2">`;
                        for (const [key, value] of Object.entries(finding.measurements)) {
                            html += `<li>${key}: ${value}</li>`;
                        }
                        html += `</ul>`;
                    }

                    // Anomalies
                    if (finding.anomalies && finding.anomalies.length > 0) {
                        html += `<div class="alert alert-warning mb-0">`;
                        html += `<strong>Anomalies Detected:</strong><ul class="mb-0 mt-2">`;
                        finding.anomalies.forEach(anomaly => {
                            html += `
                                <li>
                                    <strong>${anomaly.type}</strong> - ${anomaly.location}
                                    <br>Size: ${anomaly.size}
                                    <br>Characteristics: ${anomaly.characteristics}
                                    <br>Severity: <span class="badge bg-${this.getSeverityColor(anomaly.severity)}">${anomaly.severity}</span>
                                    Confidence: ${(anomaly.confidence * 100).toFixed(1)}%
                                    ${anomaly.clinical_significance ? '<br>Significance: ' + anomaly.clinical_significance : ''}
                                </li>
                            `;
                        });
                        html += `</ul></div>`;
                    }

                    html += `</div></div>`;
                });
            }

            // Impression
            if (results.impression && results.impression.length > 0) {
                html += `
                    <div class="card bg-dark border-info mb-3">
                        <div class="card-header bg-info text-white">
                            <h6 class="mb-0">Impression</h6>
                        </div>
                        <div class="card-body">
                            <ol class="mb-0">`;
                results.impression.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += `</ol></div></div>`;
            }

            // Recommendations
            if (results.recommendations && results.recommendations.length > 0) {
                html += `
                    <div class="card bg-dark border-success mb-3">
                        <div class="card-header bg-success text-white">
                            <h6 class="mb-0">Recommendations</h6>
                        </div>
                        <div class="card-body">
                            <ul class="mb-0">`;
                results.recommendations.forEach(rec => {
                    html += `<li>${rec}</li>`;
                });
                html += `</ul></div></div>`;
            }

            // Feedback section
            html += `
                <div class="ai-feedback mt-4">
                    <h6>Was this analysis helpful?</h6>
                    <div class="btn-group" role="group">
                        <button type="button" class="btn btn-outline-success" onclick="window.DICOM_VIEWER.MANAGERS.aiAnalysis.submitFeedback('thumbs_up')">
                            <i class="bi bi-hand-thumbs-up"></i> Helpful
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="window.DICOM_VIEWER.MANAGERS.aiAnalysis.submitFeedback('thumbs_down')">
                            <i class="bi bi-hand-thumbs-down"></i> Not Helpful
                        </button>
                    </div>
                    <div class="mt-2">
                        <textarea class="form-control" id="aiFeedbackComments" placeholder="Optional comments..." rows="2"></textarea>
                    </div>
                </div>
            `;

            html += `</div>`;
            resultsDiv.innerHTML = html;
        }

        getSeverityColor(severity) {
            const colors = {
                'mild': 'success',
                'moderate': 'warning',
                'severe': 'danger'
            };
            return colors[severity] || 'secondary';
        }

        async submitFeedback(feedbackType) {
            if (!this.currentAnalysis) return;

            const comments = document.getElementById('aiFeedbackComments')?.value || '';

            try {
                const response = await fetch(`${this.basePath}/api/ai/save-feedback.php`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        analysisId: this.currentAnalysis.id,
                        feedbackType: feedbackType,
                        comments: comments
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert('Thank you for your feedback!');
                    document.querySelector('.ai-feedback').innerHTML = '<p class="text-success">Feedback submitted. Thank you!</p>';
                }
            } catch (error) {
                console.error('Error submitting feedback:', error);
            }
        }

        showLoading() {
            const resultsDiv = document.getElementById('aiAnalysisResults');
            resultsDiv.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Analyzing...</span>
                    </div>
                    <p class="mt-3">AI is analyzing your study...</p>
                    <p class="text-muted">This may take 30-60 seconds</p>
                </div>
            `;
        }

        showError(message) {
            const resultsDiv = document.getElementById('aiAnalysisResults');
            resultsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Error:</strong> ${message}
                </div>
            `;
        }

        clearResults() {
            const resultsDiv = document.getElementById('aiAnalysisResults');
            resultsDiv.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-cpu" style="font-size: 3rem;"></i>
                    <p>Click "Analyze Study" to start AI analysis</p>
                </div>
            `;
        }

        createModal() {
            // Modal will be added to index.php
        }
    }

    window.DICOM_VIEWER.AIAnalysis = AIAnalysis;
})();
```

**File 2: Add AI button to `index.php`** (line 378, after settings button)

```html
<!-- AI Analysis Button -->
<button class="btn btn-primary" id="aiAnalysisBtn" title="AI Analysis">
    <i class="bi bi-cpu"></i> AI Analysis
</button>
```

**File 3: Add AI modal to `index.php`** (before closing `</body>` tag)

```html
<!-- AI Analysis Modal -->
<div class="modal fade" id="aiAnalysisModal" tabindex="-1">
    <div class="modal-dialog modal-xl">
        <div class="modal-content bg-dark text-light">
            <div class="modal-header border-primary">
                <h5 class="modal-title">
                    <i class="bi bi-cpu me-2"></i>AI Diagnostic Analysis
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label">Analysis Type</label>
                        <select class="form-select bg-dark text-light" id="aiAnalysisType">
                            <option value="USG">Ultrasound (USG)</option>
                            <option value="CT">CT Scan</option>
                            <option value="MRI">MRI</option>
                            <option value="X-RAY">X-Ray</option>
                            <option value="general">General Analysis</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">&nbsp;</label>
                        <button class="btn btn-primary w-100" id="aiAnalyzeBtn" onclick="window.DICOM_VIEWER.MANAGERS.aiAnalysis.analyzeStudy()">
                            <i class="bi bi-play-circle"></i> Analyze Study
                        </button>
                    </div>
                </div>
                <hr class="border-secondary">
                <div id="aiAnalysisResults">
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-cpu" style="font-size: 3rem;"></i>
                        <p>Click "Analyze Study" to start AI analysis</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="button" class="btn btn-outline-primary" onclick="window.DICOM_VIEWER.MANAGERS.aiAnalysis.exportReport()">
                    <i class="bi bi-download"></i> Export Report
                </button>
            </div>
        </div>
    </div>
</div>
```

**File 4: Include script in `index.php`** (line 676, after other components)

```html
<script src="<?= BASE_PATH ?>/js/components/ai-analysis.js?v=<?= time() ?>"></script>
```

**File 5: Initialize AI manager in `js/main.js`** (line 35)

```javascript
window.DICOM_VIEWER.MANAGERS.aiAnalysis = new window.DICOM_VIEWER.AIAnalysis();
```

**And later in initialization (after DOMContentLoaded):**

```javascript
// Initialize AI Analysis
if (window.DICOM_VIEWER.MANAGERS.aiAnalysis) {
    window.DICOM_VIEWER.MANAGERS.aiAnalysis.initialize();
}
```

---

## CRITICAL IMPLEMENTATION NOTES

### Database Connection Pattern (MySQLi)
```php
// ALWAYS use this pattern
require_once __DIR__ . '/../../includes/config.php';
$mysqli = getDbConnection();

// Prepared statements
$stmt = $mysqli->prepare("INSERT INTO ai_analyses (study_uid, analysis_results) VALUES (?, ?)");
$stmt->bind_param('ss', $studyUID, $resultsJson);
$stmt->execute();
$insertId = $stmt->insert_id;
$stmt->close();
```

### Session Authentication Pattern
```php
require_once __DIR__ . '/../../auth/session.php';
requireLogin(); // Will redirect if not authenticated

$userId = $_SESSION['user_id'];
$userRole = $_SESSION['role'];
```

### JSON Response Pattern
```php
function sendJsonResponse($success, $data = [], $message = '', $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message
    ]);
    exit;
}

// Usage
sendJsonResponse(true, ['analysis' => $analysisData], 'Analysis completed');
sendJsonResponse(false, [], 'Analysis failed', 500);
```

### DICOM Image Conversion (if ImageMagick available)
```php
function convertDicomToPNG($dicomPath) {
    $pngPath = sys_get_temp_dir() . '/' . uniqid('dicom_') . '.png';

    // Using ImageMagick via exec
    exec("magick convert \"{$dicomPath}\" -auto-level \"{$pngPath}\"", $output, $returnCode);

    if ($returnCode !== 0 || !file_exists($pngPath)) {
        throw new Exception('DICOM conversion failed');
    }

    $base64 = base64_encode(file_get_contents($pngPath));
    unlink($pngPath); // Clean up

    return $base64;
}
```

### Claude API Call Pattern
```php
function callClaudeAPI($images, $prompt) {
    $apiKey = $_ENV['ANTHROPIC_API_KEY'];
    $model = $_ENV['AI_MODEL'] ?? 'claude-3-5-sonnet-20241022';

    $content = [];

    // Add images
    foreach ($images as $imageBase64) {
        $content[] = [
            'type' => 'image',
            'source' => [
                'type' => 'base64',
                'media_type' => 'image/png',
                'data' => $imageBase64
            ]
        ];
    }

    // Add text prompt
    $content[] = [
        'type' => 'text',
        'text' => $prompt
    ];

    $payload = [
        'model' => $model,
        'max_tokens' => 4096,
        'messages' => [
            [
                'role' => 'user',
                'content' => $content
            ]
        ]
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Claude API error: HTTP $httpCode");
    }

    $data = json_decode($response, true);

    if (!isset($data['content'][0]['text'])) {
        throw new Exception('Invalid API response');
    }

    // Extract JSON from response text
    $text = $data['content'][0]['text'];

    // Try to extract JSON if wrapped in markdown code blocks
    if (preg_match('/```json\s*(.*?)\s*```/s', $text, $matches)) {
        $jsonText = $matches[1];
    } else {
        $jsonText = $text;
    }

    $analysisResults = json_decode($jsonText, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Failed to parse AI response as JSON');
    }

    return $analysisResults;
}
```

---

## TESTING CHECKLIST

After implementation, test:

- [ ] Migration runs successfully (check with phpMyAdmin)
- [ ] AI button appears in navbar
- [ ] Clicking AI button opens modal
- [ ] Modal shows current study context
- [ ] "Analyze Study" button sends request
- [ ] Backend fetches DICOM from Orthanc
- [ ] Images converted to PNG successfully
- [ ] Claude API call works (check API key)
- [ ] Response parsed correctly
- [ ] Results saved to database
- [ ] Results display in modal with formatting
- [ ] Anomalies highlighted with severity colors
- [ ] Feedback buttons work
- [ ] Feedback saved to database
- [ ] Re-opening modal shows cached results
- [ ] Error handling works (invalid study, API failure)

---

## SECURITY REQUIREMENTS

1. **API Key Protection:**
   - Never expose API key in client-side code
   - Use PHP backend as proxy
   - Store in .env file (outside web root)

2. **Input Validation:**
   - Validate studyUID format
   - Sanitize all user inputs
   - Use prepared statements (prevent SQL injection)

3. **Authentication:**
   - Require login for all AI endpoints
   - Check user role permissions
   - Log all AI analysis requests in audit_logs

4. **Rate Limiting:**
   - Limit analyses per user (e.g., 50/day)
   - Prevent API abuse
   - Monitor costs

5. **Data Privacy:**
   - De-identify patient data before sending to API
   - Don't send patient names or IDs
   - Include disclaimer in UI

---

## SUCCESS CRITERIA

Implementation is complete when:

1. Doctor can click "AI Analysis" button in viewer
2. System analyzes current study and displays:
   - Organ-by-organ findings
   - Detected anomalies with confidence scores
   - Measurements extracted from images
   - Clinical impressions and recommendations
3. Results are saved to database
4. Doctor can provide feedback (thumbs up/down)
5. Cached results load instantly on re-open
6. Error handling works gracefully
7. No console errors, no PHP warnings
8. Mobile-responsive and matches existing dark theme

---

## IMPORTANT: FOLLOW EXISTING CODE STYLE

- Use existing naming conventions (snake_case for PHP, camelCase for JS)
- Match existing file organization patterns
- Use same error handling approach as existing API endpoints
- Follow dark theme color scheme
- Use Bootstrap 5 classes consistently
- Include proper comments and error messages
- Test with existing users from database (admin/radiologist/technician)

---

## START IMPLEMENTATION

Please implement this AI diagnostic assistant feature following all specifications above. Start with:

1. Create database migration file
2. Create API directory and endpoints
3. Create JavaScript component
4. Update index.php with button and modal
5. Initialize in main.js
6. Test end-to-end workflow

Ask me for clarification if anything is unclear. Good luck!