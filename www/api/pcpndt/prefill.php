<?php
/**
 * PCPNDT — prefill a Form F for the currently open study (viewer-native).
 * GET ?study_uid=<uid>[&patient_id=&patient_name=]
 * Assembles from the viewer's own data and ENRICHES from the RIS tables when
 * they exist (multi-product: works with or without the RIS installed).
 * -> { study_uid, fields, missing, options, saved, status }
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisPcpndtMapper.php';
require_once __DIR__ . '/../../includes/ris/RisPcpndtRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }

function pcOne(mysqli $db, string $sql, $param, string $type = 's'): ?array {
    $stmt = $db->prepare($sql);
    if (!$stmt) { return null; }
    $stmt->bind_param($type, $param); $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc(); $stmt->close();
    return $row ?: null;
}
function pcSetting(mysqli $db, string $key, string $default = ''): string {
    $row = pcOne($db, "SELECT setting_value FROM hospital_settings WHERE setting_key = ?", $key);
    return ($row && $row['setting_value'] !== '') ? $row['setting_value'] : $default;
}
function pcTableExists(mysqli $db, string $t): bool {
    $res = $db->query("SHOW TABLES LIKE '" . $db->real_escape_string($t) . "'");
    return $res && $res->num_rows === 1;
}
function pcAge(?string $birth, ?string $asOf): string {
    if (!$birth) { return ''; }
    $b = strtotime($birth); $a = $asOf ? strtotime($asOf) : time();
    if ($b === false || $a === false || $b > $a) { return ''; }
    return (string) (int) (($a - $b) / (365.25 * 86400));
}

try {
    $db = getDbConnection();
    $user = getCurrentUser();
    $studyUid = trim((string) ($_GET['study_uid'] ?? ''));
    $patientParam = trim((string) ($_GET['patient_id'] ?? ''));
    // The viewer usually knows the patient but not the StudyInstanceUID — resolve
    // the most recent study for that patient, and fall back to a patient-scoped key.
    if ($studyUid === '' && $patientParam !== '') {
        $s = pcOne($db, "SELECT study_instance_uid FROM cached_studies WHERE patient_id = ? ORDER BY study_date DESC, id DESC LIMIT 1", $patientParam);
        if ($s && !empty($s['study_instance_uid'])) { $studyUid = $s['study_instance_uid']; }
    }
    $formKey = $studyUid !== '' ? $studyUid : ($patientParam !== '' ? 'PID:' . $patientParam : '');
    if ($formKey === '') { sendErrorResponse('study_uid or patient_id is required', 400); }

    $f = [];

    // ---- Clinic + sonologist defaults (from PCPNDT config; fall back to hospital settings) ----
    $f['clinic_name'] = pcSetting($db, 'pcpndt_clinic_name') ?: pcSetting($db, 'hospital_name');
    $f['clinic_registration_no'] = pcSetting($db, 'pcpndt_registration_no');
    $f['clinic_address'] = pcSetting($db, 'pcpndt_clinic_address') ?: pcSetting($db, 'hospital_address');
    $f['performing_doctor'] = pcSetting($db, 'pcpndt_performing_doctor') ?: ($user['full_name'] ?? '');
    $f['performing_doctor_qualification'] = pcSetting($db, 'pcpndt_performing_doctor_qualification');
    $f['performing_doctor_reg_no'] = pcSetting($db, 'pcpndt_performing_doctor_reg_no');
    $f['basis_of_diagnosis'] = pcSetting($db, 'pcpndt_default_basis');

    // ---- Study + patient from the viewer cache ----
    $study = pcOne($db, "SELECT * FROM cached_studies WHERE study_instance_uid = ?", $studyUid);
    $dicomPatientId = $study['patient_id'] ?? ($_GET['patient_id'] ?? null);
    $studyDate = $study['study_date'] ?? null;
    if ($study) {
        $f['ref_no'] = $study['accession_number'] ?: '';
        $f['procedure_date'] = $studyDate ?: '';
    }
    if ($dicomPatientId) {
        $cp = pcOne($db, "SELECT * FROM cached_patients WHERE patient_id = ?", $dicomPatientId);
        if ($cp) {
            $f['patient_name'] = $cp['patient_name'] ?: ($_GET['patient_name'] ?? '');
            $f['patient_age'] = pcAge($cp['patient_birth_date'] ?? null, $studyDate);
        }
    }
    if (empty($f['patient_name'])) { $f['patient_name'] = (string) ($_GET['patient_name'] ?? ''); }

    // ---- Obstetric examination (fetal module — present in the viewer) ----
    $exam = pcOne($db, "SELECT * FROM examinations WHERE study_uid = ? ORDER BY id DESC LIMIT 1", $studyUid);
    if (!$exam && $dicomPatientId) {
        $exam = pcOne($db, "SELECT * FROM examinations WHERE patient_id = ? ORDER BY id DESC LIMIT 1", $dicomPatientId);
    }
    if ($exam) {
        $f['lmp_date'] = $exam['lmp_date'] ?: '';
        $f['edd'] = $exam['edd'] ?: '';
        if (($exam['gestational_age_weeks'] ?? '') !== '') { $f['gestational_age_weeks'] = $exam['gestational_age_weeks']; }
        $hist = $exam['obstetric_history'] ? json_decode($exam['obstetric_history'], true) : null;
        if (is_array($hist)) {
            foreach (['living_children', 'living', 'para'] as $k) {
                if (isset($hist[$k]) && $hist[$k] !== '') { $f['num_living_children'] = (string) $hist[$k]; break; }
            }
        }
        if (!empty($exam['examination_id'])) { $f['examination_id'] = (int) $exam['id']; }
        else { $f['examination_id'] = (int) $exam['id']; }
    }

    // ---- Report (referring + reporting physician) ----
    $rep = pcOne($db, "SELECT * FROM medical_reports WHERE study_uid = ? ORDER BY id DESC LIMIT 1", $studyUid);
    if ($rep) {
        if (!empty($rep['referring_physician'])) { $f['referring_doctor'] = $rep['referring_physician']; }
        if (!empty($rep['reporting_physician_name'])) { $f['performing_doctor'] = $rep['reporting_physician_name']; }
    }

    // ---- RIS enrichment (optional — only if the RIS is installed) ----
    if (pcTableExists($db, 'ris_orders') && pcTableExists($db, 'ris_patients')) {
        $order = null;
        $stmt = $db->prepare("SELECT * FROM ris_orders WHERE linked_study_uid = ? OR study_instance_uid = ? ORDER BY id DESC LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('ss', $studyUid, $studyUid); $stmt->execute();
            $order = $stmt->get_result()->fetch_assoc(); $stmt->close();
        }
        if ($order) {
            $f['order_id'] = (int) $order['id'];
            $f['visit_id'] = (int) $order['visit_id'];
            $rp = pcOne($db, "SELECT * FROM ris_patients WHERE id = ?", (int) $order['patient_id'], 'i');
            if ($rp) {
                $f['husband_or_father_name'] = $f['husband_or_father_name'] ?? null ?: ($rp['husband_or_father_name'] ?: '');
                $f['full_address'] = $rp['address'] ?: ($f['full_address'] ?? '');
                $f['phone'] = $rp['phone'] ?: '';
                $f['id_proof_type'] = $rp['id_proof_type'] ?: '';
                $f['id_proof_number'] = $rp['id_proof_number'] ?: '';
                if (empty($f['patient_name'])) { $f['patient_name'] = $rp['full_name'] ?: ''; }
                if (empty($f['patient_age']) && !empty($rp['age_years'])) { $f['patient_age'] = (string) $rp['age_years']; }
            }
            $rd = pcOne($db, "SELECT rd.name, rd.registration_no, rd.address FROM ris_visits v
                              LEFT JOIN ris_referring_doctors rd ON v.referring_doctor_id = rd.id WHERE v.id = ?",
                (int) $order['visit_id'], 'i');
            if ($rd && !empty($rd['name'])) {
                if (empty($f['referring_doctor'])) { $f['referring_doctor'] = $rd['name']; }
                $f['referring_doctor_reg_no'] = $rd['registration_no'] ?: '';
                $f['referring_doctor_address'] = $rd['address'] ?: '';
            }
        }
    }

    // Default referring doctor from config, only if not derived from report/RIS.
    if (empty($f['referring_doctor'])) {
        $f['referring_doctor'] = pcSetting($db, 'pcpndt_default_referring_doctor');
    }

    // ---- Overlay any previously-saved Form F (doctor edits win) ----
    $repo = new RisPcpndtRepository($db);
    $saved = $repo->getByStudy($formKey);
    if ($saved) {
        foreach (RisPcpndtMapper::FIELDS as $k) {
            if (isset($saved[$k]) && $saved[$k] !== null && $saved[$k] !== '') {
                if (in_array($k, ['indications', 'procedures'], true)) {
                    $f[$k] = json_decode($saved[$k], true) ?: [];
                } else {
                    $f[$k] = $saved[$k];
                }
            }
        }
    }

    $fields = RisPcpndtMapper::withDefaults($f);
    sendSuccessResponse([
        'study_uid' => $formKey,
        'fields' => $fields,
        'missing' => RisPcpndtMapper::missing($fields),
        'options' => RisPcpndtMapper::options(),
        'saved' => $saved !== null,
        'status' => $saved['status'] ?? 'draft',
        'ris_linked' => isset($f['order_id']),
    ]);
} catch (Throwable $e) {
    logMessage('PCPNDT prefill error: ' . $e->getMessage(), 'error', 'pcpndt.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
