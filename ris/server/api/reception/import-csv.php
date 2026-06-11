<?php
/**
 * CSV import for patient and referring doctor master data.
 * Excel users can Save As CSV and upload here.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisPatientRepository.php';
require_once __DIR__ . '/../../includes/ris/RisReferringDoctorRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

function keynorm(string $s): string {
    return strtolower(preg_replace('/[^a-z0-9]+/i', '_', trim($s)));
}

function val(array $row, array $names): string {
    foreach ($names as $name) {
        $key = keynorm($name);
        if (isset($row[$key]) && trim((string)$row[$key]) !== '') {
            return trim((string)$row[$key]);
        }
    }
    return '';
}

try {
    $type = $_POST['type'] ?? 'patients';
    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        sendErrorResponse('CSV file is required', 400);
    }
    $fh = fopen($_FILES['file']['tmp_name'], 'r');
    if (!$fh) { sendErrorResponse('Could not read uploaded CSV', 400); }

    $headers = fgetcsv($fh);
    if (!$headers) { sendErrorResponse('CSV header row is required', 400); }
    $headerKeys = array_map('keynorm', $headers);

    $db = getDbConnection();
    $patientRepo = new RisPatientRepository($db, new RisCounters($db));
    $doctorRepo = new RisReferringDoctorRepository($db);
    $created = 0;
    $skipped = 0;
    $errors = [];

    while (($cols = fgetcsv($fh)) !== false) {
        $row = [];
        foreach ($headerKeys as $i => $key) { $row[$key] = $cols[$i] ?? ''; }
        try {
            if ($type === 'referring_doctors' || $type === 'consultants') {
                $name = val($row, ['name', 'doctor_name', 'referring_doctor', 'consultant']);
                if ($name === '') { $skipped++; continue; }
                $docType = strtolower(val($row, ['doctor_type', 'type']));
                if ($type === 'consultants') { $docType = 'consultant'; }
                if (!in_array($docType, ['gp', 'consultant', 'both'], true)) { $docType = 'gp'; }
                $doctorRepo->create([
                    'name' => $name,
                    'doctor_type' => $docType,
                    'phone' => val($row, ['phone', 'mobile']),
                    'email' => val($row, ['email']),
                    'registration_no' => val($row, ['registration_no', 'reg_no']),
                    'clinic_name' => val($row, ['clinic_name', 'clinic']),
                    'address' => val($row, ['address']),
                ]);
            } elseif ($type === 'centers') {
                $name = val($row, ['name', 'center', 'center_name']);
                if ($name === '') { $skipped++; continue; }
                $code = strtoupper(val($row, ['code', 'center_code'])) ?: (strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'CTR', 0, 8)) . rand(10, 99));
                $billing = strtolower(val($row, ['billing_type', 'billing'])) === 'credit' ? 'credit' : 'debit';
                $stmt = $db->prepare('INSERT INTO ris_centers (code, name, billing_type, contact_person, phone, email, address, discount_percent) VALUES (?,?,?,?,?,?,?,?)');
                $contact = val($row, ['contact_person', 'contact']);
                $phone = val($row, ['phone', 'mobile']);
                $email = val($row, ['email']);
                $addr = val($row, ['address']);
                $disc = (float)val($row, ['discount_percent', 'discount']);
                $stmt->bind_param('sssssssd', $code, $name, $billing, $contact, $phone, $email, $addr, $disc);
                $stmt->execute();
                $stmt->close();
            } elseif ($type === 'pros') {
                $name = val($row, ['name', 'pro', 'pro_name']);
                if ($name === '') { $skipped++; continue; }
                $phone = val($row, ['phone', 'mobile']);
                $ctype = strtolower(val($row, ['commission_type'])); if (!in_array($ctype, ['none','percent','flat'], true)) { $ctype = 'none'; }
                $cval = (float)val($row, ['commission_value', 'commission']);
                $stmt = $db->prepare('INSERT INTO ris_pros (name, phone, commission_type, commission_value) VALUES (?,?,?,?)');
                $stmt->bind_param('sssd', $name, $phone, $ctype, $cval);
                $stmt->execute();
                $stmt->close();
            } elseif (in_array($type, ['staff', 'areas', 'patient_groups', 'dispatch_modes', 'lookups'], true)) {
                $category = $type === 'staff' ? 'phlebotomy_staff'
                    : ($type === 'areas' ? 'home_visit_area'
                    : ($type === 'patient_groups' ? 'patient_group'
                    : ($type === 'dispatch_modes' ? 'dispatch_mode'
                    : val($row, ['category']))));
                $value = val($row, ['value', 'name', 'staff', 'area', 'group']);
                if ($category === '' || $value === '') { $skipped++; continue; }
                $sort = (int)val($row, ['sort_order', 'sort']);
                $stmt = $db->prepare('INSERT INTO ris_lookups (category, value, sort_order) VALUES (?,?,?) ON DUPLICATE KEY UPDATE is_active = 1');
                $stmt->bind_param('ssi', $category, $value, $sort);
                $stmt->execute();
                $stmt->close();
            } elseif ($type === 'services') {
                $name = val($row, ['name', 'test', 'service', 'test_name']);
                if ($name === '') { $skipped++; continue; }
                $code = strtoupper(val($row, ['code'])) ?: (strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'TST', 0, 10)) . rand(100, 999));
                $modality = strtoupper(val($row, ['modality'])) ?: 'OTHER';
                $price = (float)val($row, ['price', 'rate']);
                $dept = val($row, ['department', 'dept']);
                $family = val($row, ['family', 'group']);
                $labName = val($row, ['lab_name', 'lab', 'outsource_lab']);
                $sampleType = val($row, ['sample_type', 'sample']);
                $tubeType = val($row, ['tube_type', 'tube']);
                $tubeCount = max(1, (int)val($row, ['tube_count']) ?: 1);
                $labelCount = max(1, (int)val($row, ['barcode_label_count', 'label_count']) ?: 1);
                $stmt = $db->prepare('INSERT INTO ris_services (code, name, modality, price, department, family, lab_name, sample_type, tube_type, tube_count, barcode_label_count) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), department=VALUES(department), family=VALUES(family), lab_name=VALUES(lab_name)');
                $stmt->bind_param('sssdsssssii', $code, $name, $modality, $price, $dept, $family, $labName, $sampleType, $tubeType, $tubeCount, $labelCount);
                $stmt->execute();
                $stmt->close();
            } elseif ($type === 'test_parameters') {
                // Resolve the test (service) by code or name.
                $svcCode = strtoupper(val($row, ['service_code', 'test_code', 'code']));
                $svcName = val($row, ['service', 'test', 'service_name', 'test_name']);
                $serviceId = 0;
                if ($svcCode !== '') {
                    $s = $db->prepare('SELECT id FROM ris_services WHERE code = ? LIMIT 1');
                    $s->bind_param('s', $svcCode); $s->execute();
                    $sr = $s->get_result()->fetch_assoc(); $s->close();
                    $serviceId = $sr ? (int)$sr['id'] : 0;
                }
                if ($serviceId === 0 && $svcName !== '') {
                    $s = $db->prepare('SELECT id FROM ris_services WHERE name = ? LIMIT 1');
                    $s->bind_param('s', $svcName); $s->execute();
                    $sr = $s->get_result()->fetch_assoc(); $s->close();
                    $serviceId = $sr ? (int)$sr['id'] : 0;
                }
                $pname = val($row, ['parameter', 'parameter_name', 'analyte', 'name']);
                if ($serviceId === 0 || $pname === '') { $skipped++; continue; }
                $unit = val($row, ['unit', 'units']);
                $formula = val($row, ['formula']);
                $inputType = strtolower(val($row, ['input_type', 'type'])); if (!in_array($inputType, ['numeric','text','select'], true)) { $inputType = 'numeric'; }
                $isHeading = in_array(strtolower(val($row, ['is_heading', 'heading'])), ['1','yes','y','true'], true) ? 1 : 0;
                $sortOrder = (int)val($row, ['sort_order', 'sort']);
                $stmt = $db->prepare('INSERT INTO ris_test_parameters (service_id, name, unit, input_type, formula, sort_order, is_heading) VALUES (?,?,?,?,?,?,?)');
                $stmt->bind_param('issssii', $serviceId, $pname, $unit, $inputType, $formula, $sortOrder, $isHeading);
                $stmt->execute();
                $paramId = $stmt->insert_id;
                $stmt->close();
                $low = val($row, ['low', 'min', 'low_normal']);
                $high = val($row, ['high', 'max', 'high_normal']);
                $normalText = val($row, ['normal_text', 'normal', 'reference', 'range']);
                $sex = strtolower(val($row, ['sex', 'gender'])); if (!in_array($sex, ['any','male','female'], true)) { $sex = 'any'; }
                if ($low !== '' || $high !== '' || $normalText !== '') {
                    $lowV = $low === '' ? null : (float)$low;
                    $highV = $high === '' ? null : (float)$high;
                    $normV = $normalText === '' ? null : $normalText;
                    $rs = $db->prepare('INSERT INTO ris_test_ref_ranges (parameter_id, sex, age_min_days, age_max_days, low, high, normal_text) VALUES (?,?,0,54750,?,?,?)');
                    $rs->bind_param('isdds', $paramId, $sex, $lowV, $highV, $normV);
                    $rs->execute();
                    $rs->close();
                }
            } else {
                $name = val($row, ['full_name', 'name', 'patient_name', 'first_name']);
                if ($name === '') { $skipped++; continue; }
                $patientRepo->create([
                    'mrn' => val($row, ['mrn', 'patient_id', 'uhid']),
                    'name_prefix' => val($row, ['prefix', 'title']),
                    'full_name' => $name,
                    'last_name' => val($row, ['last_name', 'surname']),
                    'phone' => val($row, ['phone', 'mobile']),
                    'alt_phone' => val($row, ['alt_phone', 'alternate_phone']),
                    'dob' => val($row, ['dob', 'birthdate', 'birth_date']),
                    'age_years' => val($row, ['age', 'age_years', 'years']),
                    'age_months' => val($row, ['age_months', 'months']),
                    'age_days' => val($row, ['age_days', 'days']),
                    'email' => val($row, ['email']),
                    'sex' => val($row, ['sex', 'gender']),
                    'patient_group' => val($row, ['patient_group', 'group', 'type']),
                    'husband_or_father_name' => val($row, ['husband_or_father_name', 'father_name', 'husband_name', 'guardian']),
                    'address_line1' => val($row, ['address_1', 'address1', 'address_line1', 'address']),
                    'address_line2' => val($row, ['address_2', 'address2', 'address_line2']),
                    'address_line3' => val($row, ['address_3', 'address3', 'address_line3']),
                    'city' => val($row, ['city']),
                    'state' => val($row, ['state']),
                    'id_proof_type' => val($row, ['id_proof_type', 'id_type']) ?: (val($row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_card_no']) ? 'aadhaar' : ''),
                    'id_proof_number' => val($row, ['id_proof_number', 'id_number']) ?: val($row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_card_no']),
                    'aadhaar_number' => val($row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_card_no']),
                ]);
            }
            $created++;
        } catch (Throwable $e) {
            $errors[] = $e->getMessage();
        }
    }
    fclose($fh);
    sendSuccessResponse(['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)], 'CSV import complete');
} catch (Throwable $e) {
    logMessage('RIS CSV import error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
