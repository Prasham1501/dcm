<?php
/**
 * Creates a reception visit and its orders in one transaction.
 * Each order gets a unique accession number and a pre-generated StudyInstanceUID
 * (the linchpin for the DICOM Modality Worklist + study matching in Phase 2).
 */
class RisRegistrationRepository
{
    private mysqli $db;
    private RisCounters $counters;
    private string $uidRoot;

    public function __construct(mysqli $db, RisCounters $counters, string $uidRoot)
    {
        $this->db = $db;
        $this->counters = $counters;
        $this->uidRoot = $uidRoot;
    }

    /**
     * @param array $data { patient_id:int, services:[{service_id?,price?,modality?,
     *                       scheduled_station_ae?,scheduled_datetime?,clinical_notes?}],
     *                       referring_doctor_id?, discount?, tax?, scheduled_station_ae?, created_by? }
     * @return array { visit: {...}, orders: [{...}] }
     */
    public function register(array $data): array
    {
        $patientId = (int) ($data['patient_id'] ?? 0);
        if ($patientId <= 0) {
            throw new InvalidArgumentException('patient_id is required');
        }
        $services = $data['services'] ?? [];
        if (!is_array($services) || count($services) === 0) {
            throw new InvalidArgumentException('at least one service is required');
        }

        $refDoc = isset($data['referring_doctor_id']) && $data['referring_doctor_id'] !== ''
            ? (int) $data['referring_doctor_id'] : null;
        $createdBy = isset($data['created_by']) && $data['created_by'] !== '' ? (int) $data['created_by'] : null;
        $discount = (float) ($data['discount'] ?? 0);
        $tax = (float) ($data['tax'] ?? 0);
        $defaultAe = $data['scheduled_station_ae'] ?? null;

        $this->db->begin_transaction();
        try {
            // Resolve each service (default price/modality from the catalog).
            $resolved = [];
            $total = 0.0;
            foreach ($services as $s) {
                $sid = (int) ($s['service_id'] ?? 0);
                $svc = $sid ? $this->row('ris_services', $sid) : null;
                $price = (isset($s['price']) && $s['price'] !== '')
                    ? (float) $s['price'] : ($svc ? (float) $svc['price'] : 0.0);
                $resolved[] = [
                    'service_id' => $sid ?: null,
                    'price' => $price,
                    'modality' => $s['modality'] ?? ($svc['modality'] ?? null),
                    'scheduled_station_ae' => $s['scheduled_station_ae'] ?? $defaultAe,
                    'scheduled_datetime' => $s['scheduled_datetime'] ?? null,
                    'clinical_notes' => $s['clinical_notes'] ?? null,
                ];
                $total += $price;
            }
            $net = $total - $discount + $tax;
            $visitNo = $this->counters->next('visit');

            $vs = $this->db->prepare(
                'INSERT INTO ris_visits (patient_id, visit_no, referring_doctor_id, total_amount,
                 discount, tax, net_amount, balance, created_by) VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $vs->bind_param('isidddddi', $patientId, $visitNo, $refDoc, $total, $discount, $tax, $net, $net, $createdBy);
            $vs->execute();
            $visitId = $vs->insert_id;
            $vs->close();

            $orders = [];
            foreach ($resolved as $r) {
                $accession = $this->counters->next('accession');
                $seq = (int) preg_replace('/\D/', '', $accession);
                $uid = RisUid::studyUid($this->uidRoot, $seq);

                $serviceId = $r['service_id'];
                $modality = $r['modality'];
                $ae = $r['scheduled_station_ae'];
                $sdt = $r['scheduled_datetime'];
                $price = $r['price'];
                $notes = $r['clinical_notes'];

                $os = $this->db->prepare(
                    'INSERT INTO ris_orders (visit_id, patient_id, service_id, modality, accession_number,
                     study_instance_uid, scheduled_station_ae, scheduled_datetime, price, clinical_notes, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)'
                );
                $os->bind_param(
                    'iiisssssdsi',
                    $visitId, $patientId, $serviceId, $modality, $accession,
                    $uid, $ae, $sdt, $price, $notes, $createdBy
                );
                $os->execute();
                $orderId = $os->insert_id;
                $os->close();
                $orders[] = $this->row('ris_orders', (int) $orderId);
            }

            $this->db->commit();
            return ['visit' => $this->row('ris_visits', (int) $visitId), 'orders' => $orders];
        } catch (Throwable $e) {
            $this->db->rollback();
            throw $e;
        }
    }

    private function row(string $table, int $id): ?array
    {
        // $table is internal/literal only — never user input.
        $stmt = $this->db->prepare("SELECT * FROM `$table` WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        return $row ?: null;
    }
}
