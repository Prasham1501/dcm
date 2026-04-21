<?php
/**
 * AI Image Analysis Endpoint
 * POST /ai/analyze.php
 * 
 * Accepts DICOM images and returns AI-powered analysis using Gemini API
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Disable error display for API endpoint to prevent invalid JSON
ini_set('display_errors', 0);
error_reporting(E_ALL); // Keep logging errors

// Register shutdown function to handle fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
        // Clear any previous output
        if (ob_get_length()) ob_clean();
        
        if (!headers_sent()) {
            header('Content-Type: application/json');
            http_response_code(500);
        }
        
        echo json_encode([
            'success' => false,
            'error' => 'Fatal Error: ' . $error['message']
        ]);
    }
});

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth/session.php';

// Ensure JSON header is sent
if (!headers_sent()) {
    header('Content-Type: application/json');
}

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
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }
    
    // Validate required fields - now supporting multiple images
    if (empty($input['image_data']) && empty($input['instance_id']) && empty($input['images'])) {
        sendErrorResponse('Either image_data, instance_id, or images array is required', 400);
    }
    
    $studyUid = sanitizeInput($input['study_uid'] ?? '');
    $seriesUid = sanitizeInput($input['series_uid'] ?? '');
    $instanceUid = sanitizeInput($input['instance_uid'] ?? '');
    $patientId = sanitizeInput($input['patient_id'] ?? '');
    $patientName = sanitizeInput($input['patient_name'] ?? '');
    $analysisType = sanitizeInput($input['analysis_type'] ?? 'USG');
    $bodyRegion = sanitizeInput($input['body_region'] ?? 'general');
    $clinicalHistory = sanitizeInput($input['clinical_history'] ?? '');
    
    // Get image data - supporting both single and multiple images
    $images = [];
    
    if (!empty($input['images']) && is_array($input['images'])) {
        // Multi-image batch analysis
        foreach ($input['images'] as $idx => $imgData) {
            $processedImage = processImageInput($imgData, $idx + 1);
            if ($processedImage) {
                $images[] = $processedImage;
            }
        }
    } else {
        // Single image (backward compatibility)
        $imageData = null;
        $mediaType = 'image/jpeg';
        
        if (!empty($input['instance_id'])) {
            $imageResult = fetchAndConvertDicomImage($input['instance_id']);
            $imageData = $imageResult['data'];
            $mediaType = $imageResult['media_type'];
        } else {
            $imageData = $input['image_data'];
            if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
                $imageData = substr($imageData, strpos($imageData, ',') + 1);
                $mediaType = 'image/' . strtolower($type[1]);
            }
        }
        
        if (empty($imageData)) {
            sendErrorResponse('Failed to obtain image data', 400);
        }
        
        $images[] = [
            'data' => $imageData,
            'media_type' => $mediaType,
            'frame_number' => 1
        ];
    }
    
    if (empty($images)) {
        sendErrorResponse('No valid images to analyze', 400);
    }
    
    // Get appropriate prompt template
    $promptTemplate = getPromptTemplate($analysisType, $bodyRegion);
    
    // Build the analysis request with all images
    $analysisResult = performGeminiAnalysis(
        $images,
        $promptTemplate,
        [
            'patient_context' => $patientName ? "Patient: $patientName" : '',
            'clinical_history' => $clinicalHistory,
            'body_region' => $bodyRegion,
            'num_images' => count($images)
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
    
    $modelUsed = GEMINI_MODEL;
    $modelVersion = '2025-06'; // Based on model description
    $findingsJson = json_encode($parsedResult['findings'] ?? []);
    $measurementsJson = json_encode($parsedResult['measurements'] ?? []);
    $anomaliesJson = json_encode($parsedResult['anomalies'] ?? []);
    $generatedReport = generateTextReport($parsedResult);
    $overallConfidence = $parsedResult['confidence_overall'] ?? 0.75;
    $qualityScore = $parsedResult['image_quality']['score'] ?? 0.8;
    
    // Gemini usage info (if available)
    $tokensUsed = 0;
    if (isset($analysisResult['usageMetadata'])) {
        $tokensUsed = ($analysisResult['usageMetadata']['promptTokenCount'] ?? 0) + ($analysisResult['usageMetadata']['candidatesTokenCount'] ?? 0);
    }
    
    $apiCost = 0; // Gemini Flash is often free or very cheap, set to 0 for now
    
    $stmt->bind_param(
        "sssssssssssssddiidi",
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
        'extracted_text' => $parsedResult['extracted_text'] ?? [],
        'device_metadata' => $parsedResult['device_metadata'] ?? null,
        'patient_metrics' => $parsedResult['patient_metrics'] ?? null,
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
 * Perform Gemini API analysis with multi-image support
 */
function performGeminiAnalysis($images, $promptTemplate, $context) {
    $systemPrompt = $promptTemplate['system_prompt'];
    $userPrompt = $promptTemplate['user_prompt_template'];
    
    // Replace placeholders
    foreach ($context as $key => $value) {
        $userPrompt = str_replace('{{' . $key . '}}', $value, $userPrompt);
    }
    
    // Build multi-image prompt
    $numImages = $context['num_images'];
    $fullPrompt = $systemPrompt . "\n\n" . $userPrompt;
    
    if ($numImages > 1) {
        $fullPrompt .= "\n\nYou will analyze {$numImages} images from the same study. ";
        $fullPrompt .= "For EACH image, extract ALL visible text and provide findings. ";
        $fullPrompt .= "Then provide a consolidated analysis across all images.";
    }
    
    // Build interleaved content with images
    $parts = [];
    $parts[] = ['text' => $fullPrompt];
    
    foreach ($images as $idx => $img) {
        $frameNum = $img['frame_number'];
        
        // Add image
        $parts[] = [
            'inline_data' => [
                'mime_type' => $img['media_type'],
                'data' => $img['data']
            ]
        ];
        
        // Add per-image instruction
        $parts[] = [
            'text' => "IMAGE {$frameNum}: Extract ALL visible text including: " .
                     "hospital name, device model, patient info, timestamps, " .
                     "ALL measurements (FL, GA, EDD, AC, EFW, SD, etc.), " .
                     "technical settings (AP, MI, TIS, F, D, G, FR, DR), " .
                     "and any annotations (Spine, organ labels). " .
                     "Also analyze anatomical structures and clinical findings."
        ];
    }

    $payload = [
        'contents' => [
            ['parts' => $parts]
        ],
        'generationConfig' => [
            'temperature' => (float)$promptTemplate['temperature'],
            'maxOutputTokens' => 8000, // Increased for multi-image
            'responseMimeType' => 'application/json'
        ]
    ];
    
    $url = GEMINI_API_URL . '?key=' . GEMINI_API_KEY;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, min(120, AI_ANALYSIS_TIMEOUT * $numImages)); // Scale timeout
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    // Debug logging
    file_put_contents(__DIR__ . '/ai_debug.log', "Multi-image HTTP $httpCode\nNum Images: $numImages\nResponse: " . substr($response, 0, 1000) . "...\n\n", FILE_APPEND);
    
    if ($httpCode !== 200 || !$response) {
        throw new Exception("Gemini API error: HTTP $httpCode - $error");
    }
    
    return json_decode($response, true);
}

/**
 * Parse AI response and extract structured data
 */
function parseAIResponse($response) {
    if (empty($response['candidates'][0]['content']['parts'][0]['text'])) {
        throw new Exception('Empty response from AI');
    }
    
    $text = $response['candidates'][0]['content']['parts'][0]['text'];
    
    // Clean up markdown code blocks if present
    $text = preg_replace('/^```json\s*|\s*```$/', '', trim($text));
    
    $jsonData = json_decode($text, true);
    if ($jsonData !== null) {
        // Normalize findings
        if (isset($jsonData['findings']) && is_array($jsonData['findings'])) {
            foreach ($jsonData['findings'] as &$finding) {
                if (is_string($finding)) {
                    $finding = ['description' => $finding, 'confidence' => 0.0];
                } elseif (is_array($finding)) {
                    // Map other common keys to description if missing
                    if (empty($finding['description'])) {
                        if (!empty($finding['text'])) $finding['description'] = $finding['text'];
                        elseif (!empty($finding['finding'])) $finding['description'] = $finding['finding'];
                        elseif (!empty($finding['content'])) $finding['description'] = $finding['content'];
                        elseif (!empty($finding['summary'])) $finding['description'] = $finding['summary'];
                        else $finding['description'] = 'No description provided';
                    }
                }
            }
        }
        
        // Normalize measurements
        if (isset($jsonData['measurements']) && is_array($jsonData['measurements'])) {
            foreach ($jsonData['measurements'] as &$measurement) {
                if (is_string($measurement)) {
                    $measurement = ['structure' => 'Unknown', 'value' => $measurement, 'unit' => '', 'is_normal' => null];
                }
            }
        }

        return $jsonData;
    }
    
    // Fallback if JSON parsing fails
    return [
        'findings' => [['description' => 'Failed to parse structured response: ' . substr($text, 0, 100) . '...', 'confidence' => 0.0]],
        'impression' => $text,
        'confidence_overall' => 0.0,
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
    // Add auth if configured
    if (defined('ORTHANC_USER') && ORTHANC_USER) {
        curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    }
    
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
        // Return obstetric USG-specific template with EXPLICIT OCR instructions
        return [
            'system_prompt' => 'You are an expert radiologist specializing in OBSTETRIC ULTRASOUND with OCR capability.

CRITICAL: Extract ALL visible text and measurements from the image exactly as shown.

STANDARD FETAL BIOMETRY MEASUREMENTS TO LOOK FOR:
- FL (Femur Length) - typically shown in cm with percentile
- AC (Abdominal Circumference) - shown in cm with percentile  
- BPD (Biparietal Diameter) - head width in cm
- HC (Head Circumference) - head perimeter in cm
- CRL (Crown-Rump Length) - early pregnancy measurement
- EFW (Estimated Fetal Weight) - in grams
- GA (Gestational Age) - in weeks+days format like "36w4d"
- EDD (Estimated Due Date) - date format

SCREEN REGIONS TO READ:
1. TOP HEADER: Hospital name, date, time, patient name, study ID
2. RIGHT PANEL: Device model (DC-8 EXP, etc.), frequency, gain, depth settings
3. MEASUREMENT BOX: Usually at bottom - contains FL/AC/BPD values with GA and EDD
4. ON-IMAGE: Caliper markers, anatomical labels

Return a single JSON object with ALL extracted data.',
            'user_prompt_template' => 'Analyze this obstetric ultrasound image. Extract ALL visible text and measurements.

Return JSON with this structure:
{
  "extracted_text": ["list every text string visible on screen"],
  "device_metadata": {
    "machine": "device model name",
    "hospital": "facility name",
    "settings": ["AP 96.6%", "MI 0.8", "TIS 0.3", "F H6.0", "D 14.0", "G 47", "FR 26", "DR 140"]
  },
  "patient_metrics": {
    "patient_name": "name from image",
    "exam_date": "date from image",
    "ga_header": "gestational age from header"
  },
  "biometry": {
    "measurement_type": "FL or AC or BPD or HC - what is being measured",
    "value": "numeric value with unit",
    "percentile": "percentile if shown",
    "ga_from_measurement": "gestational age calculated from this measurement"
  },
  "measurements": [
    {
      "structure": "FL",
      "value": 7.13,
      "unit": "cm",
      "percentile": "27.8%",
      "ga": "36w4d",
      "edd": "16/04/2022",
      "is_normal": true
    }
  ],
  "findings": [{"description": "finding", "confidence": 0.8}],
  "anatomical_structures": [{"name": "structure", "appearance": "description", "normal": true}],
  "impression": "Overall assessment including GA and findings",
  "recommendations": ["Follow-up recommendations"],
  "image_quality": {"score": 0.8, "issues": []},
  "confidence_overall": 0.8
}

Extract EVERY measurement value shown. Do not skip any text.',
            'temperature' => 0.1,
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
        if (is_array($data['image_quality'])) {
            $score = isset($data['image_quality']['score']) ? ($data['image_quality']['score'] * 100) : 0;
            $report .= "IMAGE QUALITY: " . $score . "%\n";
            if (!empty($data['image_quality']['issues']) && is_array($data['image_quality']['issues'])) {
                $report .= "Issues: " . implode(', ', $data['image_quality']['issues']) . "\n";
            }
        }
        $report .= "\n";
    }
    
    // Anatomical Structures
    if (!empty($data['anatomical_structures']) && is_array($data['anatomical_structures'])) {
        $report .= "ANATOMICAL STRUCTURES:\n";
        foreach ($data['anatomical_structures'] as $structure) {
            if (is_array($structure)) {
                $name = $structure['name'] ?? 'Unknown';
                $appearance = $structure['appearance'] ?? 'Not described';
                $status = isset($structure['normal']) && $structure['normal'] ? 'Normal' : 'Abnormal';
                $report .= "- {$name}: {$appearance} ($status)\n";
            } elseif (is_string($structure)) {
                $report .= "- {$structure}\n";
            }
        }
        $report .= "\n";
    }
    
    // Measurements
    if (!empty($data['measurements']) && is_array($data['measurements'])) {
        $report .= "MEASUREMENTS:\n";
        foreach ($data['measurements'] as $measurement) {
            if (is_array($measurement)) {
                $struct = $measurement['structure'] ?? 'Unknown';
                $val = $measurement['value'] ?? '?';
                $unit = $measurement['unit'] ?? '';
                $status = isset($measurement['is_normal']) && $measurement['is_normal'] ? '(Normal)' : '(Abnormal)';
                $report .= "- {$struct}: {$val} {$unit} $status\n";
            } elseif (is_string($measurement)) {
                $report .= "- {$measurement}\n";
            }
        }
        $report .= "\n";
    }
    
    // Findings
    if (!empty($data['findings']) && is_array($data['findings'])) {
        $report .= "FINDINGS:\n";
        foreach ($data['findings'] as $finding) {
            if (is_array($finding)) {
                $desc = $finding['description'] ?? 'No description';
                $confidence = isset($finding['confidence']) ? round($finding['confidence'] * 100) : 0;
                $report .= "- {$desc} (Confidence: $confidence%)\n";
                if (!empty($finding['location'])) {
                    $report .= "  Location: {$finding['location']}\n";
                }
            } elseif (is_string($finding)) {
                $report .= "- {$finding}\n";
            }
        }
        $report .= "\n";
    }
    
    // Impression
    if (!empty($data['impression'])) {
        $impression = is_string($data['impression']) ? $data['impression'] : json_encode($data['impression']);
        $report .= "IMPRESSION:\n{$impression}\n\n";
    }
    
    // Recommendations
    if (!empty($data['recommendations']) && is_array($data['recommendations'])) {
        $report .= "RECOMMENDATIONS:\n";
        foreach ($data['recommendations'] as $rec) {
            if (is_string($rec)) {
                $report .= "- $rec\n";
            } elseif (is_array($rec)) {
                $report .= "- " . ($rec['text'] ?? json_encode($rec)) . "\n";
            }
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
 * Process image input (for multi-image support)
 */
function processImageInput($imgData, $frameNumber) {
    $imageData = null;
    $mediaType = 'image/jpeg';
    
    // Handle different input formats
    if (is_string($imgData)) {
        // Direct base64 string
        $imageData = $imgData;
        if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
            $imageData = substr($imageData, strpos($imageData, ',') + 1);
            $mediaType = 'image/' . strtolower($type[1]);
        }
    } elseif (is_array($imgData)) {
        // Object with data and optional instance_id
        if (!empty($imgData['instance_id'])) {
            try {
                $result = fetchAndConvertDicomImage($imgData['instance_id']);
                $imageData = $result['data'];
                $mediaType = $result['media_type'];
            } catch (Exception $e) {
                return null;
            }
        } elseif (!empty($imgData['data'])) {
            $imageData = $imgData['data'];
            if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
                $imageData = substr($imageData, strpos($imageData, ',') + 1);
                $mediaType = 'image/' . strtolower($type[1]);
            }
            if (isset($imgData['media_type'])) {
                $mediaType = $imgData['media_type'];
            }
        }
    }
    
    if (empty($imageData)) {
        return null;
    }
    
    return [
        'data' => $imageData,
        'media_type' => $mediaType,
        'frame_number' => $frameNumber
    ];
}
?>
