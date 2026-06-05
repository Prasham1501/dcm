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
                       s.name AS service_name
                FROM ris_orders o
                LEFT JOIN ris_patients p ON o.patient_id = p.id
                LEFT JOIN ris_services s ON o.service_id = s.id"
            . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
            . ' ORDER BY o.created_at DESC LIMIT 300';
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
}
