<?php
/**
 * Data access for the RIS patient master (`ris_patients`).
 * Pure data layer: takes a mysqli + RisCounters via constructor (testable, no globals).
 * HTTP concerns (auth, sanitize, JSON) stay in the endpoint that wraps this.
 */
class RisPatientRepository
{
    private mysqli $db;
    private RisCounters $counters;

    /** Columns a client may set on create. */
    private const FIELDS = [
        'dicom_patient_id', 'name_prefix', 'full_name', 'last_name', 'dob', 'age_years', 'sex',
        'phone', 'alt_phone', 'email', 'address', 'address_line1', 'address_line2',
        'address_line3', 'city', 'state', 'husband_or_father_name', 'id_proof_type',
        'id_proof_number', 'aadhaar_number', 'created_by',
    ];
    /** Integer-typed columns (everything else binds as string). */
    private const INT_FIELDS = ['age_years', 'created_by'];

    public function __construct(mysqli $db, RisCounters $counters)
    {
        $this->db = $db;
        $this->counters = $counters;
        $this->ensureExtendedSchema();
    }

    /** @throws InvalidArgumentException when full_name is missing. */
    public function create(array $data): array
    {
        $name = trim((string) ($data['full_name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('full_name is required');
        }

        $mrn = (isset($data['mrn']) && $data['mrn'] !== '') ? $data['mrn'] : $this->counters->next('mrn');

        $row = ['mrn' => $mrn, 'full_name' => $name];
        foreach (self::FIELDS as $f) {
            if ($f === 'full_name') {
                continue;
            }
            $row[$f] = self::nn($data[$f] ?? null);
        }

        $cols = array_keys($row);
        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        $sql = 'INSERT INTO ris_patients (`' . implode('`, `', $cols) . "`) VALUES ($placeholders)";

        $stmt = $this->db->prepare($sql);
        $types = '';
        $vals = [];
        foreach ($row as $col => $val) {
            $types .= in_array($col, self::INT_FIELDS, true) ? 'i' : 's';
            $vals[] = $val;
        }
        $stmt->bind_param($types, ...self::refs($vals));
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();

        return $this->get((int) $id);
    }

    public function get(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM ris_patients WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    /** Search MRN / name / phone by fragment. */
    public function search(string $query, int $limit = 20): array
    {
        $like = '%' . $query . '%';
        $stmt = $this->db->prepare(
            'SELECT * FROM ris_patients WHERE mrn LIKE ? OR full_name LIKE ? OR phone LIKE ?
             ORDER BY id DESC LIMIT ?'
        );
        $stmt->bind_param('sssi', $like, $like, $like, $limit);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($r = $res->fetch_assoc()) {
            $out[] = $r;
        }
        $stmt->close();
        return $out;
    }

    public function update(int $id, array $data): array
    {
        $editable = [
            'dicom_patient_id', 'name_prefix', 'full_name', 'last_name', 'dob', 'age_years',
            'sex', 'phone', 'alt_phone', 'email', 'address', 'address_line1', 'address_line2',
            'address_line3', 'city', 'state', 'husband_or_father_name', 'id_proof_type',
            'id_proof_number', 'aadhaar_number',
        ];
        $sets = [];
        $types = '';
        $vals = [];
        foreach ($editable as $col) {
            if (array_key_exists($col, $data)) {
                $sets[] = "`$col` = ?";
                $types .= in_array($col, self::INT_FIELDS, true) ? 'i' : 's';
                $vals[] = self::nn($data[$col]);
            }
        }
        if (!$sets) {
            return $this->get($id);
        }
        $types .= 'i';
        $vals[] = $id;
        $stmt = $this->db->prepare('UPDATE ris_patients SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->bind_param($types, ...self::refs($vals));
        $stmt->execute();
        $stmt->close();
        return $this->get($id);
    }

    /** Empty string -> null (so DATE/INT columns don't get ''). */
    private static function nn($v)
    {
        return ($v === '' || $v === null) ? null : $v;
    }

    private function ensureExtendedSchema(): void
    {
        $columns = [
            'name_prefix' => "ALTER TABLE ris_patients ADD COLUMN name_prefix VARCHAR(20) DEFAULT NULL AFTER dicom_patient_id",
            'last_name' => "ALTER TABLE ris_patients ADD COLUMN last_name VARCHAR(120) DEFAULT NULL AFTER full_name",
            'alt_phone' => "ALTER TABLE ris_patients ADD COLUMN alt_phone VARCHAR(20) DEFAULT NULL AFTER phone",
            'address_line1' => "ALTER TABLE ris_patients ADD COLUMN address_line1 VARCHAR(255) DEFAULT NULL AFTER email",
            'address_line2' => "ALTER TABLE ris_patients ADD COLUMN address_line2 VARCHAR(255) DEFAULT NULL AFTER address_line1",
            'address_line3' => "ALTER TABLE ris_patients ADD COLUMN address_line3 VARCHAR(255) DEFAULT NULL AFTER address_line2",
            'city' => "ALTER TABLE ris_patients ADD COLUMN city VARCHAR(100) DEFAULT NULL AFTER address_line3",
            'state' => "ALTER TABLE ris_patients ADD COLUMN state VARCHAR(100) DEFAULT NULL AFTER city",
            'aadhaar_number' => "ALTER TABLE ris_patients ADD COLUMN aadhaar_number VARCHAR(20) DEFAULT NULL AFTER id_proof_number",
        ];
        foreach ($columns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_patients LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) {
                $this->db->query($sql);
            }
        }
    }

    /** mysqli bind_param needs references; turn a value array into a reference array. */
    private static function refs(array $arr): array
    {
        $refs = [];
        foreach ($arr as $k => $v) {
            $refs[$k] = &$arr[$k];
        }
        return $refs;
    }
}
