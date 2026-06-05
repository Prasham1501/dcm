<?php
/**
 * Writes / removes DICOM Modality Worklist (.wl) files for reception orders,
 * into the folder watched by the Orthanc Worklists plugin.
 * Requires RisUid, RisWorklistMapper, RisDicomWriter.
 */
class RisWorklistService
{
    private mysqli $db;
    private string $dir;

    public function __construct(mysqli $db, string $worklistDir)
    {
        $this->db = $db;
        $this->dir = rtrim($worklistDir, "/\\");
    }

    /** Generate (or refresh) the .wl file for an order. Returns the path, or null if the order is gone. */
    public function writeForOrder(int $orderId): ?string
    {
        $order = $this->one("SELECT * FROM ris_orders WHERE id = ?", $orderId);
        if (!$order) {
            return null;
        }
        $patient = $this->one("SELECT * FROM ris_patients WHERE id = ?", (int) $order['patient_id']) ?: [];

        $opts = [
            'procedure_description' => $this->scalar(
                "SELECT name FROM ris_services WHERE id = ?", (int) ($order['service_id'] ?? 0)
            ) ?? '',
            'referring_physician_name' => $this->scalar(
                "SELECT rd.name FROM ris_visits v
                 LEFT JOIN ris_referring_doctors rd ON v.referring_doctor_id = rd.id
                 WHERE v.id = ?", (int) $order['visit_id']
            ) ?? '',
        ];

        $fields = RisWorklistMapper::map($order, $patient, $opts);

        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0775, true);
        }
        $safe = preg_replace('/[^A-Za-z0-9_-]/', '_', (string) $order['accession_number']);
        $path = $this->dir . DIRECTORY_SEPARATOR . $safe . '.wl';
        (new RisDicomWriter())->write($path, $fields);

        $stmt = $this->db->prepare("UPDATE ris_orders SET mwl_path = ?, mwl_written_at = NOW() WHERE id = ?");
        $stmt->bind_param('si', $path, $orderId);
        $stmt->execute();
        $stmt->close();

        return $path;
    }

    /** Delete the .wl file for an order (after it's been acquired or cancelled). */
    public function removeForOrder(int $orderId): void
    {
        $path = $this->scalar("SELECT mwl_path FROM ris_orders WHERE id = ?", $orderId);
        if ($path && is_file($path)) {
            @unlink($path);
        }
        $stmt = $this->db->prepare("UPDATE ris_orders SET mwl_path = NULL WHERE id = ?");
        $stmt->bind_param('i', $orderId);
        $stmt->execute();
        $stmt->close();
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

    private function scalar(string $sql, int $id)
    {
        $stmt = $this->db->prepare($sql);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_row();
        $stmt->close();
        return $row ? $row[0] : null;
    }
}
