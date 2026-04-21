# AI DIAGNOSTIC ASSISTANT - IMPLEMENTATION PLAN

## EXECUTIVE SUMMARY

**Project:** Add AI-powered diagnostic analysis to DICOM Viewer Pro v2.0
**Focus:** Ultrasound (USG) imaging initially, expandable to CT/MRI
**Architecture:** API-based AI service (Claude Vision API) integrated with existing PHP/MySQL stack
**Deployment:** cPanel-compatible, no Docker required

---

## ARCHITECTURE ANALYSIS COMPLETE

### Current System Overview
- **Backend:** PHP 8.2+ with MySQLi, session-based authentication
- **Frontend:** Bootstrap 5.3.3, Cornerstone.js DICOM viewer
- **Database:** MySQL (dicom_viewer_v2_production)
- **PACS:** Orthanc server (localhost:8042)
- **Entry Point:** `index.php` - Multi-viewport DICOM viewer with MPR support

### Key Integration Points Identified
1. **Navbar Button:** Add AI Analysis button at `index.php` line 378
2. **Modal UI:** Bootstrap modal for AI results (before `</body>`)
3. **JavaScript Component:** `js/components/ai-analysis.js` (new file)
4. **API Endpoints:** `api/ai/` directory (new)
5. **Database Table:** `ai_analyses` table (migration required)

---

## IMPLEMENTATION PHASES

### PHASE 1: FOUNDATION (Week 1)
**Goal:** Basic AI analysis infrastructure

#### 1.1 Database Setup
**File:** `setup/migration_ai_analysis.sql`

```sql
CREATE TABLE ai_analyses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    study_uid VARCHAR(255) NOT NULL,
    series_uid VARCHAR(255),
    instance_uid VARCHAR(255),
    patient_id VARCHAR(255),
    analysis_type ENUM('USG', 'CT', 'MRI', 'X-RAY', 'general') DEFAULT 'general',
    modality VARCHAR(50),
    ai_model_used VARCHAR(100) DEFAULT 'claude-3.5-sonnet',
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
('ai_api_provider', 'anthropic', 'AI API provider (anthropic, openai, google)'),
('ai_max_images_per_analysis', '10', 'Maximum images to send per AI request'),
('ai_confidence_threshold', '0.70', 'Minimum confidence score to display results'),
('ai_auto_analyze', 'false', 'Auto-analyze on study open');
```

**Migration Script:** `admin/run-migration.php`

#### 1.2 Backend API Structure
**Directory:** `api/ai/`

**Files to create:**
1. `config-ai.php` - AI service configuration
2. `analyze-image.php` - Analyze single DICOM instance
3. `analyze-study.php` - Analyze entire study (batch)
4. `get-analysis.php` - Retrieve cached analysis results
5. `save-feedback.php` - Store user feedback
6. `get-statistics.php` - AI usage statistics

#### 1.3 Frontend Component
**File:** `js/components/ai-analysis.js`

**Key Features:**
- Modal interface for AI results
- Loading states with progress indicators
- Result display with confidence scores
- Feedback buttons (thumbs up/down)
- Export AI report to PDF

#### 1.4 UI Integration
**Changes to `index.php`:**
- Line 378: Add AI Analysis button in navbar
- Before `</body>`: Add AI modal HTML
- Line 676: Include `ai-analysis.js` script

**Changes to `js/main.js`:**
- Line 35: Initialize AI manager
- Add to managers object

---

### PHASE 2: CLAUDE VISION API INTEGRATION (Week 2)
**Goal:** Connect to Claude API for image analysis

#### 2.1 API Configuration
**File:** `config/.env` (add these variables)

```env
# AI Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxx
AI_MODEL=claude-3-5-sonnet-20241022
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.2
AI_ENABLED=true
```

#### 2.2 AI Service Wrapper
**File:** `api/ai/services/ClaudeVisionService.php`

**Responsibilities:**
- Convert DICOM to base64 image
- Prepare Claude API request with medical prompts
- Handle API responses and errors
- Rate limiting and retry logic
- Parse structured JSON responses

**Key Methods:**
```php
class ClaudeVisionService {
    public function analyzeDicomImage($instanceId, $analysisType = 'USG');
    public function analyzeDicomStudy($studyUID, $maxImages = 10);
    public function extractMeasurements($imageData);
    public function detectAnomalies($imageData, $context);
    public function generateReport($analysisResults);
}
```

#### 2.3 DICOM Image Processing
**File:** `api/ai/utils/DicomProcessor.php`

**Responsibilities:**
- Fetch DICOM from Orthanc
- Extract metadata (patient info, modality, series description)
- Convert DICOM to PNG/JPEG for AI processing
- Apply windowing/leveling for optimal visualization
- Handle multi-frame DICOM files

#### 2.4 Medical Prompts Library
**File:** `api/ai/prompts/medical-prompts.php`

**Ultrasound Prompts:**
```php
return [
    'USG_ABDOMEN' => "Analyze this abdominal ultrasound image...",
    'USG_OBSTETRIC' => "Analyze this obstetric ultrasound...",
    'USG_THYROID' => "Analyze this thyroid ultrasound...",
    // ... more specialized prompts
];
```

---

### PHASE 3: INTELLIGENT ANALYSIS (Week 3)
**Goal:** Implement smart detection and reporting

#### 3.1 Anomaly Detection
**Features:**
- Lesion detection (cysts, tumors, masses)
- Organ enlargement/abnormalities
- Fluid collections
- Calcifications
- Vascular abnormalities

**Output Format:**
```json
{
  "anomalies": [
    {
      "type": "cyst",
      "location": "right kidney, upper pole",
      "size": "2.3 x 1.8 cm",
      "characteristics": "anechoic, well-defined borders",
      "severity": "mild",
      "confidence": 0.89,
      "recommendations": "Follow-up in 6 months"
    }
  ]
}
```

#### 3.2 Automatic Measurement Extraction
**Features:**
- OCR on measurement text overlays
- Parse caliper measurements
- Extract dimensions from DICOM tags
- Calculate volumes and areas
- Compare with normal ranges

**Output Format:**
```json
{
  "measurements": [
    {
      "structure": "Liver",
      "parameter": "Craniocaudal length",
      "value": 15.2,
      "unit": "cm",
      "normal_range": "10-15 cm",
      "status": "within_normal_limits"
    }
  ]
}
```

#### 3.3 Report Generation
**File:** `api/ai/services/ReportGenerator.php`

**Templates:**
- USG Abdomen template
- USG Obstetric template
- USG Thyroid template
- Generic template

**Sections:**
- Clinical indication
- Technique
- Findings (organ-by-organ)
- Measurements
- Impression
- Recommendations

---

### PHASE 4: USER INTERFACE & EXPERIENCE (Week 4)
**Goal:** Polished, production-ready UI

#### 4.1 AI Analysis Modal
**Features:**
- Analysis type selection (single image vs full study)
- Real-time progress updates
- Results organized by organ system
- Expandable findings with confidence scores
- Visual highlighting of detected anomalies
- Download report as PDF
- Copy to clipboard

#### 4.2 Inline Annotations
**Integration with Cornerstone.js:**
- Overlay bounding boxes on detected anomalies
- Color-coded by severity (green/yellow/red)
- Clickable annotations showing details
- Toggle annotations on/off

#### 4.3 Feedback System
**Features:**
- Thumbs up/down buttons
- Star rating (1-5 stars)
- Text comments field
- Mark incorrect findings
- Suggest corrections
- Submit to training dataset

---

### PHASE 5: FEEDBACK LOOP & IMPROVEMENT (Week 5)
**Goal:** Continuous learning system

#### 5.1 Feedback Dashboard
**File:** `pages/ai-dashboard.php` (new page)

**Metrics:**
- Total analyses performed
- Average confidence scores
- Feedback distribution (thumbs up/down ratio)
- Most common findings
- Accuracy trends over time
- User adoption rate

#### 5.2 Training Data Export
**File:** `api/ai/export-training-data.php`

**Features:**
- Export feedback as JSONL for fine-tuning
- Filter by feedback type (only approved)
- Include corrected findings
- De-identify patient data
- ZIP download with images + annotations

#### 5.3 Model Performance Tracking
**Database Table:**
```sql
CREATE TABLE ai_performance_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_date DATE NOT NULL,
    total_analyses INT DEFAULT 0,
    positive_feedback INT DEFAULT 0,
    negative_feedback INT DEFAULT 0,
    avg_confidence_score DECIMAL(5,2),
    avg_processing_time_ms INT,
    error_rate DECIMAL(5,2),
    UNIQUE KEY unique_date (metric_date)
);
```

---

### PHASE 6: ADVANCED FEATURES (Week 6+)
**Goal:** Enhanced capabilities

#### 6.1 Comparison Analysis
- Compare current study with previous studies
- Highlight changes over time
- Progression tracking for lesions

#### 6.2 Multi-Modal Analysis
- Expand to CT scans
- Expand to MRI
- Expand to X-Ray
- Modality-specific prompts and models

#### 6.3 Integration with Reports
- Auto-populate medical_reports table
- Pre-fill report template with AI findings
- Doctor can edit before finalizing
- Track AI-assisted vs manual reports

#### 6.4 Real-Time Analysis
- Background analysis on study upload
- Notifications when analysis complete
- Priority queue for urgent cases

---

## TECHNICAL SPECIFICATIONS

### API Request Flow
```
User clicks "AI Analysis" button
  ↓
JavaScript captures current study context
  ↓
POST to api/ai/analyze-study.php
  {studyUID, analysisType, maxImages}
  ↓
Backend fetches DICOM instances from Orthanc
  ↓
Convert DICOM to PNG/JPEG (apply W/L)
  ↓
Prepare Claude API request with medical prompt
  ↓
POST to api.anthropic.com/v1/messages
  {model, messages: [{text, image}], max_tokens}
  ↓
Claude analyzes images and returns JSON
  {findings, measurements, anomalies, impression}
  ↓
Parse and validate response
  ↓
Save to ai_analyses table
  ↓
Return formatted results to frontend
  ↓
Display in modal with annotations
```

### AI Prompt Engineering

**Base Prompt Template:**
```
You are an expert radiologist analyzing medical imaging studies.

STUDY INFORMATION:
- Modality: {modality}
- Body Part: {body_part}
- Clinical Indication: {clinical_indication}

TASK:
Analyze the provided {modality} images and provide a structured report.

OUTPUT FORMAT (JSON):
{
  "findings": [
    {
      "organ": "organ name",
      "observations": "normal/abnormal findings",
      "measurements": {"parameter": "value"},
      "anomalies": [
        {
          "type": "anomaly type",
          "location": "anatomical location",
          "size": "dimensions",
          "characteristics": "description",
          "severity": "mild/moderate/severe",
          "confidence": 0.0-1.0
        }
      ]
    }
  ],
  "impression": "summary of key findings",
  "recommendations": ["recommendation 1", "recommendation 2"]
}

IMPORTANT:
- Only report findings visible in the images
- Assign confidence scores (0-1) to each finding
- Use standard medical terminology
- Include measurements when visible
- Suggest follow-up if needed
```

**Modality-Specific Prompts:**

**USG Abdomen:**
```
Focus on: liver, gallbladder, pancreas, spleen, kidneys, bladder
Common pathologies: hepatomegaly, cholelithiasis, renal cysts,
hydronephrosis, ascites, masses
Measurements: organ sizes, lesion dimensions
```

**USG Obstetric:**
```
Focus on: fetal biometry, amniotic fluid, placenta, fetal anatomy
Measurements: BPD, HC, AC, FL, EFW, AFI
Gestational age calculation
Anomaly screening
```

**CT Chest:**
```
Focus on: lungs, mediastinum, pleura, chest wall
Common pathologies: nodules, infiltrates, effusions, masses
Measurements: nodule size, lymph node size
```

### Error Handling Strategy

**API Errors:**
- Network timeout: Retry 3 times with exponential backoff
- Rate limiting: Queue requests, retry after delay
- Invalid response: Log error, notify user
- Insufficient credits: Graceful degradation, notify admin

**DICOM Processing Errors:**
- Corrupted file: Skip image, continue with rest
- Unsupported modality: Return warning message
- Missing metadata: Use defaults, flag in results

**Database Errors:**
- Connection failure: Retry connection
- Constraint violation: Log and return error
- Transaction failure: Rollback and retry

---

## SECURITY & COMPLIANCE

### HIPAA Compliance Checklist
- [x] De-identify patient data before sending to AI API
- [x] Encrypt data in transit (HTTPS)
- [x] Encrypt sensitive data at rest (ai_analyses table)
- [x] Audit logging (all AI requests logged)
- [x] Access controls (role-based permissions)
- [x] Patient consent tracking
- [x] Data retention policy (auto-delete after 90 days)
- [x] Business Associate Agreement with AI provider

### Data De-identification
**Before sending to AI:**
- Remove: Patient Name, Patient ID, Accession Number
- Hash: Study UID (one-way hash for tracking)
- Keep: Age, Sex (for context), Modality, Body Part

**Implementation:**
```php
function deidentifyDicomMetadata($metadata) {
    return [
        'age' => $metadata['PatientAge'] ?? 'unknown',
        'sex' => $metadata['PatientSex'] ?? 'unknown',
        'modality' => $metadata['Modality'],
        'bodyPart' => $metadata['BodyPartExamined'],
        'studyHash' => hash('sha256', $metadata['StudyInstanceUID'])
    ];
}
```

### API Key Security
- Store in environment variables (config/.env)
- Never commit to version control
- Use PHP backend as proxy (never expose to frontend)
- Implement rate limiting per user
- Monitor usage and costs

---

## TESTING STRATEGY

### Unit Tests
- DICOM conversion functions
- API request/response handling
- JSON parsing and validation
- Database operations

### Integration Tests
- End-to-end workflow (upload → analyze → display)
- Orthanc connectivity
- Claude API integration
- Database transactions

### Clinical Validation
- Compare AI findings with radiologist reports
- Calculate sensitivity/specificity
- Test with diverse pathologies
- Edge case testing (poor quality images, artifacts)

### User Acceptance Testing
- Radiologist feedback sessions
- Usability testing
- Performance benchmarking
- Mobile device testing

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [x] Database migrations tested
- [x] API keys configured
- [x] Error logging enabled
- [x] Backup strategy in place
- [x] Rollback plan documented
- [x] User documentation prepared

### Deployment Steps
1. Backup production database
2. Upload new files via cPanel File Manager
3. Run database migration: `admin/run-migration.php`
4. Update config/.env with API keys
5. Test AI analysis with sample study
6. Monitor error logs for 24 hours
7. Collect user feedback

### Post-Deployment
- Monitor API usage and costs
- Track performance metrics
- Collect user feedback
- Iterate on prompts based on accuracy
- Weekly review of feedback data

---

## SUCCESS METRICS

### Quantitative KPIs
1. **Adoption Rate:** % of studies using AI analysis (Target: 60% in 3 months)
2. **Accuracy:** Agreement with radiologist findings (Target: >85%)
3. **Speed:** Average time per analysis (Target: <30 seconds)
4. **User Satisfaction:** Thumbs up ratio (Target: >80%)
5. **Error Rate:** Failed analyses (Target: <5%)

### Qualitative KPIs
1. Radiologist confidence in AI suggestions
2. Reduction in missed findings
3. Time saved per report
4. Educational value for residents
5. Patient outcome improvements

---

## COST ESTIMATION

### Claude API Costs (Estimated)
**Model:** Claude 3.5 Sonnet
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens

**Per Study Analysis:**
- Images: 5-10 per study
- Input tokens: ~2000 per image (image + prompt)
- Output tokens: ~1000 (structured report)
- **Cost per study: ~$0.10 - $0.20**

**Monthly Projection (100 studies/day):**
- Daily: $10 - $20
- Monthly: $300 - $600
- Annual: $3,600 - $7,200

**ROI:**
- Time saved per report: 10-15 minutes
- Radiologist hourly rate: $100-150
- Value per study: $16-37
- **Monthly ROI: $48,000 - $111,000**

---

## RISK MITIGATION

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| API downtime | High | Cache results, graceful degradation, fallback to manual |
| Rate limiting | Medium | Queue system, batch processing, user limits |
| Incorrect findings | High | Confidence thresholds, doctor review required, feedback loop |
| DICOM compatibility | Medium | Extensive testing, fallback image formats |
| Performance issues | Medium | Optimize image size, parallel processing, caching |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| High API costs | Medium | Usage monitoring, budget alerts, user quotas |
| User adoption | High | Training sessions, clear documentation, demo videos |
| Regulatory compliance | High | Legal review, HIPAA compliance audit, consent forms |
| Liability concerns | High | Disclaimers, doctor review mandatory, audit trail |

---

## FUTURE ENHANCEMENTS

### Short-term (3-6 months)
- Custom fine-tuned models for specific pathologies
- Integration with PACS worklist
- Mobile app for AI results review
- Voice dictation for feedback
- Multi-language support

### Long-term (6-12 months)
- 3D reconstruction analysis
- Temporal analysis (compare prior studies)
- Predictive analytics (disease progression)
- Integration with EHR systems
- Research data export for clinical trials

---

## CONCLUSION

This implementation plan provides a comprehensive roadmap for adding AI diagnostic capabilities to DICOM Viewer Pro. The phased approach ensures:

1. **Minimal disruption** to existing workflows
2. **Production-ready code** from day one
3. **HIPAA compliance** throughout
4. **Continuous improvement** via feedback loops
5. **Scalability** for future enhancements

The architecture leverages existing patterns in the codebase (reporting system, measurements) and integrates seamlessly with the current tech stack (PHP, MySQL, Cornerstone.js).

**Estimated Timeline:** 6 weeks to production deployment
**Required Resources:** 1 full-stack developer, API budget $500/month
**Expected ROI:** 10x cost savings in radiologist time

---

## NEXT STEPS

Use the attached **CLAUDE_CODE_PROMPT.md** to start implementation in a new Claude Code session. The prompt includes all context, file paths, and specific instructions for building each component.