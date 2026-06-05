<?php
/**
 * Maps a reception order + patient into the DICOM Modality Worklist field set
 * that RisDicomWriter serialises into a .wl file. Pure (no DB, no I/O).
 */
class RisWorklistMapper
{
    /**
     * @param array $order   ris_orders row (accession_number, study_instance_uid, modality,
     *                        scheduled_station_ae, scheduled_datetime)
     * @param array $patient ris_patients row (full_name, mrn, dicom_patient_id, dob, sex)
     * @param array $opts    referring_physician_name?, procedure_description?, station_ae_default?, modality?
     */
    public static function map(array $order, array $patient, array $opts = []): array
    {
        $procedure = $opts['procedure_description'] ?? '';
        return [
            'PatientName' => (string) ($patient['full_name'] ?? ''),
            'PatientID' => self::firstNonEmpty([$patient['dicom_patient_id'] ?? null, $patient['mrn'] ?? null]),
            'PatientBirthDate' => self::da($patient['dob'] ?? null),
            'PatientSex' => self::sex($patient['sex'] ?? null),
            'AccessionNumber' => (string) ($order['accession_number'] ?? ''),
            'StudyInstanceUID' => (string) ($order['study_instance_uid'] ?? ''),
            'ReferringPhysicianName' => (string) ($opts['referring_physician_name'] ?? ''),
            'RequestedProcedureDescription' => (string) $procedure,
            'Modality' => self::firstNonEmpty([$order['modality'] ?? null, $opts['modality'] ?? null]) ?: 'US',
            'ScheduledStationAETitle' => self::firstNonEmpty([
                $order['scheduled_station_ae'] ?? null, $opts['station_ae_default'] ?? null,
            ]),
            'ScheduledProcedureStepStartDate' => self::da($order['scheduled_datetime'] ?? null),
            'ScheduledProcedureStepStartTime' => self::tm($order['scheduled_datetime'] ?? null),
            'ScheduledProcedureStepDescription' => (string) $procedure,
        ];
    }

    private static function firstNonEmpty(array $vals): string
    {
        foreach ($vals as $v) {
            if ($v !== null && $v !== '') { return (string) $v; }
        }
        return '';
    }

    private static function sex($v): string
    {
        switch (strtolower((string) $v)) {
            case 'female': case 'f': return 'F';
            case 'male': case 'm': return 'M';
            case '': case null: return '';
            default: return 'O';
        }
    }

    /** DICOM DA: YYYYMMDD. */
    private static function da($v): string
    {
        if ($v === null || $v === '') { return ''; }
        $ts = strtotime((string) $v);
        return $ts === false ? '' : date('Ymd', $ts);
    }

    /** DICOM TM: HHMMSS. */
    private static function tm($v): string
    {
        if ($v === null || $v === '') { return ''; }
        $ts = strtotime((string) $v);
        return $ts === false ? '' : date('His', $ts);
    }
}
