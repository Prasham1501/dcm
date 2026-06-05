<?php
/** Clinic dashboard summary + MIS export queries. Read-only aggregation. */
class RisDashboardRepository
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    public function summary(string $date): array
    {
        $ym = substr($date, 0, 7);
        return [
            'date' => $date,
            'registrations_today' => (int) $this->scalar(
                "SELECT COUNT(*) FROM ris_visits WHERE DATE(visit_datetime) = ?", 's', $date
            ),
            'pending_worklist' => (int) $this->scalar(
                "SELECT COUNT(*) FROM ris_orders WHERE status IN ('acquired','in_progress')"
            ),
            'ready_to_collect' => (int) $this->scalar(
                "SELECT COUNT(*) FROM ris_orders WHERE status = 'reported'"
            ),
            'collections_today' => (float) $this->scalar(
                "SELECT COALESCE(SUM(CASE WHEN is_refund=0 THEN amount ELSE -amount END),0)
                 FROM ris_payments WHERE DATE(received_at) = ?", 's', $date
            ),
            'mtd_commission' => (float) $this->scalar(
                "SELECT COALESCE(SUM(commission_amount),0) FROM ris_commission_entries WHERE period_ym = ?", 's', $ym
            ),
        ];
    }

    /** @return array flat visit rows for CSV export */
    public function exportVisits(string $from, string $to): array
    {
        $stmt = $this->db->prepare(
            "SELECT v.visit_no, v.visit_datetime, p.full_name AS patient_name, p.mrn,
                    d.name AS referring_doctor, v.total_amount, v.discount, v.tax,
                    v.net_amount, v.paid_amount, v.balance, v.status
             FROM ris_visits v
             LEFT JOIN ris_patients p ON v.patient_id = p.id
             LEFT JOIN ris_referring_doctors d ON v.referring_doctor_id = d.id
             WHERE v.visit_datetime >= ? AND v.visit_datetime < DATE_ADD(?, INTERVAL 1 DAY)
             ORDER BY v.id"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) { $rows[] = $r; }
        $stmt->close();
        return $rows;
    }

    /** @return array flat payment rows for CSV export */
    public function exportPayments(string $from, string $to): array
    {
        $stmt = $this->db->prepare(
            "SELECT pay.received_at, v.visit_no, p.full_name AS patient_name,
                    pay.amount, pay.mode, pay.reference, pay.is_refund
             FROM ris_payments pay
             LEFT JOIN ris_visits v ON pay.visit_id = v.id
             LEFT JOIN ris_patients p ON v.patient_id = p.id
             WHERE pay.received_at >= ? AND pay.received_at < DATE_ADD(?, INTERVAL 1 DAY)
             ORDER BY pay.id"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) { $rows[] = $r; }
        $stmt->close();
        return $rows;
    }

    /** @return array flat commission rows for CSV export */
    public function exportCommission(string $from, string $to): array
    {
        $stmt = $this->db->prepare(
            "SELECT e.created_at, d.name AS referring_doctor, e.order_id, e.base_amount,
                    e.rate_type, e.rate_value, e.commission_amount, e.status, e.period_ym
             FROM ris_commission_entries e
             LEFT JOIN ris_referring_doctors d ON e.referring_doctor_id = d.id
             WHERE e.created_at >= ? AND e.created_at < DATE_ADD(?, INTERVAL 1 DAY)
             ORDER BY e.id"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $res = $stmt->get_result();
        $rows = [];
        while ($r = $res->fetch_assoc()) { $rows[] = $r; }
        $stmt->close();
        return $rows;
    }

    private function scalar(string $sql, string $types = '', ...$params)
    {
        if ($types === '') {
            $res = $this->db->query($sql);
            $row = $res ? $res->fetch_row() : null;
            return $row ? $row[0] : 0;
        }
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_row();
        $stmt->close();
        return $row ? $row[0] : 0;
    }
}
