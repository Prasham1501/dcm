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
    model_used VARCHAR(50) DEFAULT 'gemini-2.0-flash',
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
'json') ON DUPLICATE KEY UPDATE name=name;
