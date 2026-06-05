<?php
/**
 * PCPNDT Form F field model (viewer edition).
 *
 * Pure helpers: the canonical statutory field/option lists, sensible defaults,
 * and required-field detection. The endpoint assembles raw values from the
 * viewer DB (cached_patients / examinations / medical_reports / settings) and
 * optionally enriches from the RIS tables, then calls withDefaults()/missing().
 *
 * Field set mirrors FORM F (PC-PNDT Rules, Rule 9(4)) as used by the
 * Maharashtra online portal (pcpndt.maharashtra.gov.in).
 */
class RisPcpndtMapper
{
    /** Statutory indications for pre-natal diagnostic procedure (Rule 9 / Form F). */
    public const INDICATIONS = [
        'Age of pregnant woman above 35 years',
        'Two or more spontaneous abortions or foetal loss in the past',
        'Exposure to potentially teratogenic agents such as drugs, radiation, infection or chemicals',
        'Family history of mental retardation or physical deformities such as spasticity or any other genetic disease',
        'Any other (specify)',
    ];

    public const PROCEDURES = [
        'Ultrasonography',
        'Amniocentesis',
        'Chorionic Villi Aspiration (CVS)',
        'Foetal biopsy',
        'Cordocentesis',
        'Any other (specify)',
    ];

    public const BASIS_OF_DIAGNOSIS = [
        'Clinical', 'Bio-chemical', 'Cytogenetic', 'Radiological/Ultrasonography', 'Other',
    ];

    /** All editable field keys of a Form F record. */
    public const FIELDS = [
        'ref_no',
        'clinic_name', 'clinic_registration_no', 'clinic_address',
        'patient_name', 'patient_age', 'husband_or_father_name', 'full_address', 'phone',
        'id_proof_type', 'id_proof_number', 'num_living_children', 'children_details',
        'referring_doctor', 'referring_doctor_address', 'referring_doctor_reg_no',
        'lmp_date', 'gestational_age', 'edd',
        'family_history', 'basis_of_diagnosis',
        'indications', 'procedure_type', 'procedures',
        'procedure_date', 'complications', 'result', 'result_conveyed',
        'performing_doctor', 'performing_doctor_qualification', 'performing_doctor_reg_no',
    ];

    /** Required fields that block a complete, portal-ready Form F. */
    public const REQUIRED = [
        'clinic_name', 'clinic_registration_no',
        'patient_name', 'patient_age', 'husband_or_father_name', 'full_address',
        'referring_doctor', 'procedure_date', 'performing_doctor',
    ];

    /** Option lists for the UI. */
    public static function options(): array
    {
        return [
            'indications' => self::INDICATIONS,
            'procedures' => self::PROCEDURES,
            'basis_of_diagnosis' => self::BASIS_OF_DIAGNOSIS,
        ];
    }

    /** Normalise + apply sensible defaults to a (partial) field set. */
    public static function withDefaults(array $f): array
    {
        $out = [];
        foreach (self::FIELDS as $k) {
            $out[$k] = $f[$k] ?? null;
        }
        // Arrays
        $out['indications'] = self::asArray($f['indications'] ?? []);
        $out['procedures'] = self::asArray($f['procedures'] ?? []);
        if (count($out['procedures']) === 0) {
            $out['procedures'] = ['Ultrasonography'];          // USG is the default sonography procedure
        }
        $out['procedure_type'] = $out['procedure_type'] ?: 'Non-invasive';
        $out['result_conveyed'] = $out['result_conveyed'] ?: 'No';
        // Gestational age formatting if a raw number of weeks was supplied
        if (isset($f['gestational_age_weeks']) && $f['gestational_age_weeks'] !== '' && empty($out['gestational_age'])) {
            $out['gestational_age'] = rtrim(rtrim((string) $f['gestational_age_weeks'], '0'), '.') . ' weeks';
        }
        return $out;
    }

    /** Required fields that are still blank. */
    public static function missing(array $f): array
    {
        $missing = [];
        foreach (self::REQUIRED as $k) {
            if (trim((string) ($f[$k] ?? '')) === '') { $missing[] = $k; }
        }
        $lmp = trim((string) ($f['lmp_date'] ?? ''));
        $ga = trim((string) ($f['gestational_age'] ?? ''));
        if ($lmp === '' && $ga === '') { $missing[] = 'lmp_or_gestational_age'; }
        if (count(self::asArray($f['indications'] ?? [])) === 0) { $missing[] = 'indications'; }
        return $missing;
    }

    private static function asArray($v): array
    {
        if (is_array($v)) { return array_values(array_filter($v, fn($x) => $x !== '' && $x !== null)); }
        if (is_string($v) && $v !== '') {
            $d = json_decode($v, true);
            if (is_array($d)) { return array_values(array_filter($d, fn($x) => $x !== '' && $x !== null)); }
        }
        return [];
    }
}
