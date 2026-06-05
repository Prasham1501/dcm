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
            if ($type === 'referring_doctors') {
                $name = val($row, ['name', 'doctor_name', 'referring_doctor']);
                if ($name === '') { $skipped++; continue; }
                $doctorRepo->create([
                    'name' => $name,
                    'phone' => val($row, ['phone', 'mobile']),
                    'email' => val($row, ['email']),
                    'registration_no' => val($row, ['registration_no', 'reg_no']),
                    'clinic_name' => val($row, ['clinic_name', 'clinic']),
                    'address' => val($row, ['address']),
                ]);
            } else {
                $name = val($row, ['full_name', 'name', 'patient_name', 'first_name']);
                if ($name === '') { $skipped++; continue; }
                $patientRepo->create([
                    'name_prefix' => val($row, ['prefix']),
                    'full_name' => $name,
                    'last_name' => val($row, ['last_name', 'surname']),
                    'phone' => val($row, ['phone', 'mobile']),
                    'alt_phone' => val($row, ['alt_phone', 'alternate_phone']),
                    'dob' => val($row, ['dob', 'birthdate', 'birth_date']),
                    'email' => val($row, ['email']),
                    'sex' => val($row, ['sex', 'gender']),
                    'address_line1' => val($row, ['address_1', 'address1', 'address_line1']),
                    'address_line2' => val($row, ['address_2', 'address2', 'address_line2']),
                    'address_line3' => val($row, ['address_3', 'address3', 'address_line3']),
                    'city' => val($row, ['city']),
                    'state' => val($row, ['state']),
                    'id_proof_type' => val($row, ['id_proof_type', 'id_type']) ?: (val($row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_card_no']) ? 'aadhaar' : ''),
                    'id_proof_number' => val($row, ['id_proof_number', 'id_number']) ?: val($row, ['aadhaar', 'aadhaar_number', 'aadhar', 'aadhar_card_no']),
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
