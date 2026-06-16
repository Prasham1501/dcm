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
        $this->ensureExtendedSchema();
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
        $miscCharge = (float) ($data['misc_charge'] ?? 0);
        $tax = (float) ($data['tax'] ?? 0);
        $defaultAe = $data['scheduled_station_ae'] ?? null;
        $defaultRoom = $data['room_title'] ?? null;
        $centerName = $this->strOrNull($data['center_name'] ?? null);
        $consultantDoctor = $this->strOrNull($data['consultant_doctor'] ?? null);
        $sampleCollectedAt = $this->strOrNull($data['sample_collected_at'] ?? null);
        $refNo = $this->strOrNull($data['ref_no'] ?? null);
        $urgentReport = !empty($data['urgent_report']) ? 1 : 0;
        $visitComment = $this->strOrNull($data['visit_comment'] ?? null);
        $phlebotomyStaff = $this->strOrNull($data['phlebotomy_staff'] ?? null);
        $homeVisitArea = $this->strOrNull($data['home_visit_area'] ?? null);
        $homeVisitAmount = (float) ($data['home_visit_amount'] ?? 0);
        $homeVisitTime = $this->strOrNull($data['home_visit_time'] ?? null);
        $homeVisit = ($phlebotomyStaff || $homeVisitArea || $homeVisitAmount > 0 || $homeVisitTime) ? 1 : 0;
        $dispatchMode = $this->strOrNull($data['dispatch_mode'] ?? null);
        $dispatchNote = $this->strOrNull($data['dispatch_note'] ?? null);
        $deliveryDestination = $this->strOrNull($data['delivery_destination'] ?? null) ?: 'patient';
        $proName = $this->strOrNull($data['pro_name'] ?? null);
        $commissionAmount = (float) ($data['commission_amount'] ?? 0);
        $regularPatient = array_key_exists('regular_patient', $data) ? (!empty($data['regular_patient']) ? 1 : 0) : 0;
        $printBarcode = !empty($data['print_barcode']) ? 1 : 0;
        $printSrs = !empty($data['print_srs']) ? 1 : 0;
        $printReceipt = array_key_exists('print_receipt', $data) ? (!empty($data['print_receipt']) ? 1 : 0) : 1;
        $printBillReceipt = !empty($data['print_bill_receipt']) ? 1 : 0;
        $sendToPrinter = array_key_exists('send_to_printer', $data) ? (!empty($data['send_to_printer']) ? 1 : 0) : 1;

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
                    'room_title' => $s['room_title'] ?? $defaultRoom,
                    'scheduled_datetime' => $s['scheduled_datetime'] ?? null,
                    'clinical_notes' => $s['clinical_notes'] ?? null,
                ];
                $total += $price;
            }
            $net = $total + $miscCharge + $homeVisitAmount - $discount + $tax;
            $visitNo = $this->counters->next('visit');

            $vs = $this->db->prepare(
                'INSERT INTO ris_visits
                 (patient_id, visit_no, center_name, referring_doctor_id, consultant_doctor, sample_collected_at,
                  ref_no, urgent_report, visit_comment, phlebotomy_staff, home_visit_area, home_visit_amount, home_visit_time,
                  home_visit, dispatch_mode, dispatch_note, delivery_destination, pro_name, commission_amount, regular_patient,
                  misc_charge, total_amount, discount, tax, net_amount,
                  balance, print_barcode, print_srs, print_receipt, print_bill_receipt, send_to_printer, created_by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $vs->bind_param(
                'ississsisssdsissssdiddddddiiiiii',
                $patientId,
                $visitNo,
                $centerName,
                $refDoc,
                $consultantDoctor,
                $sampleCollectedAt,
                $refNo,
                $urgentReport,
                $visitComment,
                $phlebotomyStaff,
                $homeVisitArea,
                $homeVisitAmount,
                $homeVisitTime,
                $homeVisit,
                $dispatchMode,
                $dispatchNote,
                $deliveryDestination,
                $proName,
                $commissionAmount,
                $regularPatient,
                $miscCharge,
                $total,
                $discount,
                $tax,
                $net,
                $net,
                $printBarcode,
                $printSrs,
                $printReceipt,
                $printBillReceipt,
                $sendToPrinter,
                $createdBy
            );
            $vs->execute();
            $visitId = $vs->insert_id;
            $vs->close();

            $orders = [];
            foreach ($resolved as $r) {
                $accession = $this->counters->next('accession');
                $tokenNo = null;
                $seq = (int) preg_replace('/\D/', '', $accession);
                $uid = RisUid::studyUid($this->uidRoot, $seq);

                $serviceId = $r['service_id'];
                $modality = $r['modality'];
                $ae = $r['scheduled_station_ae'];
                $room = $r['room_title'];
                $sdt = $r['scheduled_datetime'];
                $price = $r['price'];
                $notes = $r['clinical_notes'];

                $os = $this->db->prepare(
                    'INSERT INTO ris_orders (visit_id, patient_id, service_id, modality, accession_number,
                     token_no, study_instance_uid, scheduled_station_ae, room_title, scheduled_datetime, price, clinical_notes, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
                );
                $os->bind_param(
                    'iiisssssssdsi',
                    $visitId, $patientId, $serviceId, $modality, $accession,
                    $tokenNo, $uid, $ae, $room, $sdt, $price, $notes, $createdBy
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

    private function ensureExtendedSchema(): void
    {
        $this->db->query("INSERT INTO app_counters (name, current_value, prefix) VALUES ('token', 0, 'T') ON DUPLICATE KEY UPDATE name = name");
        $columns = [
            'token_no' => "ALTER TABLE ris_orders ADD COLUMN token_no VARCHAR(32) DEFAULT NULL AFTER accession_number",
            'room_title' => "ALTER TABLE ris_orders ADD COLUMN room_title VARCHAR(120) DEFAULT NULL AFTER scheduled_station_ae",
        ];
        foreach ($columns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_orders LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) {
                $this->db->query($sql);
            }
        }
        $visitColumns = [
            'center_name' => "ALTER TABLE ris_visits ADD COLUMN center_name VARCHAR(160) DEFAULT NULL AFTER visit_datetime",
            'consultant_doctor' => "ALTER TABLE ris_visits ADD COLUMN consultant_doctor VARCHAR(160) DEFAULT NULL AFTER referring_doctor_id",
            'sample_collected_at' => "ALTER TABLE ris_visits ADD COLUMN sample_collected_at DATETIME DEFAULT NULL AFTER consultant_doctor",
            'ref_no' => "ALTER TABLE ris_visits ADD COLUMN ref_no VARCHAR(80) DEFAULT NULL AFTER sample_collected_at",
            'urgent_report' => "ALTER TABLE ris_visits ADD COLUMN urgent_report TINYINT(1) NOT NULL DEFAULT 0",
            'visit_comment' => "ALTER TABLE ris_visits ADD COLUMN visit_comment TEXT DEFAULT NULL",
            'phlebotomy_staff' => "ALTER TABLE ris_visits ADD COLUMN phlebotomy_staff VARCHAR(160) DEFAULT NULL AFTER visit_comment",
            'home_visit_area' => "ALTER TABLE ris_visits ADD COLUMN home_visit_area VARCHAR(160) DEFAULT NULL AFTER phlebotomy_staff",
            'home_visit_amount' => "ALTER TABLE ris_visits ADD COLUMN home_visit_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER home_visit_area",
            'home_visit_time' => "ALTER TABLE ris_visits ADD COLUMN home_visit_time TIME DEFAULT NULL AFTER home_visit_amount",
            'home_visit' => "ALTER TABLE ris_visits ADD COLUMN home_visit TINYINT(1) NOT NULL DEFAULT 0 AFTER home_visit_time",
            'dispatch_mode' => "ALTER TABLE ris_visits ADD COLUMN dispatch_mode VARCHAR(80) DEFAULT NULL AFTER home_visit",
            'dispatch_note' => "ALTER TABLE ris_visits ADD COLUMN dispatch_note TEXT DEFAULT NULL AFTER dispatch_mode",
            'delivery_destination' => "ALTER TABLE ris_visits ADD COLUMN delivery_destination ENUM('center','home','patient','other') NOT NULL DEFAULT 'patient' AFTER dispatch_note",
            'pro_name' => "ALTER TABLE ris_visits ADD COLUMN pro_name VARCHAR(160) DEFAULT NULL AFTER delivery_destination",
            'commission_amount' => "ALTER TABLE ris_visits ADD COLUMN commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER pro_name",
            'regular_patient' => "ALTER TABLE ris_visits ADD COLUMN regular_patient TINYINT(1) NOT NULL DEFAULT 0 AFTER commission_amount",
            'misc_charge' => "ALTER TABLE ris_visits ADD COLUMN misc_charge DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER total_amount",
            'print_barcode' => "ALTER TABLE ris_visits ADD COLUMN print_barcode TINYINT(1) NOT NULL DEFAULT 0",
            'print_srs' => "ALTER TABLE ris_visits ADD COLUMN print_srs TINYINT(1) NOT NULL DEFAULT 0",
            'print_receipt' => "ALTER TABLE ris_visits ADD COLUMN print_receipt TINYINT(1) NOT NULL DEFAULT 1",
            'print_bill_receipt' => "ALTER TABLE ris_visits ADD COLUMN print_bill_receipt TINYINT(1) NOT NULL DEFAULT 0",
            'send_to_printer' => "ALTER TABLE ris_visits ADD COLUMN send_to_printer TINYINT(1) NOT NULL DEFAULT 1",
            'prescription_path' => "ALTER TABLE ris_visits ADD COLUMN prescription_path VARCHAR(255) DEFAULT NULL",
            'prescription_name' => "ALTER TABLE ris_visits ADD COLUMN prescription_name VARCHAR(255) DEFAULT NULL",
        ];
        foreach ($visitColumns as $column => $sql) {
            $safe = $this->db->real_escape_string($column);
            $res = $this->db->query("SHOW COLUMNS FROM ris_visits LIKE '{$safe}'");
            if (!$res || $res->num_rows === 0) {
                $this->db->query($sql);
            }
        }
    }

    private function strOrNull($value): ?string
    {
        $str = trim((string)($value ?? ''));
        return $str === '' ? null : $str;
    }
}
