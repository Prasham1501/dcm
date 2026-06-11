<?php
/**
 * Doctor worklist queries + order status transitions:
 *   scheduled -> sent_to_viewer -> acquired/reported -> delivered
 */
class RisOrderWorkflow
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
        $this->ensureClinicWorkflowColumns();
    }

    /** @param array $filters status:string[]|string, modality:string */
    public function doctorList(array $filters = []): array
    {
        $where = [];
        $statuses = $filters['status'] ?? ['scheduled', 'sent_to_viewer', 'acquired', 'reported', 'delivered'];
        if (is_string($statuses)) { $statuses = array_map('trim', explode(',', $statuses)); }
        $statuses = array_values(array_filter($statuses));
        if ($statuses) {
            $safe = array_map(fn($s) => "'" . $this->db->real_escape_string($s) . "'", $statuses);
            $where[] = 'o.status IN (' . implode(',', $safe) . ')';
        }
        if (!empty($filters['modality'])) {
            $where[] = "o.modality = '" . $this->db->real_escape_string($filters['modality']) . "'";
        }
        $sql = "SELECT o.*, p.full_name AS patient_name, p.mrn, p.sex, p.age_years,
                       s.name AS service_name, v.net_amount AS visit_net_amount,
                       v.paid_amount AS visit_paid_amount, v.balance AS visit_balance,
                       v.status AS visit_status, v.urgent_report, v.visit_comment,
                       CASE
                         WHEN v.urgent_report = 1 THEN 'Urgent report'
                         WHEN v.visit_comment IS NOT NULL AND v.visit_comment <> '' THEN 'Comment added'
                         WHEN o.report_emailed_at IS NOT NULL THEN 'Report emailed'
                         WHEN o.report_printed_at IS NOT NULL THEN 'Report printed'
                         WHEN o.report_id IS NULL THEN 'Report not ready'
                         ELSE 'Report ready'
                       END AS attention_label
                FROM ris_orders o
                LEFT JOIN ris_patients p ON o.patient_id = p.id
                LEFT JOIN ris_services s ON o.service_id = s.id
                LEFT JOIN ris_visits v ON o.visit_id = v.id"
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY v.urgent_report DESC, o.priority_rank DESC, o.created_at DESC LIMIT 300';
        $res = $this->db->query($sql);
        $out = [];
        while ($res && $row = $res->fetch_assoc()) { $out[] = $row; }
        return $out;
    }

    /** Orders ready for the patient to collect. */
    public function collectionList(): array
    {
        return $this->doctorList(['status' => ['reported']]);
    }

    public function claim(int $orderId, ?int $userId = null): bool
    {
        return $this->transition($orderId, ['acquired', 'in_progress'], "status = 'in_progress'");
    }

    public function markReported(int $orderId, ?int $reportId, ?int $userId = null): bool
    {
        if (!in_array($this->currentStatus($orderId), ['acquired', 'in_progress', 'reported'], true)) {
            return false;
        }
        $stmt = $this->db->prepare("UPDATE ris_orders SET status = 'reported', report_id = ? WHERE id = ?");
        $stmt->bind_param('ii', $reportId, $orderId);
        $stmt->execute();
        $stmt->close();
        return true;
    }

    public function markDelivered(int $orderId, ?int $userId = null): bool
    {
        if (!in_array($this->currentStatus($orderId), ['acquired', 'reported', 'delivered'], true)) {
            return false;
        }
        $stmt = $this->db->prepare(
            "SELECT v.balance FROM ris_orders o JOIN ris_visits v ON v.id = o.visit_id WHERE o.id = ?"
        );
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($row && (float)$row['balance'] > 0.0) {
            throw new RuntimeException('Balance due before delivery: Rs ' . number_format((float)$row['balance'], 2));
        }
        $stmt = $this->db->prepare(
            "UPDATE ris_orders SET status = 'delivered', delivered_at = NOW(), delivered_by = ? WHERE id = ?"
        );
        $stmt->bind_param('ii', $userId, $orderId);
        $stmt->execute();
        $stmt->close();
        return true;
    }

    private function currentStatus(int $orderId): ?string
    {
        $stmt = $this->db->prepare("SELECT status FROM ris_orders WHERE id = ?");
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ? $row['status'] : null;
    }

    private function transition(int $orderId, array $allowedFrom, string $set): bool
    {
        if (!in_array($this->currentStatus($orderId), $allowedFrom, true)) {
            return false;
        }
        $this->db->query("UPDATE ris_orders SET $set WHERE id = " . (int) $orderId);
        return true;
    }

    private function ensureClinicWorkflowColumns(): void
    {
        $visitColumns = [
            'urgent_report' => "ALTER TABLE ris_visits ADD COLUMN urgent_report TINYINT(1) NOT NULL DEFAULT 0",
            'visit_comment' => "ALTER TABLE ris_visits ADD COLUMN visit_comment TEXT DEFAULT NULL",
        ];
        foreach ($visitColumns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_visits LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) { $this->db->query($sql); }
        }
        $orderColumns = [
            'report_emailed_at' => "ALTER TABLE ris_orders ADD COLUMN report_emailed_at DATETIME DEFAULT NULL",
            'report_printed_at' => "ALTER TABLE ris_orders ADD COLUMN report_printed_at DATETIME DEFAULT NULL",
            'priority_rank' => "ALTER TABLE ris_orders ADD COLUMN priority_rank TINYINT(3) UNSIGNED NOT NULL DEFAULT 0",
        ];
        foreach ($orderColumns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_orders LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) { $this->db->query($sql); }
        }
    }
}
