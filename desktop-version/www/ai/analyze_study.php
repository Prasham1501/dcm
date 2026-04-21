<?php
/**
 * AI Study Analysis Endpoint - Analyzes ALL images in a study
 * POST /ai/analyze_study.php
 * 
 * This endpoint fetches all images from a study via Orthanc and sends them
 * for comprehensive AI analysis with OCR and medical interpretation.
 */

if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Disable error display for API endpoint
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Register shutdown function to handle fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && ($error['type'] === E_ERROR || $error['type'] === E_PARSE || $error['type'] === E_CORE_ERROR || $error['type'] === E_COMPILE_ERROR)) {
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
    
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input');
    }
    
    // Required: study_id (Orthanc study ID)
    $studyId = sanitizeInput($input['study_id'] ?? '');
    $studyUID = sanitizeInput($input['study_uid'] ?? '');
    $maxImages = intval($input['max_images'] ?? 10); // Limit images for API cost
    $analysisType = sanitizeInput($input['analysis_type'] ?? 'USG');
    $bodyRegion = sanitizeInput($input['body_region'] ?? 'obstetric');
    
    if (empty($studyId) && empty($studyUID)) {
        sendErrorResponse('study_id or study_uid is required', 400);
    }
    
    // Fetch study images from Orthanc
    $studyImages = fetchStudyImagesFromOrthanc($studyId, $studyUID, $maxImages);
    
    if (empty($studyImages['images'])) {
        sendErrorResponse('No images found in study', 404);
    }
    
    $patientName = $studyImages['patient_name'] ?? '';
    $patientId = $studyImages['patient_id'] ?? '';
    
    // Get obstetric USG-specific prompt
    $promptTemplate = getObstetricUSGPrompt();
    
    // Analyze all images
    $analysisResult = performGeminiStudyAnalysis(
        $studyImages['images'],
        $promptTemplate,
        [
            'patient_name' => $patientName,
            'num_images' => count($studyImages['images']),
            'study_description' => $studyImages['study_description'] ?? ''
        ]
    );
    
    $endTime = microtime(true);
    $processingTimeMs = round(($endTime - $startTime) * 1000);
    
    // Parse and consolidate results
    $parsedResult = parseStudyAnalysisResponse($analysisResult);
    
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
    $modelVersion = '2025-01';
    $seriesUid = '';
    $instanceUid = '';
    
    $findingsJson = json_encode($parsedResult['findings'] ?? []);
    $measurementsJson = json_encode($parsedResult['measurements'] ?? []);
    $anomaliesJson = json_encode($parsedResult['anomalies'] ?? []);
    $generatedReport = generateObstetricReport($parsedResult, $patientName);
    $overallConfidence = $parsedResult['confidence_overall'] ?? 0.8;
    $qualityScore = $parsedResult['image_quality']['score'] ?? 0.8;
    
    $tokensUsed = 0;
    if (isset($analysisResult['usageMetadata'])) {
        $tokensUsed = ($analysisResult['usageMetadata']['promptTokenCount'] ?? 0) + ($analysisResult['usageMetadata']['candidatesTokenCount'] ?? 0);
    }
    $apiCost = 0;
    
    $stmt->bind_param(
        "sssssssssssssddiidi",
        $studyUID, $seriesUid, $instanceUid, $patientId, $patientName,
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
    
    logMessage(
        "AI Study Analysis completed: ID=$analysisId, Study=$studyUID, Images=" . count($studyImages['images']),
        'info',
        'ai_analysis.log'
    );
    
    // Return comprehensive result
    sendSuccessResponse([
        'analysis_id' => $analysisId,
        'study_uid' => $studyUID,
        'study_id' => $studyId,
        'patient_name' => $patientName,
        'images_analyzed' => count($studyImages['images']),
        'analysis_type' => $analysisType,
        
        // Per-image data
        'image_analyses' => $parsedResult['image_analyses'] ?? [],
        
        // Consolidated data
        'consolidated_biometry' => $parsedResult['consolidated_biometry'] ?? [],
        'fetal_measurements' => $parsedResult['fetal_measurements'] ?? [],
        'gestational_info' => $parsedResult['gestational_info'] ?? [],
        'findings' => $parsedResult['findings'] ?? [],
        'measurements' => $parsedResult['measurements'] ?? [],
        'anatomical_structures' => $parsedResult['anatomical_structures'] ?? [],
        'device_metadata' => $parsedResult['device_metadata'] ?? null,
        'extracted_text' => $parsedResult['extracted_text'] ?? [],
        
        'impression' => $parsedResult['impression'] ?? '',
        'recommendations' => $parsedResult['recommendations'] ?? [],
        
        'confidence' => $overallConfidence,
        'quality_score' => $qualityScore,
        'urgent_findings' => $parsedResult['urgent_findings'] ?? false,
        'requires_review' => $parsedResult['requires_review'] ?? true,
        
        'generated_report' => $generatedReport,
        'processing_time_ms' => $processingTimeMs,
        'model_used' => $modelUsed
    ], 'Study analysis completed successfully');
    
} catch (Exception $e) {
    logMessage("AI Study Analysis error: " . $e->getMessage(), 'error', 'ai_analysis.log');
    sendErrorResponse('Analysis failed: ' . $e->getMessage(), 500);
}

/**
 * Fetch all images from Orthanc study
 */
function fetchStudyImagesFromOrthanc($studyId, $studyUID, $maxImages = 10) {
    $orthancUrl = ORTHANC_URL;
    $orthancUser = ORTHANC_USER;
    $orthancPass = ORTHANC_PASS;
    
    if (empty($orthancUrl)) {
        throw new Exception('Orthanc not configured');
    }
    
    // If we only have studyUID, find the studyId
    if (empty($studyId) && !empty($studyUID)) {
        $searchUrl = "{$orthancUrl}/tools/find";
        $searchPayload = json_encode([
            'Level' => 'Study',
            'Query' => ['StudyInstanceUID' => $studyUID]
        ]);
        
        $ch = curl_init($searchUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $searchPayload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_USERPWD, "{$orthancUser}:{$orthancPass}");
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $result = curl_exec($ch);
        curl_close($ch);
        
        $studyIds = json_decode($result, true);
        if (!empty($studyIds)) {
            $studyId = $studyIds[0];
        }
    }
    
    if (empty($studyId)) {
        throw new Exception('Study not found in Orthanc');
    }
    
    // Get study metadata
    $studyData = fetchOrthancData("{$orthancUrl}/studies/{$studyId}", $orthancUser, $orthancPass);
    
    if (!$studyData) {
        throw new Exception('Failed to fetch study from Orthanc');
    }
    
    $patientName = $studyData['PatientMainDicomTags']['PatientName'] ?? 'Unknown';
    $patientId = $studyData['PatientMainDicomTags']['PatientID'] ?? '';
    $studyDescription = $studyData['MainDicomTags']['StudyDescription'] ?? '';
    $actualStudyUID = $studyData['MainDicomTags']['StudyInstanceUID'] ?? $studyUID;
    
    $images = [];
    $totalInstances = 0;
    
    // Get all series
    if (isset($studyData['Series']) && is_array($studyData['Series'])) {
        foreach ($studyData['Series'] as $seriesId) {
            $seriesData = fetchOrthancData("{$orthancUrl}/series/{$seriesId}", $orthancUser, $orthancPass);
            
            if ($seriesData && isset($seriesData['Instances'])) {
                foreach ($seriesData['Instances'] as $instanceId) {
                    $totalInstances++;
                    
                    // Limit number of images
                    if (count($images) >= $maxImages) {
                        break 2;
                    }
                    
                    // Fetch rendered image as PNG
                    $imageUrl = "{$orthancUrl}/instances/{$instanceId}/rendered";
                    
                    $ch = curl_init($imageUrl);
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_USERPWD, "{$orthancUser}:{$orthancPass}");
                    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
                    
                    $imageData = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);
                    
                    if ($httpCode === 200 && $imageData) {
                        $images[] = [
                            'data' => base64_encode($imageData),
                            'media_type' => 'image/png',
                            'instance_id' => $instanceId,
                            'frame_number' => count($images) + 1
                        ];
                    }
                }
            }
        }
    }
    
    return [
        'study_id' => $studyId,
        'study_uid' => $actualStudyUID,
        'patient_name' => $patientName,
        'patient_id' => $patientId,
        'study_description' => $studyDescription,
        'images' => $images,
        'total_instances' => $totalInstances
    ];
}

/**
 * Fetch data from Orthanc
 */
function fetchOrthancData($url, $user, $pass) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, "{$user}:{$pass}");
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $result) {
        return json_decode($result, true);
    }
    return null;
}

/**
 * Get specialized prompt for Obstetric USG analysis
 */
function getObstetricUSGPrompt() {
    return [
        'system_prompt' => 'You are an expert radiologist and sonographer specializing in OBSTETRIC ULTRASOUND analysis.

Your task is to analyze fetal ultrasound images and extract ALL information visible on screen, just as a doctor would interpret the scan.

CRITICAL: You MUST perform DETAILED OCR (Optical Character Recognition) on every image.

For each image, extract:

1. **HEADER INFORMATION** (top of screen):
   - Hospital/Clinic name (e.g., "MAGNET Diagnostics")
   - Machine manufacturer (e.g., "mindray", "GE", "Philips")
   - Date and time of scan
   - Patient name/ID
   - Study/Exam ID
   - Probe type (e.g., "SC5-1E / OB2/3")
   - Gestational age from header (e.g., "GA=37w3d")

2. **DEVICE SETTINGS** (usually right side panel):
   - Machine model (e.g., "DC-8 EXP")
   - Mode (B, M, Doppler)
   - Frequency (F H6.0)
   - Depth (D 14.0)
   - Gain (G 47)
   - Frame rate (FR 26)
   - Dynamic range (DR 140)
   - Image processing settings (iClear, iBeam, etc.)
   - TIS, MI, AP values (thermal/mechanical indices)

3. **FETAL BIOMETRY MEASUREMENTS** (measurement boxes):
   - FL (Femur Length) with value in cm and percentile
   - AC (Abdominal Circumference) with value in cm and percentile
   - BPD (Biparietal Diameter)
   - HC (Head Circumference)
   - EFW (Estimated Fetal Weight) in grams
   - SD (Standard Deviation)
   - GA (Gestational Age) calculated from each measurement
   - EDD (Estimated Due Date)
   - CRL (Crown-Rump Length)
   - Any other measurements visible

4. **ON-IMAGE ANNOTATIONS**:
   - Labels like "Spine", "Head", "Abdomen", "Femur"
   - Caliper markers (+ symbols)
   - Any text overlaid on the ultrasound image

5. **CLINICAL FINDINGS**:
   - Fetal position
   - Anatomy visualized
   - Any abnormalities
   - Amniotic fluid assessment
   - Placental position if visible

Return your analysis as a single JSON object.',
        
        'user_prompt_template' => 'Analyze these {{num_images}} obstetric ultrasound images from patient {{patient_name}}.

Extract EVERY piece of text visible on each image and provide comprehensive analysis.

Return a single JSON object with this structure:
{
  "image_analyses": [
    {
      "image_number": 1,
      "extracted_text": ["every", "text", "string", "visible"],
      "header_info": {
        "hospital": "name",
        "date_time": "date and time",
        "patient_name": "name",
        "exam_id": "id",
        "probe": "probe type",
        "ga_header": "gestational age from header"
      },
      "device_settings": {
        "machine": "model name",
        "mode": "B/M/Doppler",
        "frequency": "value",
        "depth": "value",
        "gain": "value",
        "frame_rate": "value",
        "other_settings": ["list"]
      },
      "biometry": {
        "measurement_type": "FL/AC/BPD/HC/etc",
        "value_cm": number,
        "percentile": number or null,
        "ga_weeks": number,
        "ga_days": number,
        "edd": "date string"
      },
      "annotations": ["text annotations on image"],
      "findings": "description of what is visualized"
    }
  ],
  "consolidated_biometry": {
    "FL": { "value": "7.13 cm", "ga": "36w4d", "percentile": "27.8%", "edd": "16/04/2022" },
    "AC": { "value": "31.04 cm", "ga": "35w0d", "percentile": "7.5%", "edd": "27/04/2022" },
    "BPD": { "value": null, "ga": null },
    "HC": { "value": null, "ga": null },
    "EFW": { "value": "2719g", "sd": "±397g" }
  },
  "device_metadata": {
    "machine": "Mindray DC-8 EXP",
    "hospital": "MAGNET Diagnostics",
    "settings": ["AP 96.6%", "MI 0.8", "TIS 0.3"]
  },
  "patient_info": {
    "name": "patient name from image",
    "exam_date": "date",
    "ga_at_scan": "gestational age"
  },
  "findings": [
    {
      "description": "Clinical finding description",
      "confidence": 0.0-1.0
    }
  ],
  "impression": "Overall assessment of the study",
  "recommendations": ["list of clinical recommendations"],
  "image_quality": { "score": 0.0-1.0, "issues": [] },
  "confidence_overall": 0.0-1.0,
  "urgent_findings": false,
  "requires_review": true
}

IMPORTANT:
- Extract ALL text from every image - do not skip any measurements
- Include percentiles where shown
- Note the different GA values from different measurements
- Combine data from all images for a complete picture',
        'temperature' => 0.1,
        'max_tokens' => 8000
    ];
}

/**
 * Perform Gemini analysis on all study images
 */
function performGeminiStudyAnalysis($images, $promptTemplate, $context) {
    $systemPrompt = $promptTemplate['system_prompt'];
    $userPrompt = $promptTemplate['user_prompt_template'];
    
    // Replace placeholders
    foreach ($context as $key => $value) {
        $userPrompt = str_replace('{{' . $key . '}}', $value, $userPrompt);
    }
    
    $fullPrompt = $systemPrompt . "\n\n" . $userPrompt;
    
    // Build content with all images
    $parts = [];
    $parts[] = ['text' => $fullPrompt];
    
    foreach ($images as $idx => $img) {
        // Add image
        $parts[] = [
            'inline_data' => [
                'mime_type' => $img['media_type'],
                'data' => $img['data']
            ]
        ];
        
        // Add instruction for each image
        $parts[] = [
            'text' => "IMAGE " . ($idx + 1) . " - Extract ALL text and measurements."
        ];
    }
    
    $payload = [
        'contents' => [
            ['parts' => $parts]
        ],
        'generationConfig' => [
            'temperature' => (float)$promptTemplate['temperature'],
            'maxOutputTokens' => (int)$promptTemplate['max_tokens'],
            'responseMimeType' => 'application/json'
        ]
    ];
    
    $url = GEMINI_API_URL . '?key=' . GEMINI_API_KEY;
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, AI_ANALYSIS_TIMEOUT * count($images));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    // Debug log
    file_put_contents(__DIR__ . '/ai_debug.log', 
        date('Y-m-d H:i:s') . " Study Analysis - HTTP $httpCode\n" .
        "Num Images: " . count($images) . "\n" .
        "Response: " . substr($response, 0, 2000) . "\n\n", 
        FILE_APPEND
    );
    
    if ($httpCode !== 200 || !$response) {
        throw new Exception("Gemini API error: HTTP $httpCode - $error");
    }
    
    return json_decode($response, true);
}

/**
 * Parse study analysis response
 */
function parseStudyAnalysisResponse($response) {
    if (empty($response['candidates'][0]['content']['parts'][0]['text'])) {
        throw new Exception('Empty response from AI');
    }
    
    $text = $response['candidates'][0]['content']['parts'][0]['text'];
    
    // Clean up markdown
    $text = preg_replace('/^```json\s*|\s*```$/', '', trim($text));
    
    $data = json_decode($text, true);
    
    if ($data !== null) {
        // If it's an array (multi-image response), consolidate it
        if (isset($data[0])) {
            return consolidateMultiImageResponse($data);
        }
        
        // Build measurements array from consolidated_biometry
        if (isset($data['consolidated_biometry']) && empty($data['measurements'])) {
            $data['measurements'] = [];
            foreach ($data['consolidated_biometry'] as $type => $info) {
                if ($info && isset($info['value']) && $info['value']) {
                    $data['measurements'][] = [
                        'structure' => $type,
                        'value' => $info['value'],
                        'unit' => '',
                        'ga' => $info['ga'] ?? null,
                        'percentile' => $info['percentile'] ?? null,
                        'edd' => $info['edd'] ?? null,
                        'is_normal' => true
                    ];
                }
            }
        }
        
        // Extract text from all image analyses
        if (isset($data['image_analyses']) && empty($data['extracted_text'])) {
            $allText = [];
            foreach ($data['image_analyses'] as $img) {
                if (isset($img['extracted_text'])) {
                    $allText = array_merge($allText, $img['extracted_text']);
                }
            }
            $data['extracted_text'] = array_unique($allText);
        }
        
        return $data;
    }
    
    // Fallback
    return [
        'findings' => [['description' => 'Failed to parse structured response', 'confidence' => 0]],
        'confidence_overall' => 0,
        'requires_review' => true
    ];
}

/**
 * Consolidate multi-image response into single object
 */
function consolidateMultiImageResponse($imagesData) {
    $consolidated = [
        'image_analyses' => $imagesData,
        'consolidated_biometry' => [
            'FL' => null,
            'AC' => null,
            'BPD' => null,
            'HC' => null,
            'EFW' => null,
            'GA' => null,
            'EDD' => null
        ],
        'device_metadata' => null,
        'patient_info' => null,
        'findings' => [],
        'measurements' => [],
        'extracted_text' => [],
        'impression' => '',
        'recommendations' => [],
        'image_quality' => ['score' => 0.8, 'issues' => []],
        'confidence_overall' => 0.8,
        'urgent_findings' => false,
        'requires_review' => true
    ];
    
    $allFindings = [];
    $allText = [];
    
    foreach ($imagesData as $imgData) {
        // Collect extracted text
        if (isset($imgData['extracted_text'])) {
            $allText = array_merge($allText, $imgData['extracted_text']);
        }
        
        // Get device metadata from first image
        if (!$consolidated['device_metadata'] && isset($imgData['device_metadata'])) {
            $consolidated['device_metadata'] = $imgData['device_metadata'];
        }
        if (!$consolidated['device_metadata'] && isset($imgData['device_settings'])) {
            $consolidated['device_metadata'] = $imgData['device_settings'];
        }
        
        // Get patient info
        if (!$consolidated['patient_info'] && isset($imgData['patient_metrics'])) {
            $consolidated['patient_info'] = $imgData['patient_metrics'];
        }
        if (!$consolidated['patient_info'] && isset($imgData['header_info'])) {
            $consolidated['patient_info'] = $imgData['header_info'];
        }
        
        // Collect biometry measurements
        $biometry = $imgData['biometry'] ?? $imgData['patient_metrics'] ?? [];
        
        // Look for specific measurements
        foreach (['FL', 'AC', 'BPD', 'HC', 'EFW', 'CRL', 'GA', 'EDD'] as $type) {
            $found = false;
            $value = null;
            
            // Check direct key
            if (isset($biometry[$type])) {
                $value = $biometry[$type];
                $found = true;
            } elseif (isset($biometry[strtolower($type)])) {
                $value = $biometry[strtolower($type)];
                $found = true;
            }
            
            // Check measurement_type
            if (!$found && isset($biometry['measurement_type']) && strtoupper($biometry['measurement_type']) === $type) {
                $value = [
                    'value' => $biometry['value_cm'] ?? $biometry['value'] ?? null,
                    'percentile' => $biometry['percentile'] ?? null,
                    'ga' => isset($biometry['ga_weeks']) ? $biometry['ga_weeks'] . 'w' . ($biometry['ga_days'] ?? '0') . 'd' : null,
                    'edd' => $biometry['edd'] ?? null
                ];
                $found = true;
            }
            
            if ($found && $value && (!$consolidated['consolidated_biometry'][$type] || !isset($consolidated['consolidated_biometry'][$type]['value']))) {
                if (is_array($value)) {
                    $consolidated['consolidated_biometry'][$type] = $value;
                } else {
                    $consolidated['consolidated_biometry'][$type] = ['value' => $value];
                }
            }
        }
        
        // Collect findings
        if (isset($imgData['findings'])) {
            if (is_string($imgData['findings'])) {
                $allFindings[] = ['description' => $imgData['findings'], 'confidence' => 0.7];
            } elseif (is_array($imgData['findings'])) {
                foreach ($imgData['findings'] as $f) {
                    if (is_string($f)) {
                        $allFindings[] = ['description' => $f, 'confidence' => 0.7];
                    } else {
                        $allFindings[] = $f;
                    }
                }
            }
        }
    }
    
    // Extract measurements from all text using regex
    $extracted = extractBiometryFromText($allText);
    foreach ($extracted as $type => $data) {
        if (!isset($consolidated['consolidated_biometry'][$type]) || 
            !$consolidated['consolidated_biometry'][$type] ||
            !isset($consolidated['consolidated_biometry'][$type]['value'])) {
            $consolidated['consolidated_biometry'][$type] = $data;
        }
    }
    
    // Build measurements array
    foreach ($consolidated['consolidated_biometry'] as $type => $info) {
        if ($info && isset($info['value']) && $info['value']) {
            $consolidated['measurements'][] = [
                'structure' => $type,
                'value' => $info['value'],
                'unit' => '',
                'ga' => $info['ga'] ?? null,
                'percentile' => $info['percentile'] ?? null,
                'edd' => $info['edd'] ?? null,
                'is_normal' => true
            ];
        }
    }
    
    $consolidated['findings'] = $allFindings;
    $consolidated['extracted_text'] = array_values(array_unique($allText));
    
    // Generate impression
    $consolidated['impression'] = generateImpression($consolidated);
    
    return $consolidated;
}

/**
 * Extract biometry from text using regex
 */
function extractBiometryFromText($textArray) {
    $text = implode(' ', $textArray);
    $results = [];
    
    // FL pattern: "FL 7.13 cm 27.8 %"
    if (preg_match('/FL\s*([\d.]+)\s*cm\s*([\d.]+)?\s*%?/i', $text, $m)) {
        $results['FL'] = [
            'value' => $m[1] . ' cm',
            'percentile' => isset($m[2]) ? $m[2] . '%' : null
        ];
    }
    
    // AC pattern: "AC 31.04 cm 7.5 %"
    if (preg_match('/AC\s*([\d.]+)\s*cm\s*([\d.]+)?\s*%?/i', $text, $m)) {
        $results['AC'] = [
            'value' => $m[1] . ' cm',
            'percentile' => isset($m[2]) ? $m[2] . '%' : null
        ];
    }
    
    // BPD pattern
    if (preg_match('/BPD\s*([\d.]+)\s*cm/i', $text, $m)) {
        $results['BPD'] = ['value' => $m[1] . ' cm'];
    }
    
    // HC pattern
    if (preg_match('/HC\s*([\d.]+)\s*cm/i', $text, $m)) {
        $results['HC'] = ['value' => $m[1] . ' cm'];
    }
    
    // GA pattern: "GA 36w4d" or "GA=37w3d"
    if (preg_match('/GA[=\s]*([\d]+)w([\d]+)d/i', $text, $m)) {
        $results['GA'] = [
            'weeks' => intval($m[1]),
            'days' => intval($m[2]),
            'value' => $m[1] . 'w' . $m[2] . 'd'
        ];
    }
    
    // EDD pattern
    if (preg_match('/EDD\s*(\d{2}\/\d{2}\/\d{4})/i', $text, $m)) {
        $results['EDD'] = ['value' => $m[1]];
    }
    
    // EFW pattern: "EFW 2719g"
    if (preg_match('/EFW\s*([\d]+)\s*g/i', $text, $m)) {
        $results['EFW'] = ['value' => $m[1] . 'g'];
    }
    
    // SD pattern: "SD ±397g"
    if (preg_match('/SD\s*[±]?\s*([\d]+)\s*g/i', $text, $m)) {
        if (isset($results['EFW'])) {
            $results['EFW']['sd'] = '±' . $m[1] . 'g';
        }
    }
    
    return $results;
}

/**
 * Generate impression from consolidated data
 */
function generateImpression($data) {
    $parts = [];
    
    // Gestational age
    if (isset($data['consolidated_biometry']['GA']['value'])) {
        $parts[] = "Gestational age: " . $data['consolidated_biometry']['GA']['value'];
    }
    
    // Biometry summary
    $bioSummary = [];
    foreach (['FL', 'AC', 'BPD', 'HC'] as $type) {
        if (isset($data['consolidated_biometry'][$type]['value'])) {
            $val = $data['consolidated_biometry'][$type];
            $bioSummary[] = "$type: {$val['value']}" . 
                (isset($val['percentile']) ? " ({$val['percentile']})" : '');
        }
    }
    if (!empty($bioSummary)) {
        $parts[] = "Fetal biometry: " . implode(', ', $bioSummary);
    }
    
    // EFW
    if (isset($data['consolidated_biometry']['EFW']['value'])) {
        $efw = $data['consolidated_biometry']['EFW'];
        $parts[] = "Estimated fetal weight: {$efw['value']}" . 
            (isset($efw['sd']) ? " {$efw['sd']}" : '');
    }
    
    if (empty($parts)) {
        return "Obstetric ultrasound examination performed. Clinical correlation recommended.";
    }
    
    return implode(". ", $parts) . ". Clinical correlation recommended.";
}

/**
 * Generate obstetric report
 */
function generateObstetricReport($data, $patientName) {
    $report = "=== OBSTETRIC ULTRASOUND AI ANALYSIS REPORT ===\n\n";
    
    $report .= "Patient: " . ($patientName ?: 'Unknown') . "\n";
    $report .= "Report Generated: " . date('Y-m-d H:i:s') . "\n";
    
    if (isset($data['device_metadata'])) {
        $device = $data['device_metadata'];
        $report .= "Equipment: " . ($device['machine'] ?? 'Unknown') . "\n";
        $report .= "Facility: " . ($device['hospital'] ?? 'Unknown') . "\n";
    }
    
    $report .= "\n--- FETAL BIOMETRY ---\n";
    
    if (isset($data['consolidated_biometry'])) {
        foreach ($data['consolidated_biometry'] as $type => $info) {
            if ($info && isset($info['value'])) {
                $line = "$type: {$info['value']}";
                if (isset($info['ga'])) $line .= " (GA: {$info['ga']})";
                if (isset($info['percentile'])) $line .= " - {$info['percentile']}";
                if (isset($info['edd'])) $line .= " EDD: {$info['edd']}";
                if (isset($info['sd'])) $line .= " {$info['sd']}";
                $report .= $line . "\n";
            }
        }
    }
    
    if (!empty($data['measurements'])) {
        $report .= "\n--- ALL MEASUREMENTS ---\n";
        foreach ($data['measurements'] as $m) {
            $report .= "• {$m['structure']}: {$m['value']} {$m['unit']}";
            if (isset($m['ga'])) $report .= " (GA: {$m['ga']})";
            if (isset($m['percentile'])) $report .= " - {$m['percentile']}";
            $report .= "\n";
        }
    }
    
    if (!empty($data['findings'])) {
        $report .= "\n--- FINDINGS ---\n";
        foreach ($data['findings'] as $f) {
            $desc = is_string($f) ? $f : ($f['description'] ?? '');
            if ($desc) $report .= "• $desc\n";
        }
    }
    
    if (!empty($data['impression'])) {
        $report .= "\n--- IMPRESSION ---\n{$data['impression']}\n";
    }
    
    if (!empty($data['recommendations'])) {
        $report .= "\n--- RECOMMENDATIONS ---\n";
        foreach ($data['recommendations'] as $r) {
            $report .= "• $r\n";
        }
    }
    
    $report .= "\n--- DISCLAIMER ---\n";
    $report .= "This is an AI-assisted preliminary analysis.\n";
    $report .= "All findings should be reviewed and confirmed by a qualified physician.\n";
    $report .= "Clinical correlation is required.\n";
    
    return $report;
}
?>
