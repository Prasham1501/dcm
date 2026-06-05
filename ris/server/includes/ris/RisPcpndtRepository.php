<?php
/** Persistence for PCPNDT Form F, keyed by DICOM study_uid (viewer-native). */
require_once __DIR__ . '/RisPcpndtMapper.php';

class RisPcpndtRepository
{
    private mysqli $db;

    /** Columns we accept on upsert (statutory fields + soft links). */
    private const LINK_COLS = ['order_id', 'visit_id', 'patient_id', 'examination_id'];
    private const JSON_COLS = ['indications', 'procedures'];
    private const DATE_COLS = ['lmp_date', 'edd', 'procedure_date'];

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    public function getByStudy(string $studyUid): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM pcpndt_form_f WHERE study_uid = ?');
        $stmt->bind_param('s', $studyUid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }

    /** Insert or update the Form F for a study. Returns the saved row. */
    public function upsertByStudy(string $studyUid, array $data): array
    {
        $cols = ['study_uid'];
        $vals = [$studyUid];
        $accept = array_merge(RisPcpndtMapper::FIELDS, self::LINK_COLS);
        foreach ($accept as $c) {
            if (!array_key_exists($c, $data)) { continue; }
            $v = $data[$c];
            if (in_array($c, self::JSON_COLS, true)) {
                $v = json_encode(is_array($v) ? array_values($v) : []);
            } elseif (in_array($c, self::DATE_COLS, true) && ($v === '' || $v === null)) {
                $v = null;
            }
            $cols[] = $c;
            $vals[] = $v;
        }

        $place = implode(', ', array_fill(0, count($cols), '?'));
        $updates = [];
        foreach ($cols as $c) {
            if ($c !== 'study_uid') { $updates[] = "`$c` = VALUES(`$c`)"; }
        }
        $sql = 'INSERT INTO pcpndt_form_f (`' . implode('`, `', $cols) . "`) VALUES ($place)";
        if ($updates) { $sql .= ' ON DUPLICATE KEY UPDATE ' . implode(', ', $updates); }

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param(str_repeat('s', count($vals)), ...self::refs($vals));
        $stmt->execute();
        $stmt->close();
        return $this->getByStudy($studyUid) ?? [];
    }

    public function setStatusByStudy(string $studyUid, string $status, ?string $ackNo, ?int $userId, ?string $pdfPath = null): ?array
    {
        $submittedAt = $status === 'submitted' ? date('Y-m-d H:i:s') : null;
        $stmt = $this->db->prepare(
            "UPDATE pcpndt_form_f SET status = ?, portal_ack_no = COALESCE(?, portal_ack_no),
                    pdf_path = COALESCE(?, pdf_path), submitted_at = COALESCE(?, submitted_at), submitted_by = ?
             WHERE study_uid = ?"
        );
        $stmt->bind_param('ssssis', $status, $ackNo, $pdfPath, $submittedAt, $userId, $studyUid);
        $stmt->execute();
        $stmt->close();
        return $this->getByStudy($studyUid);
    }

    private static function refs(array $arr): array
    {
        $refs = [];
        foreach ($arr as $k => $v) { $refs[$k] = &$arr[$k]; }
        return $refs;
    }
}
