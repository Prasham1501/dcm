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
    public function takePayment(
        int $visitId,
        float $amount,
        string $mode,
        ?string $ref,
        ?int $userId,
        bool $isRefund = false,
        array $details = []
    ): array
    {
        $this->ensurePaymentDetailsSchema();
        $refund = $isRefund ? 1 : 0;
        $payerName = $details['payer_name'] ?? null;
        $payerRelation = $details['payer_relation'] ?? null;
        $payerMobile = $details['payer_mobile'] ?? null;
        $notes = $details['notes'] ?? null;

        $dupe = $this->db->prepare(
            "SELECT id FROM ris_payments
             WHERE visit_id = ? AND amount = ? AND mode = ? AND is_refund = ? AND received_by <=> ?
               AND received_at >= DATE_SUB(NOW(), INTERVAL 8 SECOND)
             ORDER BY id DESC LIMIT 1"
        );
        $dupe->bind_param('idsii', $visitId, $amount, $mode, $refund, $userId);
        $dupe->execute();
        $existing = $dupe->get_result()->fetch_assoc();
        $dupe->close();
        if ($existing) {
            $this->recalculateVisit($visitId);
            return [
                'payment' => $this->row('ris_payments', (int) $existing['id']),
                'visit' => $this->row('ris_visits', $visitId),
            ];
        }

        $stmt = $this->db->prepare(
            "INSERT INTO ris_payments
                (visit_id, amount, mode, reference, payer_name, payer_relation, payer_mobile, notes, is_refund, received_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param(
            'idssssssii',
            $visitId,
            $amount,
            $mode,
            $ref,
            $payerName,
            $payerRelation,
            $payerMobile,
            $notes,
            $refund,
            $userId
        );
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

    /** @return array{total:float,count:int,by_mode:array<string,float>,refunds:float,balance_due:float,balance_due_count:int} */
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

        $stmt = $this->db->prepare(
            "SELECT COALESCE(SUM(balance),0) AS balance_due, COUNT(*) AS n
             FROM ris_visits
             WHERE visit_datetime >= ? AND visit_datetime < DATE_ADD(?, INTERVAL 1 DAY)
               AND status IN ('open','partly_paid') AND balance > 0"
        );
        $stmt->bind_param('ss', $from, $to);
        $stmt->execute();
        $balanceRow = $stmt->get_result()->fetch_assoc() ?: ['balance_due' => 0, 'n' => 0];
        $stmt->close();

        return [
            'total' => $total,
            'count' => $count,
            'by_mode' => $byMode,
            'refunds' => $refunds,
            'balance_due' => (float) $balanceRow['balance_due'],
            'balance_due_count' => (int) $balanceRow['n'],
        ];
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

    private function ensurePaymentDetailsSchema(): void
    {
        $columns = [
            'payer_name' => "ALTER TABLE ris_payments ADD COLUMN payer_name VARCHAR(160) DEFAULT NULL AFTER reference",
            'payer_relation' => "ALTER TABLE ris_payments ADD COLUMN payer_relation VARCHAR(80) DEFAULT NULL AFTER payer_name",
            'payer_mobile' => "ALTER TABLE ris_payments ADD COLUMN payer_mobile VARCHAR(20) DEFAULT NULL AFTER payer_relation",
            'notes' => "ALTER TABLE ris_payments ADD COLUMN notes TEXT DEFAULT NULL AFTER payer_mobile",
        ];
        foreach ($columns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_payments LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) {
                $this->db->query($sql);
            }
        }
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
