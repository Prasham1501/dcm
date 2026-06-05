<?php
/**
 * Atomic, multi-client-safe sequence generator backed by `app_counters`.
 * Each next() runs in a transaction with SELECT ... FOR UPDATE so concurrent
 * reception desks never collide on MRN / accession / receipt numbers.
 */
class RisCounters
{
    private mysqli $db;

    public function __construct(mysqli $db)
    {
        $this->db = $db;
    }

    /**
     * Increment a named counter and return the formatted value (prefix + 6-digit).
     * @throws InvalidArgumentException if the counter name is unknown.
     */
    public function next(string $name): string
    {
        $this->db->begin_transaction();
        try {
            $stmt = $this->db->prepare(
                "SELECT current_value, prefix FROM app_counters WHERE name = ? FOR UPDATE"
            );
            $stmt->bind_param('s', $name);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$row) {
                throw new InvalidArgumentException("unknown counter: {$name}");
            }

            $next = (int) $row['current_value'] + 1;
            $upd = $this->db->prepare("UPDATE app_counters SET current_value = ? WHERE name = ?");
            $upd->bind_param('is', $next, $name);
            $upd->execute();
            $upd->close();

            $this->db->commit();
            return $row['prefix'] . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }
}
