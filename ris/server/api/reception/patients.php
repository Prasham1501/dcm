<?php
/**
 * Reception — Patients API
 *   GET  ?action=search&q=...      search MRN / name / phone
 *   GET  ?action=get&id=...        fetch one
 *   POST {action:'create', ...}    create patient (auto MRN)
 *   POST {action:'update', id, ...} update patient
 *
 * Thin adapter over RisPatientRepository (the tested data layer).
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisCounters.php';
require_once __DIR__ . '/../../includes/ris/RisPatientRepository.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}
if (!hasRole(['admin', 'super_admin', 'receptionist', 'doctor'])) {
    sendErrorResponse('Forbidden - reception access required', 403);
}

try {
    $user = getCurrentUser();
    $db = getDbConnection();
    $repo = new RisPatientRepository($db, new RisCounters($db));

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? 'search';
        if ($action === 'get') {
            $id = (int) ($_GET['id'] ?? 0);
            $patient = $repo->get($id);
            if (!$patient) {
                sendErrorResponse('Patient not found', 404);
            }
            sendSuccessResponse($patient);
        }
        if ($action === 'history') {
            $id = (int) ($_GET['id'] ?? 0);
            if ($id <= 0) {
                sendErrorResponse('Missing patient id', 400);
            }
            $patient = $repo->get($id);
            if (!$patient) {
                sendErrorResponse('Patient not found', 404);
            }

            $patientIds = [$id];
            $phone = trim((string)($patient['phone'] ?? ''));
            if ($phone !== '') {
                $likePhone = '%' . preg_replace('/\D+/', '', $phone) . '%';
                $dup = $db->prepare(
                    "SELECT id FROM ris_patients
                     WHERE id <> ?
                       AND REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''), ' ', ''), '-', ''), '+91', ''), '+', '') LIKE ?"
                );
                $dup->bind_param('is', $id, $likePhone);
                $dup->execute();
                $dupRes = $dup->get_result();
                while ($dupRow = $dupRes->fetch_assoc()) {
                    $patientIds[] = (int)$dupRow['id'];
                }
                $dup->close();
            }

            $visits = [];
            $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
            $types = str_repeat('i', count($patientIds));
            $stmt = $db->prepare(
                "SELECT v.*,
                        (SELECT COALESCE(SUM(pay.amount), 0)
                         FROM ris_payments pay
                         WHERE pay.visit_id = v.id AND pay.is_refund = 1) AS refund_total
                 FROM ris_visits v
                 WHERE v.patient_id IN ($placeholders)
                 ORDER BY v.visit_datetime DESC, v.id DESC LIMIT 50"
            );
            $bindArgs = [$types];
            foreach ($patientIds as $key => $value) {
                $bindArgs[] = &$patientIds[$key];
            }
            call_user_func_array([$stmt, 'bind_param'], $bindArgs);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($visit = $res->fetch_assoc()) {
                $visitId = (int)$visit['id'];

                $orders = [];
                $os = $db->prepare(
                    "SELECT o.*, s.name AS service_name
                     FROM ris_orders o LEFT JOIN ris_services s ON s.id = o.service_id
                     WHERE o.visit_id = ? ORDER BY o.id"
                );
                $os->bind_param('i', $visitId);
                $os->execute();
                $or = $os->get_result();
                while ($order = $or->fetch_assoc()) { $orders[] = $order; }
                $os->close();

                $receipts = [];
                $rs = $db->prepare("SELECT * FROM ris_receipts WHERE visit_id = ? ORDER BY id DESC");
                $rs->bind_param('i', $visitId);
                $rs->execute();
                $rr = $rs->get_result();
                while ($receipt = $rr->fetch_assoc()) {
                    $receipt['print_url'] = '/api/billing/receipt.php?id=' . (int)$receipt['id'] . '&format=html';
                    $receipts[] = $receipt;
                }
                $rs->close();

                $payments = [];
                $ps = $db->prepare(
                    "SELECT pay.*, COALESCE(u.full_name, u.username) AS received_by_name
                     FROM ris_payments pay
                     LEFT JOIN users u ON u.id = pay.received_by
                     WHERE pay.visit_id = ?
                     ORDER BY pay.id DESC"
                );
                $ps->bind_param('i', $visitId);
                $ps->execute();
                $pr = $ps->get_result();
                while ($payment = $pr->fetch_assoc()) { $payments[] = $payment; }
                $ps->close();

                $visit['orders'] = $orders;
                $visit['receipts'] = $receipts;
                $visit['payments'] = $payments;
                $visits[] = $visit;
            }
            $stmt->close();
            sendSuccessResponse(['patient' => $patient, 'visits' => $visits, 'duplicate_patient_ids' => array_values(array_unique($patientIds))]);
        }
        // default: search
        $q = trim((string) ($_GET['q'] ?? ''));
        $limit = min(10000, max(1, (int) ($_GET['limit'] ?? 20)));
        sendSuccessResponse($repo->search($q, $limit));
    }

    // POST
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $input['action'] ?? 'create';

    if ($action === 'update') {
        $id = (int) ($input['id'] ?? 0);
        if ($id <= 0) {
            sendErrorResponse('Missing patient id', 400);
        }
        $patient = $repo->update($id, $input);
        logAuditEvent($user['id'], 'update', 'ris_patient', $id, "Updated patient {$id}");
        sendSuccessResponse($patient, 'Patient updated');
    }

    // create
    $input['created_by'] = $user['id'];
    $phoneDigits = preg_replace('/\D+/', '', (string)($input['phone'] ?? ''));
    if (strlen($phoneDigits) > 10 && substr($phoneDigits, 0, 2) === '91') {
        $phoneDigits = substr($phoneDigits, -10);
    }
    if ($phoneDigits !== '') {
        $stmt = $db->prepare(
            "SELECT * FROM ris_patients
             WHERE REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone,''), ' ', ''), '-', ''), '+91', ''), '+', '') = ?
             ORDER BY id ASC LIMIT 1"
        );
        $stmt->bind_param('s', $phoneDigits);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($existing) {
            sendSuccessResponse($existing, 'Existing patient selected');
        }
    }
    try {
        $patient = $repo->create($input);
    } catch (InvalidArgumentException $e) {
        sendErrorResponse($e->getMessage(), 400);
    }
    logAuditEvent($user['id'], 'create', 'ris_patient', $patient['id'], "Registered patient {$patient['mrn']}");
    sendSuccessResponse($patient, 'Patient registered');
} catch (Throwable $e) {
    logMessage('Reception patients API error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
