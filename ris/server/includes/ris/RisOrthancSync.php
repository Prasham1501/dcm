<?php
/**
 * Minimal Orthanc -> cached_* sync used by RIS worklist matching.
 */
class RisOrthancSync
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    public function sync(): array
    {
        $patients = $this->orthanc('/patients');
        if (!is_array($patients)) {
            throw new RuntimeException('Orthanc did not return patients');
        }

        $patientsProcessed = 0;
        $studiesAdded = 0;
        $studiesUpdated = 0;

        foreach ($patients as $patientOrthancId) {
            $patient = $this->orthanc('/patients/' . rawurlencode((string)$patientOrthancId));
            if (!$patient) { continue; }

            $tags = $patient['MainDicomTags'] ?? [];
            $patientId = trim((string)($tags['PatientID'] ?? 'UNKNOWN'));
            if ($patientId === '') { $patientId = 'UNKNOWN'; }
            $patientName = (string)($tags['PatientName'] ?? 'Unknown');
            $birthDate = $this->dicomDate($tags['PatientBirthDate'] ?? null);
            $sex = $tags['PatientSex'] ?? null;

            $this->upsertPatient((string)$patientOrthancId, $patientId, $patientName, $birthDate, $sex);
            $patientsProcessed++;

            foreach (($patient['Studies'] ?? []) as $studyOrthancId) {
                $study = $this->orthanc('/studies/' . rawurlencode((string)$studyOrthancId));
                if (!$study) { continue; }

                $studyTags = $study['MainDicomTags'] ?? [];
                $studyUid = trim((string)($studyTags['StudyInstanceUID'] ?? ''));
                if ($studyUid === '') { continue; }

                $studyDate = $this->dicomDate($studyTags['StudyDate'] ?? null) ?: date('Y-m-d');
                $studyTime = $this->dicomTime($studyTags['StudyTime'] ?? null) ?: date('H:i:s');
                $studyDesc = (string)($studyTags['StudyDescription'] ?? 'PACS Study');
                $accession = trim((string)($studyTags['AccessionNumber'] ?? ''));
                $accession = $accession === '' ? null : $accession;
                $seriesIds = $study['Series'] ?? [];
                $modality = null;
                $instanceCount = 0;

                foreach ($seriesIds as $index => $seriesId) {
                    $series = $this->orthanc('/series/' . rawurlencode((string)$seriesId));
                    if (!$series) { continue; }
                    if ($index === 0) {
                        $modality = $series['MainDicomTags']['Modality'] ?? null;
                    }
                    $instanceCount += count($series['Instances'] ?? []);
                }
                if (!$modality) { $modality = 'OT'; }

                if ($this->studyExists($studyUid)) {
                    $this->updateStudy((string)$studyOrthancId, $patientId, $studyDate, $studyTime, $studyDesc, $accession, $modality, count($seriesIds), $instanceCount, $studyUid);
                    $studiesUpdated++;
                } else {
                    $this->insertStudy($studyUid, (string)$studyOrthancId, $patientId, $studyDate, $studyTime, $studyDesc, $accession, $modality, count($seriesIds), $instanceCount);
                    $studiesAdded++;
                }
            }
        }

        $this->db->query("
            UPDATE cached_patients cp
            SET study_count = (SELECT COUNT(*) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id),
                last_study_date = (SELECT MAX(study_date) FROM cached_studies cs WHERE cs.patient_id = cp.patient_id)
        ");

        return [
            'patients_processed' => $patientsProcessed,
            'studies_added' => $studiesAdded,
            'studies_updated' => $studiesUpdated,
        ];
    }

    public function unmatchedRecent(int $limit = 10): array
    {
        $stmt = $this->db->prepare(
            "SELECT cs.study_instance_uid, cs.orthanc_id, cs.patient_id, cp.patient_name,
                    cs.study_description, cs.accession_number, cs.modality, cs.series_count,
                    cs.instance_count, cs.updated_at
             FROM cached_studies cs
             LEFT JOIN cached_patients cp ON cp.patient_id = cs.patient_id
             LEFT JOIN ris_orders ro ON ro.linked_study_uid = cs.study_instance_uid
                                OR ro.study_instance_uid = cs.study_instance_uid
                                OR (cs.accession_number IS NOT NULL AND cs.accession_number <> '' AND ro.accession_number = cs.accession_number)
             WHERE ro.id IS NULL
               AND cs.orthanc_id IS NOT NULL
               AND cs.orthanc_id <> ''
             ORDER BY cs.updated_at DESC
             LIMIT ?"
        );
        $stmt->bind_param('i', $limit);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($row = $res->fetch_assoc()) { $rows[] = $row; }
        $stmt->close();
        return $rows;
    }

    private function orthanc(string $endpoint): ?array
    {
        $ch = curl_init(rtrim(ORTHANC_URL, '/') . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200 || $response === false) { return null; }
        $json = json_decode($response, true);
        return is_array($json) ? $json : null;
    }

    private function upsertPatient(string $orthancId, string $patientId, string $name, ?string $birthDate, ?string $sex): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO cached_patients (orthanc_id, patient_id, patient_name, patient_birth_date, patient_sex, study_count, last_study_date)
             VALUES (?, ?, ?, ?, ?, 0, CURDATE())
             ON DUPLICATE KEY UPDATE orthanc_id = VALUES(orthanc_id), patient_name = VALUES(patient_name),
                patient_birth_date = VALUES(patient_birth_date), patient_sex = VALUES(patient_sex)"
        );
        $stmt->bind_param('sssss', $orthancId, $patientId, $name, $birthDate, $sex);
        $stmt->execute();
        $stmt->close();
    }

    private function studyExists(string $studyUid): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM cached_studies WHERE study_instance_uid = ? LIMIT 1');
        $stmt->bind_param('s', $studyUid);
        $stmt->execute();
        $exists = (bool)$stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $exists;
    }

    private function updateStudy(string $orthancId, string $patientId, string $date, string $time, string $desc, ?string $accession, string $modality, int $seriesCount, int $instanceCount, string $studyUid): void
    {
        $stmt = $this->db->prepare(
            "UPDATE cached_studies SET orthanc_id = ?, patient_id = ?, study_date = ?, study_time = ?,
                study_description = ?, accession_number = ?, modality = ?, series_count = ?,
                instance_count = ?, last_synced = NOW() WHERE study_instance_uid = ?"
        );
        $stmt->bind_param('sssssssiss', $orthancId, $patientId, $date, $time, $desc, $accession, $modality, $seriesCount, $instanceCount, $studyUid);
        $stmt->execute();
        $stmt->close();
    }

    private function insertStudy(string $studyUid, string $orthancId, string $patientId, string $date, string $time, string $desc, ?string $accession, string $modality, int $seriesCount, int $instanceCount): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO cached_studies (study_instance_uid, orthanc_id, patient_id, study_date, study_time,
                study_description, accession_number, modality, series_count, instance_count, last_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
        );
        $stmt->bind_param('ssssssssii', $studyUid, $orthancId, $patientId, $date, $time, $desc, $accession, $modality, $seriesCount, $instanceCount);
        $stmt->execute();
        $stmt->close();
    }

    private function dicomDate($value): ?string
    {
        $v = preg_replace('/\D/', '', (string)$value);
        return strlen($v) === 8 ? substr($v, 0, 4) . '-' . substr($v, 4, 2) . '-' . substr($v, 6, 2) : null;
    }

    private function dicomTime($value): ?string
    {
        $v = preg_replace('/\D/', '', (string)$value);
        return strlen($v) >= 6 ? substr($v, 0, 2) . ':' . substr($v, 2, 2) . ':' . substr($v, 4, 2) : null;
    }
}
