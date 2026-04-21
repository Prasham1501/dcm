<?php
/**
 * Generate X-Ray Chest Report from AI Analysis
 * Combines AI analysis with professional X-Ray report template
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $studyUid = $input['study_uid'] ?? '';
    $patientName = $input['patient_name'] ?? '';
    $patientAge = $input['patient_age'] ?? '';
    $patientId = $input['patient_id'] ?? '';
    $patientSex = $input['patient_sex'] ?? 'Male';
    $referringPhysician = $input['referring_physician'] ?? '';
    $clinicalHistory = $input['clinical_history'] ?? '';
    $examDate = $input['exam_date'] ?? date('Y-m-d');
    
    // X-Ray specific fields
    $technique = $input['technique'] ?? 'PA view, erect position';
    $findings = $input['findings'] ?? [];
    $impression = $input['impression'] ?? '';
    
    $db = getDbConnection();
    
    // Get hospital config
    $hospitalConfig = getHospitalConfig($db);
    
    // Generate report content
    $reportContent = generateXRayReport([
        'study_uid' => $studyUid,
        'patient_name' => $patientName,
        'patient_age' => $patientAge,
        'patient_id' => $patientId,
        'patient_sex' => $patientSex,
        'referring_physician' => $referringPhysician,
        'clinical_history' => $clinicalHistory,
        'exam_date' => $examDate,
        'technique' => $technique,
        'findings' => $findings,
        'impression' => $impression,
        'hospital' => $hospitalConfig
    ]);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'report_html' => $reportContent['html'],
            'report_text' => $reportContent['text'],
            'template_data' => $reportContent['template_data'],
            'hospital_config' => $hospitalConfig
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function getHospitalConfig($db) {
    $config = [
        'hospital_name' => 'Medical Imaging Center',
        'hospital_address' => '',
        'hospital_phone' => '',
        'hospital_email' => '',
        'hospital_logo' => '',
        'hospital_registration' => '',
        'doctor_name' => '',
        'doctor_qualification' => 'MBBS, MD (Radiology)',
        'doctor_registration' => ''
    ];
    
    $query = "SELECT setting_key, setting_value FROM system_settings 
              WHERE category = 'hospital' OR setting_key LIKE 'hospital_%' OR setting_key LIKE 'doctor_%'";
    $result = $db->query($query);
    
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $config[$row['setting_key']] = $row['setting_value'];
        }
        $result->free();
    }
    
    return $config;
}

function generateXRayReport($data) {
    $hospital = $data['hospital'];
    $reportDate = date('d/m/Y', strtotime($data['exam_date']));
    $reportTime = date('H:i');
    
    // Default findings if not provided
    $findings = $data['findings'] ?: [
        'lungs' => 'Both lung fields are clear. No consolidation, infiltrates, or mass lesions seen.',
        'heart' => 'Heart size is within normal limits. Cardiothoracic ratio is normal.',
        'mediastinum' => 'Mediastinum is central. Trachea is midline.',
        'bones' => 'Visualized osseous structures appear normal. No fractures seen.',
        'soft_tissues' => 'Soft tissues are unremarkable.',
        'costophrenic_angles' => 'Costophrenic angles are clear bilaterally.',
        'diaphragm' => 'Both hemidiaphragms are normal in position and contour.'
    ];
    
    // Build template data
    $templateData = [
        'patient_name' => $data['patient_name'],
        'patient_age' => $data['patient_age'],
        'patient_id' => $data['patient_id'],
        'patient_sex' => $data['patient_sex'],
        'exam_date' => $reportDate,
        'referring_physician' => $data['referring_physician'],
        'clinical_history' => $data['clinical_history'] ?: 'Routine chest X-ray',
        'technique' => $data['technique'],
        'findings' => $findings,
        'impression' => $data['impression'] ?: 'Normal chest radiograph. No acute cardiopulmonary abnormality.'
    ];
    
    // Generate HTML
    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>X-Ray Chest Report</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
        .report-container { max-width: 210mm; margin: 0 auto; padding: 10mm; }
        .report-header { border-bottom: 3px solid #dc3545; padding-bottom: 15px; margin-bottom: 15px; }
        .hospital-info { text-align: center; }
        .hospital-name { font-size: 20pt; font-weight: bold; color: #dc3545; text-transform: uppercase; }
        .hospital-address { font-size: 10pt; color: #666; margin-top: 5px; }
        .report-title { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; 
                        text-align: center; padding: 10px; font-size: 14pt; font-weight: bold; 
                        margin: 10px 0; border-radius: 5px; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; 
                        background: #f8f9fa; padding: 12px; border-radius: 5px; 
                        margin-bottom: 15px; border: 1px solid #dee2e6; }
        .info-row { display: flex; align-items: baseline; }
        .info-label { font-weight: 600; color: #495057; min-width: 120px; font-size: 10pt; }
        .info-value { color: #212529; font-size: 10pt; }
        .section { margin-bottom: 15px; }
        .section-title { background: #e9ecef; padding: 6px 12px; font-weight: bold; font-size: 11pt; 
                         color: #495057; border-left: 4px solid #dc3545; margin-bottom: 10px; }
        .section-content { padding: 0 12px; }
        .finding-item { margin-bottom: 10px; }
        .finding-label { font-weight: 600; color: #495057; display: block; margin-bottom: 3px; }
        .finding-value { color: #212529; }
        .impression-box { background: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; 
                          padding: 12px; margin: 15px 0; }
        .impression-title { font-weight: bold; color: #856404; margin-bottom: 8px; font-size: 11pt; }
        .impression-content { color: #533f03; line-height: 1.6; }
        .report-footer { margin-top: 30px; border-top: 2px solid #dee2e6; padding-top: 15px; }
        .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
        .signature-block { text-align: center; min-width: 200px; }
        .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
        .doctor-name { font-weight: bold; font-size: 11pt; }
        .doctor-qual { font-size: 9pt; color: #666; }
        .disclaimer { font-size: 8pt; color: #888; text-align: center; margin-top: 20px; 
                      padding: 10px; background: #f8f9fa; border-radius: 3px; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <div class="hospital-info">
                <div class="hospital-name">{$hospital['hospital_name']}</div>
                <div class="hospital-address">{$hospital['hospital_address']}</div>
                <div class="hospital-contact">
                    Phone: {$hospital['hospital_phone']} | Email: {$hospital['hospital_email']}
                </div>
            </div>
            <div class="report-title">CHEST X-RAY REPORT</div>
        </div>
        
        <div class="patient-info">
            <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span class="info-value">{$templateData['patient_name']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Age/Sex:</span>
                <span class="info-value">{$templateData['patient_age']} / {$templateData['patient_sex']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Patient ID:</span>
                <span class="info-value">{$templateData['patient_id']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Exam Date:</span>
                <span class="info-value">{$templateData['exam_date']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Ref. Physician:</span>
                <span class="info-value">{$templateData['referring_physician']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Clinical History:</span>
                <span class="info-value">{$templateData['clinical_history']}</span>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">TECHNIQUE</div>
            <div class="section-content">
                <p>{$templateData['technique']}</p>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">FINDINGS</div>
            <div class="section-content">
HTML;

    // Add findings
    $findingLabels = [
        'lungs' => 'Lungs',
        'heart' => 'Heart',
        'mediastinum' => 'Mediastinum',
        'bones' => 'Bones',
        'soft_tissues' => 'Soft Tissues',
        'costophrenic_angles' => 'Costophrenic Angles',
        'diaphragm' => 'Diaphragm'
    ];
    
    foreach ($findings as $key => $value) {
        $label = $findingLabels[$key] ?? ucfirst(str_replace('_', ' ', $key));
        $html .= <<<FINDING
                <div class="finding-item">
                    <span class="finding-label">{$label}:</span>
                    <span class="finding-value">{$value}</span>
                </div>
FINDING;
    }
    
    $html .= <<<HTML
            </div>
        </div>
        
        <div class="impression-box">
            <div class="impression-title">IMPRESSION</div>
            <div class="impression-content">{$templateData['impression']}</div>
        </div>
        
        <div class="report-footer">
            <div class="signature-section">
                <div class="signature-block">
                    <div class="signature-line">
                        <div class="doctor-name">{$hospital['doctor_name']}</div>
                        <div class="doctor-qual">{$hospital['doctor_qualification']}</div>
                        <div class="doctor-qual">Reg. No: {$hospital['doctor_registration']}</div>
                    </div>
                </div>
                <div class="signature-block">
                    <div style="text-align: right; font-size: 9pt; color: #666;">
                        Report Generated: {$reportDate} {$reportTime}
                    </div>
                </div>
            </div>
            
            <div class="disclaimer">
                This report should be correlated with clinical findings and history.
                Please consult your healthcare provider for interpretation.
            </div>
        </div>
    </div>
</body>
</html>
HTML;

    // Generate text version
    $text = "CHEST X-RAY REPORT\n";
    $text .= str_repeat("=", 60) . "\n\n";
    $text .= "Patient: {$templateData['patient_name']}\n";
    $text .= "Age/Sex: {$templateData['patient_age']} / {$templateData['patient_sex']}\n";
    $text .= "Date: {$templateData['exam_date']}\n\n";
    $text .= "TECHNIQUE: {$templateData['technique']}\n\n";
    $text .= "FINDINGS:\n";
    foreach ($findings as $key => $value) {
        $label = $findingLabels[$key] ?? ucfirst(str_replace('_', ' ', $key));
        $text .= "- {$label}: {$value}\n";
    }
    $text .= "\nIMPRESSION: {$templateData['impression']}\n";
    
    return [
        'html' => $html,
        'text' => $text,
        'template_data' => $templateData
    ];
}
