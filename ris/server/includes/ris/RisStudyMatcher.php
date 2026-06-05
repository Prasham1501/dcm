<?php
/**
 * Links incoming DICOM studies (Orthanc -> cached_studies) back to the reception
 * order that scheduled them, by AccessionNumber or the pre-generated StudyInstanceUID.
 * On a match the order flips to 'acquired' and records the real study UID.
 */
class RisStudyMatcher
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    /**
     * Match all still-open orders against cached studies.
     * @return array<int,array{order_id:int,accession_number:?string,study_uid:string,mwl_path:?string}>
     *         the orders that were linked (so the caller can remove their .wl files).
     */
    public function matchPending(): array
    {
        $sql = "SELECT o.id AS order_id, o.accession_number, o.mwl_path, s.study_instance_uid
                FROM ris_orders o
                JOIN cached_studies s
                  ON ( (o.accession_number IS NOT NULL AND o.accession_number <> ''
                        AND s.accession_number = o.accession_number)
                       OR s.study_instance_uid = o.study_instance_uid )
                WHERE o.linked_study_uid IS NULL
                  AND o.status IN ('scheduled','arrived','sent_to_viewer','in_progress')
                ORDER BY o.id";
        $res = $this->db->query($sql);

        $matched = [];
        $seen = [];
        $upd = $this->db->prepare(
            "UPDATE ris_orders SET linked_study_uid = ?, status = 'acquired'
             WHERE id = ? AND linked_study_uid IS NULL"
        );

        while ($res && $row = $res->fetch_assoc()) {
            $oid = (int) $row['order_id'];
            if (isset($seen[$oid])) { continue; }   // one study per order
            $seen[$oid] = true;
            $uid = $row['study_instance_uid'];
            $upd->bind_param('si', $uid, $oid);
            $upd->execute();
            if ($upd->affected_rows > 0) {
                $matched[] = [
                    'order_id' => $oid,
                    'accession_number' => $row['accession_number'],
                    'study_uid' => $uid,
                    'mwl_path' => $row['mwl_path'],
                ];
            }
        }
        $upd->close();
        return $matched;
    }
}
