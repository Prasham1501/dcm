<?php
/**
 * Test helper: emit a sample .wl worklist file using the real RIS writer.
 * Invoked by worklistFile.test.ts (Vitest) which then parses it with dicom-parser.
 * Usage: php tests/wl-emit.php <output-path>
 */
$serverIncludes = __DIR__ . '/../../server/includes/ris';
require_once $serverIncludes . '/RisUid.php';
require_once $serverIncludes . '/RisWorklistMapper.php';
require_once $serverIncludes . '/RisDicomWriter.php';

$out = $argv[1] ?? (sys_get_temp_dir() . '/oczwl-sample.wl');

$fields = RisWorklistMapper::map(
    [
        'accession_number' => 'OCZ000123',
        'study_instance_uid' => '1.2.826.0.1.3680043.10.1338.20260602.123',
        'modality' => 'US',
        'scheduled_station_ae' => 'USG1',
        'scheduled_datetime' => '2026-06-02 10:30:00',
    ],
    [
        'full_name' => 'Asha Devi', 'mrn' => 'P000045', 'dicom_patient_id' => 'DCM45',
        'dob' => '1990-05-01', 'sex' => 'female',
    ],
    ['procedure_description' => 'USG Obstetric', 'referring_physician_name' => 'Dr Ref']
);

(new RisDicomWriter())->write($out, $fields);
echo $out;
