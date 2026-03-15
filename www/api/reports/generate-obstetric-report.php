<?php
/**
 * Generate Obstetric USG Report from AI Analysis
 * Combines AI-extracted biometry data with professional report template
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
    $aiAnalysisId = $input['ai_analysis_id'] ?? null;
    $biometry = $input['biometry'] ?? [];
    $patientName = $input['patient_name'] ?? '';
    $patientAge = $input['patient_age'] ?? '';
    $patientId = $input['patient_id'] ?? '';
    $referringPhysician = $input['referring_physician'] ?? '';
    $lmp = $input['lmp'] ?? '';
    $clinicalHistory = $input['clinical_history'] ?? '';
    $examDate = $input['exam_date'] ?? date('Y-m-d');
    
    // Get selected image if specified
    $selectedImageId = $input['selected_image_id'] ?? null;
    
    $db = getDbConnection();
    
    // Get hospital config
    $hospitalConfig = getHospitalConfig($db);
    
    // Get AI analysis data if ID provided
    $aiData = null;
    if ($aiAnalysisId) {
        $stmt = $db->prepare("SELECT * FROM ai_analysis WHERE id = ?");
        $stmt->bind_param("i", $aiAnalysisId);
        $stmt->execute();
        $result = $stmt->get_result();
        $aiData = $result->fetch_assoc();
        $stmt->close();
        
        if ($aiData) {
            // Parse JSON fields
            $aiData['findings_parsed'] = json_decode($aiData['findings'], true) ?? [];
            $aiData['measurements_parsed'] = json_decode($aiData['measurements'], true) ?? [];
        }
    }
    
    // Generate report content
    $reportContent = generateObstetricReport($biometry, $aiData, [
        'patient_name' => $patientName,
        'patient_age' => $patientAge,
        'patient_id' => $patientId,
        'referring_physician' => $referringPhysician,
        'lmp' => $lmp,
        'clinical_history' => $clinicalHistory,
        'exam_date' => $examDate,
        'hospital' => $hospitalConfig
    ]);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'report_html' => $reportContent['html'],
            'report_text' => $reportContent['text'],
            'template_data' => $reportContent['template_data'],
            'biometry_summary' => $reportContent['biometry_summary'],
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

function generateObstetricReport($biometry, $aiData, $context) {
    $hospital = $context['hospital'];
    $patientName = $context['patient_name'];
    $patientAge = $context['patient_age'];
    $patientId = $context['patient_id'];
    $examDate = $context['exam_date'];
    $lmp = $context['lmp'];
    $referringPhysician = $context['referring_physician'];
    $clinicalHistory = $context['clinical_history'];
    
    // Extract biometry values
    $fl = $biometry['FL'] ?? null;
    $ac = $biometry['AC'] ?? null;
    $bpd = $biometry['BPD'] ?? null;
    $hc = $biometry['HC'] ?? null;
    $efw = $biometry['EFW'] ?? null;
    $ga = $biometry['GA'] ?? null;
    $edd = $biometry['EDD'] ?? null;
    $crl = $biometry['CRL'] ?? null;
    
    // Calculate average GA from measurements
    $gaValues = [];
    if (isset($fl['ga'])) $gaValues[] = parseGA($fl['ga']);
    if (isset($ac['ga'])) $gaValues[] = parseGA($ac['ga']);
    if (isset($bpd['ga'])) $gaValues[] = parseGA($bpd['ga']);
    if (isset($hc['ga'])) $gaValues[] = parseGA($hc['ga']);
    
    $avgGA = !empty($gaValues) ? array_sum($gaValues) / count($gaValues) : null;
    $avgGAStr = $avgGA ? formatGA($avgGA) : ($ga['value'] ?? 'N/A');
    
    // Build biometry summary
    $biometrySummary = [];
    if ($bpd && isset($bpd['value'])) {
        $biometrySummary['BPD'] = [
            'label' => 'Biparietal Diameter',
            'value' => $bpd['value'],
            'ga' => $bpd['ga'] ?? null,
            'percentile' => $bpd['percentile'] ?? null
        ];
    }
    if ($hc && isset($hc['value'])) {
        $biometrySummary['HC'] = [
            'label' => 'Head Circumference',
            'value' => $hc['value'],
            'ga' => $hc['ga'] ?? null,
            'percentile' => $hc['percentile'] ?? null
        ];
    }
    if ($ac && isset($ac['value'])) {
        $biometrySummary['AC'] = [
            'label' => 'Abdominal Circumference',
            'value' => $ac['value'],
            'ga' => $ac['ga'] ?? null,
            'percentile' => $ac['percentile'] ?? null
        ];
    }
    if ($fl && isset($fl['value'])) {
        $biometrySummary['FL'] = [
            'label' => 'Femur Length',
            'value' => $fl['value'],
            'ga' => $fl['ga'] ?? null,
            'percentile' => $fl['percentile'] ?? null
        ];
    }
    if ($efw && isset($efw['value'])) {
        $biometrySummary['EFW'] = [
            'label' => 'Estimated Fetal Weight',
            'value' => $efw['value'],
            'sd' => $efw['sd'] ?? null
        ];
    }
    
    // Template data for form fields
    $templateData = [
        'patient_name' => $patientName,
        'patient_age' => $patientAge,
        'patient_id' => $patientId,
        'exam_date' => $examDate,
        'lmp' => $lmp,
        'referring_physician' => $referringPhysician,
        'clinical_history' => $clinicalHistory ?: 'Routine antenatal scan',
        
        // Biometry
        'bpd_value' => $bpd['value'] ?? '',
        'bpd_ga' => $bpd['ga'] ?? '',
        'hc_value' => $hc['value'] ?? '',
        'hc_ga' => $hc['ga'] ?? '',
        'ac_value' => $ac['value'] ?? '',
        'ac_ga' => $ac['ga'] ?? '',
        'fl_value' => $fl['value'] ?? '',
        'fl_ga' => $fl['ga'] ?? '',
        'crl_value' => $crl['value'] ?? '',
        'efw_value' => $efw['value'] ?? '',
        'efw_sd' => $efw['sd'] ?? '',
        
        // Calculated
        'average_ga' => $avgGAStr,
        'edd_value' => $edd['value'] ?? '',
        
        // Findings (defaults for normal pregnancy)
        'fetal_number' => 'Single',
        'fetal_presentation' => 'Cephalic',
        'fetal_position' => 'Longitudinal lie',
        'fetal_heart_rate' => 'Present, regular',
        'fetal_movements' => 'Present',
        
        'placenta_location' => 'Fundal/Anterior/Posterior',
        'placenta_grade' => 'Grade I',
        'placenta_previa' => 'Excluded',
        
        'amniotic_fluid' => 'Adequate',
        'afi' => '',
        
        'cervix_length' => '',
        'cervix_os' => 'Closed',
        
        // Anatomy checklist
        'head_shape' => 'Normal',
        'ventricles' => 'Normal',
        'cerebellum' => 'Normal',
        'cisterna_magna' => 'Normal',
        'spine' => 'Normal',
        'heart_chambers' => 'Four chambers seen',
        'stomach' => 'Normal',
        'kidneys' => 'Both seen',
        'bladder' => 'Seen',
        'cord_insertion' => 'Normal',
        'cord_vessels' => 'Three vessel cord',
        'limbs' => 'Normal',
        
        // Impression
        'impression' => "Single live intrauterine pregnancy.\nGestational age by biometry: {$avgGAStr}.\nEstimated fetal weight: " . ($efw['value'] ?? 'N/A') . ".\nNo gross fetal anomaly detected.\nAdequate liquor.\nNormal placentation."
    ];
    
    // Generate HTML report
    $html = generateReportHTML($templateData, $hospital, $biometrySummary);
    
    // Generate plain text report
    $text = generateReportText($templateData, $hospital, $biometrySummary);
    
    return [
        'html' => $html,
        'text' => $text,
        'template_data' => $templateData,
        'biometry_summary' => $biometrySummary
    ];
}

function parseGA($gaStr) {
    // Parse gestational age string like "36w4d" to days
    if (preg_match('/(\d+)w(\d+)d/i', $gaStr, $m)) {
        return (intval($m[1]) * 7) + intval($m[2]);
    }
    return null;
}

function formatGA($days) {
    $weeks = floor($days / 7);
    $remainingDays = $days % 7;
    return "{$weeks}w{$remainingDays}d";
}

function generateReportHTML($data, $hospital, $biometry) {
    $reportDate = date('d/m/Y', strtotime($data['exam_date']));
    $reportTime = date('H:i');
    
    $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Obstetric Ultrasound Report</title>
    <style>
        @page {
            size: A4;
            margin: 15mm;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #333;
            background: #fff;
        }
        
        .report-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 10mm;
        }
        
        /* Header Styles */
        .report-header {
            border-bottom: 3px solid #0d6efd;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }
        
        .hospital-info {
            text-align: center;
            margin-bottom: 10px;
        }
        
        .hospital-name {
            font-size: 20pt;
            font-weight: bold;
            color: #0d6efd;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .hospital-address {
            font-size: 10pt;
            color: #666;
            margin-top: 5px;
        }
        
        .hospital-contact {
            font-size: 9pt;
            color: #888;
        }
        
        .report-title {
            background: linear-gradient(135deg, #0d6efd 0%, #0056b3 100%);
            color: white;
            text-align: center;
            padding: 10px;
            font-size: 14pt;
            font-weight: bold;
            margin: 10px 0;
            border-radius: 5px;
        }
        
        /* Patient Info Section */
        .patient-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: #f8f9fa;
            padding: 12px;
            border-radius: 5px;
            margin-bottom: 15px;
            border: 1px solid #dee2e6;
        }
        
        .info-row {
            display: flex;
            align-items: baseline;
        }
        
        .info-label {
            font-weight: 600;
            color: #495057;
            min-width: 120px;
            font-size: 10pt;
        }
        
        .info-value {
            color: #212529;
            font-size: 10pt;
        }
        
        /* Section Styles */
        .section {
            margin-bottom: 15px;
        }
        
        .section-title {
            background: #e9ecef;
            padding: 6px 12px;
            font-weight: bold;
            font-size: 11pt;
            color: #495057;
            border-left: 4px solid #0d6efd;
            margin-bottom: 10px;
        }
        
        .section-content {
            padding: 0 12px;
        }
        
        /* Biometry Table */
        .biometry-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10pt;
        }
        
        .biometry-table th {
            background: #0d6efd;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
        }
        
        .biometry-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .biometry-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .biometry-table .measurement-name {
            font-weight: 600;
            color: #495057;
        }
        
        .biometry-table .measurement-value {
            font-weight: bold;
            color: #0d6efd;
        }
        
        .biometry-table .ga-value {
            color: #28a745;
        }
        
        .biometry-table .percentile {
            color: #6c757d;
            font-size: 9pt;
        }
        
        /* Findings Grid */
        .findings-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 10pt;
        }
        
        .finding-item {
            display: flex;
            padding: 4px 0;
        }
        
        .finding-label {
            font-weight: 500;
            color: #495057;
            min-width: 130px;
        }
        
        .finding-value {
            color: #212529;
        }
        
        /* Anatomy Checklist */
        .anatomy-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
            font-size: 9pt;
        }
        
        .anatomy-item {
            display: flex;
            align-items: center;
            padding: 3px 0;
        }
        
        .check-icon {
            color: #28a745;
            margin-right: 5px;
            font-weight: bold;
        }
        
        /* Impression Box */
        .impression-box {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 5px;
            padding: 12px;
            margin: 15px 0;
        }
        
        .impression-title {
            font-weight: bold;
            color: #856404;
            margin-bottom: 8px;
            font-size: 11pt;
        }
        
        .impression-content {
            color: #533f03;
            line-height: 1.6;
            white-space: pre-line;
        }
        
        /* Footer */
        .report-footer {
            margin-top: 30px;
            border-top: 2px solid #dee2e6;
            padding-top: 15px;
        }
        
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        
        .signature-block {
            text-align: center;
            min-width: 200px;
        }
        
        .signature-line {
            border-top: 1px solid #333;
            margin-top: 50px;
            padding-top: 5px;
        }
        
        .doctor-name {
            font-weight: bold;
            font-size: 11pt;
        }
        
        .doctor-qual {
            font-size: 9pt;
            color: #666;
        }
        
        .disclaimer {
            font-size: 8pt;
            color: #888;
            text-align: center;
            margin-top: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 3px;
        }
        
        .report-id {
            font-size: 8pt;
            color: #aaa;
            text-align: right;
        }
        
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            
            .report-container {
                padding: 0;
            }
            
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- Header -->
        <div class="report-header">
            <div class="hospital-info">
                <div class="hospital-name">{$hospital['hospital_name']}</div>
                <div class="hospital-address">{$hospital['hospital_address']}</div>
                <div class="hospital-contact">
                    Phone: {$hospital['hospital_phone']} | Email: {$hospital['hospital_email']}
                    {$hospital['hospital_registration']}
                </div>
            </div>
            
            <div class="report-title">OBSTETRIC ULTRASOUND REPORT</div>
        </div>
        
        <!-- Patient Information -->
        <div class="patient-info">
            <div class="info-row">
                <span class="info-label">Patient Name:</span>
                <span class="info-value">{$data['patient_name']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Age/Sex:</span>
                <span class="info-value">{$data['patient_age']} / Female</span>
            </div>
            <div class="info-row">
                <span class="info-label">Patient ID:</span>
                <span class="info-value">{$data['patient_id']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Exam Date:</span>
                <span class="info-value">{$reportDate}</span>
            </div>
            <div class="info-row">
                <span class="info-label">LMP:</span>
                <span class="info-value">{$data['lmp']}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Ref. Physician:</span>
                <span class="info-value">{$data['referring_physician']}</span>
            </div>
            <div class="info-row" style="grid-column: span 2;">
                <span class="info-label">Clinical History:</span>
                <span class="info-value">{$data['clinical_history']}</span>
            </div>
        </div>
        
        <!-- Fetal Biometry -->
        <div class="section">
            <div class="section-title">FETAL BIOMETRY</div>
            <table class="biometry-table">
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th>Measurement</th>
                        <th>Gestational Age</th>
                        <th>Percentile</th>
                    </tr>
                </thead>
                <tbody>
HTML;

    // Add biometry rows
    $biometryParams = [
        ['BPD', 'Biparietal Diameter', $data['bpd_value'], $data['bpd_ga']],
        ['HC', 'Head Circumference', $data['hc_value'], $data['hc_ga']],
        ['AC', 'Abdominal Circumference', $data['ac_value'], $data['ac_ga']],
        ['FL', 'Femur Length', $data['fl_value'], $data['fl_ga']]
    ];
    
    foreach ($biometryParams as $param) {
        $percentile = isset($biometry[$param[0]]['percentile']) ? $biometry[$param[0]]['percentile'] : '-';
        $html .= <<<ROW
                    <tr>
                        <td class="measurement-name">{$param[0]} ({$param[1]})</td>
                        <td class="measurement-value">{$param[2]}</td>
                        <td class="ga-value">{$param[3]}</td>
                        <td class="percentile">{$percentile}</td>
                    </tr>
ROW;
    }
    
    $html .= <<<HTML
                </tbody>
            </table>
            
            <div class="findings-grid">
                <div class="finding-item">
                    <span class="finding-label">Average GA:</span>
                    <span class="finding-value" style="font-weight: bold; color: #0d6efd;">{$data['average_ga']}</span>
                </div>
                <div class="finding-item">
                    <span class="finding-label">EDD:</span>
                    <span class="finding-value" style="font-weight: bold; color: #28a745;">{$data['edd_value']}</span>
                </div>
                <div class="finding-item">
                    <span class="finding-label">EFW:</span>
                    <span class="finding-value" style="font-weight: bold;">{$data['efw_value']} {$data['efw_sd']}</span>
                </div>
            </div>
        </div>
        
        <!-- Fetal Parameters -->
        <div class="section">
            <div class="section-title">FETAL PARAMETERS</div>
            <div class="section-content">
                <div class="findings-grid">
                    <div class="finding-item">
                        <span class="finding-label">Fetal Number:</span>
                        <span class="finding-value">{$data['fetal_number']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Presentation:</span>
                        <span class="finding-value">{$data['fetal_presentation']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Position:</span>
                        <span class="finding-value">{$data['fetal_position']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Fetal Heart:</span>
                        <span class="finding-value">{$data['fetal_heart_rate']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Fetal Movements:</span>
                        <span class="finding-value">{$data['fetal_movements']}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Placenta & Liquor -->
        <div class="section">
            <div class="section-title">PLACENTA & AMNIOTIC FLUID</div>
            <div class="section-content">
                <div class="findings-grid">
                    <div class="finding-item">
                        <span class="finding-label">Placenta Location:</span>
                        <span class="finding-value">{$data['placenta_location']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Placenta Grade:</span>
                        <span class="finding-value">{$data['placenta_grade']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Placenta Previa:</span>
                        <span class="finding-value">{$data['placenta_previa']}</span>
                    </div>
                    <div class="finding-item">
                        <span class="finding-label">Amniotic Fluid:</span>
                        <span class="finding-value">{$data['amniotic_fluid']}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Fetal Anatomy -->
        <div class="section">
            <div class="section-title">FETAL ANATOMY SURVEY</div>
            <div class="section-content">
                <div class="anatomy-grid">
                    <div class="anatomy-item"><span class="check-icon">✓</span> Head Shape: {$data['head_shape']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Ventricles: {$data['ventricles']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Cerebellum: {$data['cerebellum']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Spine: {$data['spine']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Heart: {$data['heart_chambers']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Stomach: {$data['stomach']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Kidneys: {$data['kidneys']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Bladder: {$data['bladder']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Cord: {$data['cord_vessels']}</div>
                    <div class="anatomy-item"><span class="check-icon">✓</span> Limbs: {$data['limbs']}</div>
                </div>
            </div>
        </div>
        
        <!-- Impression -->
        <div class="impression-box">
            <div class="impression-title">IMPRESSION</div>
            <div class="impression-content">{$data['impression']}</div>
        </div>
        
        <!-- Footer -->
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
                This report is computer generated with AI-assisted analysis. All findings should be clinically correlated.
                This is not a substitute for professional medical advice. Please consult your healthcare provider.
            </div>
        </div>
    </div>
</body>
</html>
HTML;

    return $html;
}

function generateReportText($data, $hospital, $biometry) {
    $reportDate = date('d/m/Y', strtotime($data['exam_date']));
    
    $text = <<<TEXT
{$hospital['hospital_name']}
{$hospital['hospital_address']}
Phone: {$hospital['hospital_phone']}

================================================================================
                        OBSTETRIC ULTRASOUND REPORT
================================================================================

Patient Name: {$data['patient_name']}
Age/Sex: {$data['patient_age']} / Female
Patient ID: {$data['patient_id']}
Exam Date: {$reportDate}
LMP: {$data['lmp']}
Referring Physician: {$data['referring_physician']}
Clinical History: {$data['clinical_history']}

--------------------------------------------------------------------------------
FETAL BIOMETRY
--------------------------------------------------------------------------------
Parameter                    Measurement      GA              Percentile
BPD (Biparietal Diameter)    {$data['bpd_value']}           {$data['bpd_ga']}
HC (Head Circumference)      {$data['hc_value']}            {$data['hc_ga']}
AC (Abdominal Circumference) {$data['ac_value']}            {$data['ac_ga']}
FL (Femur Length)            {$data['fl_value']}            {$data['fl_ga']}

Average Gestational Age: {$data['average_ga']}
Estimated Due Date: {$data['edd_value']}
Estimated Fetal Weight: {$data['efw_value']} {$data['efw_sd']}

--------------------------------------------------------------------------------
FETAL PARAMETERS
--------------------------------------------------------------------------------
Fetal Number: {$data['fetal_number']}
Presentation: {$data['fetal_presentation']}
Position: {$data['fetal_position']}
Fetal Heart: {$data['fetal_heart_rate']}
Fetal Movements: {$data['fetal_movements']}

--------------------------------------------------------------------------------
PLACENTA & AMNIOTIC FLUID
--------------------------------------------------------------------------------
Placenta Location: {$data['placenta_location']}
Placenta Grade: {$data['placenta_grade']}
Placenta Previa: {$data['placenta_previa']}
Amniotic Fluid: {$data['amniotic_fluid']}

--------------------------------------------------------------------------------
IMPRESSION
--------------------------------------------------------------------------------
{$data['impression']}

================================================================================

Reported by: {$hospital['doctor_name']}
{$hospital['doctor_qualification']}
Reg. No: {$hospital['doctor_registration']}

Report Date: {$reportDate}

--------------------------------------------------------------------------------
Disclaimer: This report is computer generated with AI-assisted analysis.
All findings should be clinically correlated.
================================================================================
TEXT;

    return $text;
}
