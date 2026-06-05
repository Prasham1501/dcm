<?php
/**
 * Visit billing: record payments, keep the visit's paid/balance/status in sync,
 * issue numbered receipts, and aggregate the daily collection (day book).
 */
class RisBillingRepository
{
    private mysqli $db;
    private RisCounters $counters;

    public function __construct(mysqli $db, RisCounters $counters)
    {
        $this->db = $db;
        $this->counters = $counters;
    }

    /** @return array{payment:array,visit:array} */
    public function takePayment(int $visitId, float $amount, string $mode, ?string $ref, ?int $userId, bool $isRefund = false): array
    {
        $refund = $isRefund ? 1 : 0;
        $stmt = $this->db->prepare(
            "INSERT INTO ris_payments (visit_id, amount, mode, reference, is_refund, received_by)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param('idssii', $visitId, $amount, $mode, $ref, $refund, $userId);
        $stmt->execute();
        $paymentId = $stmt->insert_id;
        $stmt->close();

        $this->recalculateVisit($visitId);

        return [
            'payment' => $this->row('ris_payments', (int) $paymentId),
            'visit' => $this->row('ris_visits', $visitId),
        ];
    }

    /** Recompute paid_amount / balance / status from the visit's payments. */
    private function recalculateVisit(int $visitId): void
    {
        $stmt = $this->db->prepare(
            "SELECT COALESCE(SUM(CASE WHEN is_refund = 0 THEN amount ELSE -amount END), 0) AS paid
             FROM ris_payments WHERE visit_id = ?"
        );
        $stmt->bind_param('i', $visitId);
        $stmt->execute();
        $paid = (float) $stmt->get_result()->fetch_assoc()['paid'];
        $stmt->close();

        $visit = $this->row('ris_visits', $visitId);
        $net = (float) $visit['net_amount'];
        $balance = $net - $paid;
        if ($paid <= 0.0) {
            $status = 'open';
        } elseif ($balance <= 0.0) {
            $status = 'paid';
        } else {
            $status = 'partly_paid';
        }

        $upd = $this->db->prepare(
            "UPDATE ris_visits SET paid_amount = ?, balance = ?, status = ? WHERE id = ?"
        );
        $upd->bind_param('ddsi', $paid, $balance, $status, $visitId);
        $upd->execute();
        $upd->close();
    }

    public function generateReceipt(int $visitId, ?int $userId): array
    {
        $visit = $this->row('ris_visits', $visitId);
        $receiptNo = $this->counters->next('receipt');
        $taxPct = (float) ($this->setting('default_tax_percentage') ?? 0);
        $gst = $this->setting('gst_number');

        $subtotal = (float) $visit['total_amount'];
        $discount = (float) $visit['discount'];
        $taxAmount = (float) $visit['tax'];
        $total = (float) $visit['net_amount'];

        $stmt = $this->db->prepare(
            "INSERT INTO ris_receipts (visit_id, receipt_no, gst_number, subtotal, discount, tax_percentage, tax_amount, total, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param('issdddddi', $visitId, $receiptNo, $gst, $subtotal, $discount, $taxPct, $taxAmount, $total, $userId);
        $stmt->execute();
        $id = $stmt->insert_id;
        $stmt->close();

        return $this->row('ris_receipts', (int) $id);
    }

    /** @return array{total:float,count:int,by_mode:array<string,float>,refunds:float} */
    public function daybook(string $from, string $to): array
    {
        $stmt = $this->db->prepare(
            "SELECT mode,
                    SUM(CASE WHEN is_refund = 0 THEN amount ELSE 0 END) AS collected,
                    SUM(CASE WHEN is_refund = 1 THEN amount ELSE 0 END) AS refunded,
                    COUNT(*) AS n
             FROM ris_payments
             WHERE received_at >= ? AND received_at < DATE_ADD(?, INTERVAL 1 DAY)
             GROUP BY mode"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $res = $stmt->get_result();

        $byMode = [];
        $total = 0.0;
        $refunds = 0.0;
        $count = 0;
        while ($r = $res->fetch_assoc()) {
            $collected = (float) $r['collected'];
            $byMode[$r['mode']] = $collected;
            $total += $collected;
            $refunds += (float) $r['refunded'];
            $count += (int) $r['n'];
        }
        $stmt->close();

        return ['total' => $total, 'count' => $count, 'by_mode' => $byMode, 'refunds' => $refunds];
    }

    private function setting(string $key): ?string
    {
        $stmt = $this->db->prepare("SELECT setting_value FROM hospital_settings WHERE setting_key = ?");
        $stmt->bind_param('s', $key);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ? $row['setting_value'] : null;
    }

    private function row(string $table, int $id): array
    {
        $stmt = $this->db->prepare("SELECT * FROM `$table` WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: [];
    }
}
