<?php
/** One-shot integration test for the PCPNDT viewer pipeline.
 *  Run from CLI:  php test_pcpndt_pipeline.php
 *  - Seeds a fake session
 *  - Calls Mapper/Repository directly to verify schema + JSON shape
 *  - Renders the printable HTML and saves to test_pcpndt_form.html
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/includes/config.php';
require_once __DIR__ . '/includes/ris/RisPcpndtMapper.php';
require_once __DIR__ . '/includes/ris/RisPcpndtRepository.php';

$db   = getDbConnection();
$uid  = 'TEST.STUDY.PCPNDT.1';
$repo = new RisPcpndtRepository($db);

// 1) Saved row -> normalized fields
$saved = $repo->getByStudy($uid);
echo "Saved row exists: " . ($saved ? 'YES' : 'NO') . PHP_EOL;

$f = [
    'clinic_name'             => 'Apex Diagnostics',
    'clinic_registration_no'  => 'MH/PCPNDT/12345',
    'clinic_address'          => '12 MG Road, Pune',
    'patient_name'            => 'Test Patient One',
    'patient_age'             => '29',
    'husband_or_father_name'  => 'Ramesh Kumar',
    'full_address'            => '5 Park Lane, Pune',
    'phone'                   => '9999999999',
    'id_proof_type'           => 'Aadhaar',
    'id_proof_number'         => '1234 5678 9012',
    'num_living_children'     => '1',
    'children_details'        => '1 female',
    'referring_doctor'        => 'Dr. R Patel',
    'referring_doctor_reg_no' => 'MMC/1111',
    'referring_doctor_address'=> 'Mumbai',
    'lmp_date'                => '2026-02-15',
    'gestational_age'         => '15 weeks',
    'edd'                     => '2026-11-22',
    'family_history'          => 'No known genetic disease',
    'basis_of_diagnosis'      => 'Radiological/Ultrasonography',
    'indications'             => ['Age of pregnant woman above 35 years'],
    'procedure_type'          => 'Non-invasive',
    'procedures'              => ['Ultrasonography'],
    'procedure_date'          => '2026-06-03',
    'complications'           => 'None',
    'result'                  => 'Single live intrauterine pregnancy',
    'result_conveyed'         => 'Yes',
    'performing_doctor'             => 'Dr. Admin Sample',
    'performing_doctor_qualification' => 'MD Radiology',
    'performing_doctor_reg_no'        => 'MMC/2222',
    'ref_no'                  => 'ACC-PCPNDT-1',
];

$saved = $repo->upsertByStudy($uid, $f);
echo "Upsert returned " . count($saved ?? []) . " columns." . PHP_EOL;

$with = RisPcpndtMapper::withDefaults($f);
$miss = RisPcpndtMapper::missing($with);
echo "Required missing after fill: " . (empty($miss) ? 'none — PORTAL-READY ✓' : implode(',', $miss)) . PHP_EOL;

// 2) Verify mapper defaults
$blank = RisPcpndtMapper::withDefaults([]);
$blankMiss = RisPcpndtMapper::missing($blank);
echo "Blank record missing: " . count($blankMiss) . " fields -> " . implode(', ', $blankMiss) . PHP_EOL;

// 3) Render the printable Form F by including the endpoint (simulate session).
$_SESSION['user_id'] = 1;
$_SESSION['username'] = 'admin';
$_SESSION['role']     = 'admin';
$_SESSION['last_activity'] = time();
$_GET['study_uid'] = $uid;
ob_start();
include __DIR__ . '/api/pcpndt/form-html.php';
$html = ob_get_clean();
file_put_contents(__DIR__ . '/test_pcpndt_form.html', $html);
echo "form-html.php produced " . strlen($html) . " bytes -> test_pcpndt_form.html" . PHP_EOL;

// 4) Re-run prefill endpoint and dump the JSON.
unset($_GET['study_uid']);
$_GET['study_uid'] = $uid;
ob_start();
include __DIR__ . '/api/pcpndt/prefill.php';
$pj = ob_get_clean();
echo "prefill.php JSON head: " . substr($pj, 0, 200) . PHP_EOL;
$decoded = json_decode($pj, true);
echo "prefill success=" . var_export($decoded['success'] ?? null, true)
   . " missing=" . count($decoded['data']['missing'] ?? []) . PHP_EOL;
