<?php
/**
 * Referring-doctor commission: accrue per order (rate from the doctor, with
 * per-service overrides), build monthly statements, and track payouts.
 * Can be globally disabled via hospital_settings.commission_enabled.
 */
class RisCommissionRepository
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    public function isEnabled(): bool
    {
        $res = $this->db->query("SELECT setting_value FROM hospital_settings WHERE setting_key='commission_enabled'");
        $row = $res ? $res->fetch_assoc() : null;
        return $row ? ($row['setting_value'] !== '0') : true;
    }

    /** Accrue commission for one order (idempotent). Returns the entry, or null if N/A. */
    public function accrueForOrder(int $orderId): ?array
    {
        if (!$this->isEnabled()) {
            return null;
        }
        $existing = $this->entryByOrder($orderId);
        if ($existing) {
            return $existing;
        }

        $order = $this->one("SELECT o.*, v.referring_doctor_id
                             FROM ris_orders o LEFT JOIN ris_visits v ON o.visit_id = v.id
                             WHERE o.id = ?", $orderId);
        if (!$order || empty($order['referring_doctor_id'])) {
            return null;
        }
        $doctorId = (int) $order['referring_doctor_id'];
        $doctor = $this->one("SELECT * FROM ris_referring_doctors WHERE id = ?", $doctorId);
        if (!$doctor) {
            return null;
        }

        [$rateType, $rateValue] = $this->resolveRate($doctor, (int) ($order['service_id'] ?? 0));
        if ($rateType === 'none' || $rateValue <= 0) {
            return null;
        }

        $base = (float) $order['price'];
        $commission = $rateType === 'percent' ? round($base * $rateValue / 100, 2) : round($rateValue, 2);
        $periodYm = substr((string) ($order['created_at'] ?: date('Y-m-d')), 0, 7);
        $visitId = (int) $order['visit_id'];
        $serviceId = $order['service_id'] !== null ? (int) $order['service_id'] : null;

        $stmt = $this->db->prepare(
            "INSERT INTO ris_commission_entries
             (order_id, visit_id, referring_doctor_id, service_id, base_amount, rate_type, rate_value, commission_amount, period_ym)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param('iiiidsdds', $orderId, $visitId, $doctorId, $serviceId, $base, $rateType, $rateValue, $commission, $periodYm);
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();

        return $this->one("SELECT * FROM ris_commission_entries WHERE id = ?", (int) $id);
    }

    /** @return array{entries:array,total:float} unpaid entries for a doctor (optionally one month). */
    public function statement(int $doctorId, ?string $periodYm = null): array
    {
        $sql = "SELECT * FROM ris_commission_entries
                WHERE referring_doctor_id = ? AND status IN ('accrued','approved')";
        if ($periodYm) {
            $sql .= " AND period_ym = '" . $this->db->real_escape_string($periodYm) . "'";
        }
        $sql .= ' ORDER BY created_at';
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param('i', $doctorId);
        $stmt->execute();
        $res = $stmt->get_result();
        $entries = [];
        $total = 0.0;
        while ($r = $res->fetch_assoc()) {
            $entries[] = $r;
            $total += (float) $r['commission_amount'];
        }
        $stmt->close();
        return ['entries' => $entries, 'total' => $total];
    }

    /** Create a payout from a doctor's unpaid entries in a date range; links them. */
    public function createPayout(int $doctorId, string $from, string $to, ?int $userId): array
    {
        $this->db->begin_transaction();
        try {
            $sel = $this->db->prepare(
                "SELECT id, commission_amount FROM ris_commission_entries
                 WHERE referring_doctor_id = ? AND status IN ('accrued','approved') AND payout_id IS NULL
                   AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) FOR UPDATE"
            );
            $sel->bind_param('iss', $doctorId, $from, $to);
            $sel->execute();
            $res = $sel->get_result();
            $ids = [];
            $total = 0.0;
            while ($r = $res->fetch_assoc()) { $ids[] = (int) $r['id']; $total += (float) $r['commission_amount']; }
            $sel->close();

            $ins = $this->db->prepare(
                "INSERT INTO ris_commission_payouts (referring_doctor_id, period_start, period_end, total_amount, status, created_by)
                 VALUES (?, ?, ?, ?, 'draft', ?)"
            );
            $ins->bind_param('issdi', $doctorId, $from, $to, $total, $userId);
            $ins->execute();
            $payoutId = $ins->insert_id;
            $ins->close();

            if ($ids) {
                $idList = implode(',', $ids);
                $this->db->query("UPDATE ris_commission_entries SET status='approved', payout_id=$payoutId WHERE id IN ($idList)");
            }
            $this->db->commit();
            return $this->one("SELECT * FROM ris_commission_payouts WHERE id = ?", (int) $payoutId);
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    public function markPayoutPaid(int $payoutId): array
    {
        $this->db->query("UPDATE ris_commission_payouts SET status='paid', paid_at=NOW() WHERE id=" . (int) $payoutId);
        $this->db->query("UPDATE ris_commission_entries SET status='paid' WHERE payout_id=" . (int) $payoutId);
        return $this->one("SELECT * FROM ris_commission_payouts WHERE id = ?", $payoutId);
    }

    /** Total commission by doctor in a date range (for reporting). */
    public function report(string $from, string $to): array
    {
        $stmt = $this->db->prepare(
            "SELECT e.referring_doctor_id, d.name,
                    SUM(e.commission_amount) AS total, COUNT(*) AS entries
             FROM ris_commission_entries e
             LEFT JOIN ris_referring_doctors d ON e.referring_doctor_id = d.id
             WHERE e.created_at >= ? AND e.created_at < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY e.referring_doctor_id, d.name ORDER BY total DESC"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $res = $stmt->get_result();
        $out = [];
        while ($r = $res->fetch_assoc()) { $out[] = $r; }
        $stmt->close();
        return $out;
    }

    /** @return array{0:string,1:float} [rateType, rateValue] */
    private function resolveRate(array $doctor, int $serviceId): array
    {
        $overrides = $doctor['commission_overrides'] ?? null;
        if ($overrides) {
            $map = json_decode($overrides, true);
            if (is_array($map) && isset($map[(string) $serviceId])) {
                $o = $map[(string) $serviceId];
                return [($o['type'] ?? 'percent'), (float) ($o['value'] ?? 0)];
            }
        }
        return [(string) ($doctor['commission_type'] ?? 'none'), (float) ($doctor['commission_value'] ?? 0)];
    }

    private function entryByOrder(int $orderId): ?array
    {
        return $this->one("SELECT * FROM ris_commission_entries WHERE order_id = ?", $orderId);
    }

    private function one(string $sql, int $id): ?array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }
}
