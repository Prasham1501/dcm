<?php
/** Data access for referring doctors (with commission config). */
class RisReferringDoctorRepository
{
    private mysqli $db;

    private const FIELDS = [
        'name', 'qualification', 'doctor_type', 'registration_no', 'phone', 'email', 'clinic_name',
        'address', 'commission_type', 'commission_value', 'commission_overrides',
    ];

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    /** @throws InvalidArgumentException when name is missing. */
    public function create(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('name is required');
        }
        // Only include fields that have a value; let NOT NULL columns use their defaults.
        $row = ['name' => $name];
        foreach (self::FIELDS as $f) {
            if ($f === 'name') { continue; }
            $v = self::norm($f, $data[$f] ?? null);
            if ($v !== null) { $row[$f] = $v; }
        }
        $cols = array_keys($row);
        $sql = 'INSERT INTO ris_referring_doctors (`' . implode('`, `', $cols) . '`) VALUES ('
            . implode(', ', array_fill(0, count($cols), '?')) . ')';
        $stmt = $this->db->prepare($sql);
        $types = str_repeat('s', count($cols));
        $vals = array_values($row);
        $stmt->bind_param($types, ...self::refs($vals));
        if (!$stmt->execute()) {
            $err = $stmt->error;
            $stmt->close();
            throw new RuntimeException('Failed to create referring doctor: ' . $err);
        }
        $id = $stmt->insert_id;
        $stmt->close();
        return $this->get((int) $id);
    }

    public function get(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM ris_referring_doctors WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    public function search(string $query, int $limit = 20): array
    {
        $like = '%' . $query . '%';
        $stmt = $this->db->prepare(
            'SELECT * FROM ris_referring_doctors
             WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR clinic_name LIKE ?)
             ORDER BY name LIMIT ?'
        );
        $stmt->bind_param('sssi', $like, $like, $like, $limit);
        $stmt->execute();
        return self::rows($stmt);
    }

    public function listActive(): array
    {
        $stmt = $this->db->prepare('SELECT * FROM ris_referring_doctors WHERE is_active = 1 ORDER BY name');
        $stmt->execute();
        return self::rows($stmt);
    }

    /**
     * Active doctors of a given role. 'gp' returns gp+both; 'consultant' returns consultant+both.
     */
    public function listByType(string $type): array
    {
        if ($type !== 'gp' && $type !== 'consultant') {
            return $this->listActive();
        }
        $stmt = $this->db->prepare(
            "SELECT * FROM ris_referring_doctors
             WHERE is_active = 1 AND (doctor_type = ? OR doctor_type = 'both')
             ORDER BY name"
        );
        $stmt->bind_param('s', $type);
        $stmt->execute();
        return self::rows($stmt);
    }

    public function deactivate(int $id): void
    {
        $stmt = $this->db->prepare('UPDATE ris_referring_doctors SET is_active = 0 WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $stmt->close();
    }

    public function update(int $id, array $data): array
    {
        $sets = [];
        $types = '';
        $vals = [];
        foreach (self::FIELDS as $f) {
            if (array_key_exists($f, $data)) {
                $sets[] = "`$f` = ?";
                $types .= 's';
                $vals[] = self::norm($f, $data[$f]);
            }
        }
        if (!$sets) { return $this->get($id); }
        $types .= 'i';
        $vals[] = $id;
        $stmt = $this->db->prepare('UPDATE ris_referring_doctors SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->bind_param($types, ...self::refs($vals));
        $stmt->execute();
        $stmt->close();
        return $this->get($id);
    }

    private static function norm(string $field, $v)
    {
        if ($field === 'commission_overrides' && is_array($v)) {
            return json_encode($v);
        }
        return ($v === '' || $v === null) ? null : $v;
    }

    private static function rows(mysqli_stmt $stmt): array
    {
        $res = $stmt->get_result();
        $out = [];
        while ($r = $res->fetch_assoc()) { $out[] = $r; }
        $stmt->close();
        return $out;
    }

    private static function refs(array $arr): array
    {
        $refs = [];
        foreach ($arr as $k => $v) { $refs[$k] = &$arr[$k]; }
        return $refs;
    }
}
