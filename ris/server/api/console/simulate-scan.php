<?php
/**
 * Console simulator — create DICOM studies from uploaded images for a RIS order.
 * This mimics a modality that selected the RIS accession and sent images back.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisOrthancSync.php';
require_once __DIR__ . '/../../includes/ris/RisStudyMatcher.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistService.php';
require_once __DIR__ . '/../../includes/ris/RisWorklistMapper.php';
require_once __DIR__ . '/../../includes/ris/RisDicomWriter.php';
require_once __DIR__ . '/../../includes/ris/RisUid.php';
require_once __DIR__ . '/../../includes/ris/worklist_dir.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { sendErrorResponse('Method not allowed', 405); }
if (!validateSession()) { sendErrorResponse('Unauthorized - Please log in', 401); }
if (!hasRole(['admin', 'super_admin', 'receptionist'])) { sendErrorResponse('Forbidden', 403); }

try {
    $db = getDbConnection();
    $orderId = (int)($_POST['order_id'] ?? 0);
    $returnTarget = trim((string)($_POST['return_target'] ?? 'ris'));
    $destinationAe = trim((string)($_POST['destination_ae'] ?? ''));
    $destinationHost = trim((string)($_POST['destination_host'] ?? ''));
    $destinationPort = (int)($_POST['destination_port'] ?? 0);
    if ($orderId <= 0) { sendErrorResponse('Order is required', 400); }
    if (empty($_FILES['images'])) { sendErrorResponse('Upload one or more JPG/PNG/BMP images', 400); }
    if (!in_array($returnTarget, ['ris', 'viewer'], true)) { sendErrorResponse('Invalid return target', 400); }
    if ($returnTarget === 'viewer' && ($destinationAe === '' || $destinationHost === '' || $destinationPort <= 0 || $destinationPort > 65535)) {
        sendErrorResponse('Viewer AE title, IP/host, and port are required', 400);
    }

    $stmt = $db->prepare(
        "SELECT o.*, p.mrn, p.dicom_patient_id, p.full_name, p.age_years, p.sex, s.name AS service_name
         FROM ris_orders o
         LEFT JOIN ris_patients p ON p.id = o.patient_id
         LEFT JOIN ris_services s ON s.id = o.service_id
         WHERE o.id = ? LIMIT 1"
    );
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$order) { sendErrorResponse('Order not found', 404); }

    $overrideAccession = trim((string)($_POST['accession_number'] ?? ''));
    $overridePatientName = trim((string)($_POST['patient_name'] ?? ''));
    $overridePatientId = trim((string)($_POST['patient_id'] ?? ''));
    $overrideModality = strtoupper(trim((string)($_POST['modality'] ?? '')));
    $overrideStudyDesc = trim((string)($_POST['study_description'] ?? ''));

    $files = normalize_uploads($_FILES['images']);
    $studyUid = $order['study_instance_uid'] ?: uid('1.2.826.0.1.3680043.10.1338.99');
    $seriesUid = uid($studyUid);
    $created = [];
    $createdIds = [];
    $errors = [];
    $index = 0;

    foreach ($files as $file) {
        $index++;
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = $file['name'] . ': upload error';
            continue;
        }
        $mime = mime_content_type($file['tmp_name']) ?: $file['type'];
        $now = new DateTime('now');
        $metadata = [
            'patientName' => $overridePatientName !== '' ? $overridePatientName : ($order['full_name'] ?: 'RIS Patient'),
            'patientId' => $overridePatientId !== '' ? $overridePatientId : ($order['dicom_patient_id'] ?: $order['mrn'] ?: ('RIS' . $order['patient_id'])),
            'age' => $order['age_years'] ? (string)(int)$order['age_years'] : '',
            'sex' => ris_sex($order['sex'] ?? ''),
            'modality' => $overrideModality !== '' ? $overrideModality : ($order['modality'] ?: 'OT'),
            'studyDesc' => $overrideStudyDesc !== '' ? $overrideStudyDesc : ($order['service_name'] ?: 'RIS Study'),
            'refPhysician' => '',
            'accession' => $overrideAccession !== '' ? $overrideAccession : $order['accession_number'],
            'studyUID' => $studyUid,
            'seriesUID' => $seriesUid,
            'instanceUID' => uid($seriesUid),
            'dateStr' => $now->format('Ymd'),
            'timeStr' => $now->format('His'),
            'instanceNum' => $index,
        ];

        if (simulator_is_dicom_upload($file['tmp_name'], $file['name'], $mime)) {
            $createdResponse = simulator_upload_dicom_bytes(file_get_contents($file['tmp_name']));
            if (empty($createdResponse['ID'])) {
                $errors[] = $file['name'] . ': Orthanc did not return an instance ID';
                continue;
            }
            $modified = simulator_retag_instance((string)$createdResponse['ID'], $metadata);
            simulator_delete_instance((string)$createdResponse['ID']);
            if (empty($modified['ID'])) {
                $errors[] = $file['name'] . ': Orthanc did not return a retagged instance ID';
                continue;
            }
            $created[] = $modified;
            $createdIds[] = $modified['ID'];
            continue;
        }

        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/bmp', 'image/x-ms-bmp'], true)) {
            $errors[] = $file['name'] . ': use DICOM, JPG, PNG, or BMP for simulator';
            continue;
        }
        $image = simulator_image_pixels($file['tmp_name']);
        if (!$image) {
            $errors[] = $file['name'] . ': failed to decode image';
            continue;
        }

        $dicomBytes = simulator_dicom_file([
            ...$metadata,
            'width' => $image['width'],
            'height' => $image['height'],
            'pixelData' => $image['pixelData'],
        ]);

        $createdResponse = simulator_upload_dicom_bytes($dicomBytes);
        $created[] = $createdResponse;
        if (!empty($createdResponse['ID'])) {
            $createdIds[] = $createdResponse['ID'];
        }
    }

    if (!$created) { sendErrorResponse('No simulator images were created: ' . implode('; ', $errors), 500); }

    $transfer = null;
    if ($returnTarget === 'viewer') {
        simulator_ensure_order_status($db);
        $transfer = simulator_send_to_destination($createdIds, $destinationAe, $destinationHost, $destinationPort);
        foreach ($createdIds as $instanceId) {
            simulator_delete_instance($instanceId);
        }
        $sent = $db->prepare("UPDATE ris_orders SET status = 'sent_to_viewer' WHERE id = ?");
        $sent->bind_param('i', $orderId);
        $sent->execute();
        $sent->close();

        sendSuccessResponse([
            'created' => count($created),
            'study_uid' => $studyUid,
            'matched' => 0,
            'orders' => [],
            'synced' => null,
            'transfer' => $transfer,
            'errors' => $errors,
            'note' => 'Sent to Viewer destination. Temporary simulator instances were removed from RIS Orthanc.',
        ]);
    }

    $syncStats = (new RisOrthancSync($db))->sync();
    $matched = (new RisStudyMatcher($db))->matchPending();
    $wl = new RisWorklistService($db, ris_worklist_dir($db));
    foreach ($matched as $m) { $wl->removeForOrder((int)$m['order_id']); }

    sendSuccessResponse([
        'created' => count($created),
        'study_uid' => $studyUid,
        'matched' => count($matched),
        'orders' => $matched,
        'synced' => $syncStats,
        'errors' => $errors,
    ]);
} catch (Throwable $e) {
    logMessage('Console simulator scan error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}

function normalize_uploads(array $files): array {
    $out = [];
    if (!is_array($files['name'])) {
        return [[
            'name' => $files['name'], 'type' => $files['type'], 'tmp_name' => $files['tmp_name'],
            'error' => $files['error'], 'size' => $files['size'],
        ]];
    }
    foreach ($files['name'] as $i => $name) {
        $out[] = [
            'name' => $name, 'type' => $files['type'][$i], 'tmp_name' => $files['tmp_name'][$i],
            'error' => $files['error'][$i], 'size' => $files['size'][$i],
        ];
    }
    return $out;
}

function uid(string $root): string {
    return substr(rtrim($root, '.') . '.' . time() . random_int(1000, 999999), 0, 64);
}

function ris_sex(string $sex): string {
    $v = strtolower($sex);
    if ($v === 'female' || $v === 'f') return 'F';
    if ($v === 'male' || $v === 'm') return 'M';
    if ($v === 'other' || $v === 'o') return 'O';
    return '';
}

function simulator_is_dicom_upload(string $path, string $name, string $mime): bool {
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (in_array($ext, ['dcm', 'dicom'], true)) { return true; }
    if (in_array(strtolower($mime), ['application/dicom', 'application/octet-stream'], true)) {
        $fh = @fopen($path, 'rb');
        if (!$fh) { return false; }
        fseek($fh, 128);
        $magic = fread($fh, 4);
        fclose($fh);
        return $magic === 'DICM';
    }
    return false;
}

function simulator_upload_dicom_bytes(string $dicomBytes): array {
    $result = simulator_orthanc_request('POST', '/instances', $dicomBytes, 'application/dicom');
    if ($result['code'] !== 200) {
        throw new Exception('Orthanc upload failed HTTP ' . $result['code'] . ': ' . $result['body']);
    }
    return json_decode((string)$result['body'], true) ?: [];
}

function simulator_retag_instance(string $instanceId, array $metadata): array {
    $replace = [
        'PatientName' => $metadata['patientName'],
        'PatientID' => $metadata['patientId'],
        'PatientSex' => $metadata['sex'],
        'PatientAge' => simulator_age($metadata['age']),
        'AccessionNumber' => $metadata['accession'],
        'StudyInstanceUID' => $metadata['studyUID'],
        'StudyDescription' => $metadata['studyDesc'],
        'SeriesInstanceUID' => $metadata['seriesUID'],
        'SeriesDescription' => 'RIS Console Simulator',
        'Modality' => $metadata['modality'],
        'StudyDate' => $metadata['dateStr'],
        'StudyTime' => $metadata['timeStr'],
        'InstanceNumber' => (string)$metadata['instanceNum'],
    ];
    $result = simulator_orthanc_request('POST', '/instances/' . rawurlencode($instanceId) . '/modify', json_encode([
        'Replace' => $replace,
        'Force' => true,
        'KeepSource' => true,
    ]), 'application/json');
    if ($result['code'] !== 200) {
        throw new Exception('Orthanc retag failed HTTP ' . $result['code'] . ': ' . $result['body']);
    }

    $json = json_decode((string)$result['body'], true);
    if (is_array($json) && !empty($json['ID'])) {
        return $json;
    }

    // Some Orthanc builds return the modified instance as application/dicom
    // bytes instead of storing it and returning JSON. Store that returned
    // DICOM explicitly so the simulator has a real instance ID to send/match.
    return simulator_upload_dicom_bytes((string)$result['body']);
}

function simulator_image_pixels(string $path): ?array {
    $info = @getimagesize($path);
    if (!$info) { return null; }

    $gd = null;
    if ($info[2] === IMAGETYPE_JPEG) {
        $gd = @imagecreatefromjpeg($path);
    } elseif ($info[2] === IMAGETYPE_PNG) {
        $gd = @imagecreatefrompng($path);
    } elseif ($info[2] === IMAGETYPE_BMP && function_exists('imagecreatefrombmp')) {
        $gd = @imagecreatefrombmp($path);
    }
    if (!$gd) { return null; }

    $width = imagesx($gd);
    $height = imagesy($gd);
    $pixelData = '';
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            $rgb = imagecolorat($gd, $x, $y);
            $pixelData .= chr(($rgb >> 16) & 0xFF) . chr(($rgb >> 8) & 0xFF) . chr($rgb & 0xFF);
        }
    }
    imagedestroy($gd);

    return ['width' => $width, 'height' => $height, 'pixelData' => $pixelData];
}

function simulator_dicom_file(array $p): string {
    $implUid = '1.2.826.0.1.3680043.8.1055.1';
    $sopClass = '1.2.840.10008.5.1.4.1.1.7';
    $transferSyntax = '1.2.840.10008.1.2.1';

    $meta = '';
    $meta .= simulator_dicom_tag(0x0002, 0x0001, 'OB', "\x00\x01");
    $meta .= simulator_dicom_tag(0x0002, 0x0002, 'UI', $sopClass);
    $meta .= simulator_dicom_tag(0x0002, 0x0003, 'UI', $p['instanceUID']);
    $meta .= simulator_dicom_tag(0x0002, 0x0010, 'UI', $transferSyntax);
    $meta .= simulator_dicom_tag(0x0002, 0x0012, 'UI', $implUid);
    $meta .= simulator_dicom_tag(0x0002, 0x0013, 'SH', 'ONECLICKZ_RIS');
    $metaHeader = simulator_dicom_tag(0x0002, 0x0000, 'UL', pack('V', strlen($meta)));

    $body = '';
    $body .= simulator_dicom_tag(0x0008, 0x0005, 'CS', 'ISO_IR 100');
    $body .= simulator_dicom_tag(0x0008, 0x0008, 'CS', 'DERIVED\\SECONDARY\\OTHER');
    $body .= simulator_dicom_tag(0x0008, 0x0012, 'DA', $p['dateStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0013, 'TM', $p['timeStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0016, 'UI', $sopClass);
    $body .= simulator_dicom_tag(0x0008, 0x0018, 'UI', $p['instanceUID']);
    $body .= simulator_dicom_tag(0x0008, 0x0020, 'DA', $p['dateStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0021, 'DA', $p['dateStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0023, 'DA', $p['dateStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0030, 'TM', $p['timeStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0031, 'TM', $p['timeStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0033, 'TM', $p['timeStr']);
    $body .= simulator_dicom_tag(0x0008, 0x0050, 'SH', $p['accession']);
    $body .= simulator_dicom_tag(0x0008, 0x0060, 'CS', $p['modality']);
    $body .= simulator_dicom_tag(0x0008, 0x0064, 'CS', 'WSD');
    $body .= simulator_dicom_tag(0x0008, 0x0070, 'LO', 'One Clickz RIS');
    $body .= simulator_dicom_tag(0x0008, 0x0090, 'PN', $p['refPhysician']);
    $body .= simulator_dicom_tag(0x0008, 0x1030, 'LO', $p['studyDesc']);
    $body .= simulator_dicom_tag(0x0008, 0x103E, 'LO', 'RIS Console Simulator');
    $body .= simulator_dicom_tag(0x0008, 0x1090, 'LO', 'RIS Simulator');
    $body .= simulator_dicom_tag(0x0010, 0x0010, 'PN', $p['patientName']);
    $body .= simulator_dicom_tag(0x0010, 0x0020, 'LO', $p['patientId']);
    $body .= simulator_dicom_tag(0x0010, 0x0030, 'DA', '');
    $body .= simulator_dicom_tag(0x0010, 0x0040, 'CS', $p['sex']);
    $body .= simulator_dicom_tag(0x0010, 0x1010, 'AS', simulator_age($p['age']));
    $body .= simulator_dicom_tag(0x0018, 0x1020, 'LO', 'One Clickz RIS 1.0');
    $body .= simulator_dicom_tag(0x0020, 0x000D, 'UI', $p['studyUID']);
    $body .= simulator_dicom_tag(0x0020, 0x000E, 'UI', $p['seriesUID']);
    $body .= simulator_dicom_tag(0x0020, 0x0010, 'SH', '1');
    $body .= simulator_dicom_tag(0x0020, 0x0011, 'IS', '1');
    $body .= simulator_dicom_tag(0x0020, 0x0013, 'IS', (string)$p['instanceNum']);
    $body .= simulator_dicom_tag(0x0020, 0x0020, 'CS', '');
    $body .= simulator_dicom_tag(0x0028, 0x0002, 'US', pack('v', 3));
    $body .= simulator_dicom_tag(0x0028, 0x0004, 'CS', 'RGB');
    $body .= simulator_dicom_tag(0x0028, 0x0006, 'US', pack('v', 0));
    $body .= simulator_dicom_tag(0x0028, 0x0010, 'US', pack('v', $p['height']));
    $body .= simulator_dicom_tag(0x0028, 0x0011, 'US', pack('v', $p['width']));
    $body .= simulator_dicom_tag(0x0028, 0x0100, 'US', pack('v', 8));
    $body .= simulator_dicom_tag(0x0028, 0x0101, 'US', pack('v', 8));
    $body .= simulator_dicom_tag(0x0028, 0x0102, 'US', pack('v', 7));
    $body .= simulator_dicom_tag(0x0028, 0x0103, 'US', pack('v', 0));
    $body .= simulator_dicom_tag(0x0028, 0x0301, 'CS', 'NO');
    $body .= simulator_dicom_tag(0x0028, 0x2110, 'CS', '00');
    $body .= pack('v', 0x7FE0) . pack('v', 0x0010) . 'OW' . pack('xx') . pack('V', strlen($p['pixelData'])) . $p['pixelData'];

    return str_repeat("\x00", 128) . 'DICM' . $metaHeader . $meta . $body;
}

function simulator_dicom_tag(int $group, int $element, string $vr, string $value): string {
    $len = strlen($value);
    if ($len % 2 !== 0) {
        $value .= ($vr === 'UI') ? "\x00" : ' ';
        $len++;
    }

    $tag = pack('v', $group) . pack('v', $element);
    if (in_array($vr, ['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'], true)) {
        return $tag . $vr . pack('xx') . pack('V', $len) . $value;
    }
    return $tag . $vr . pack('v', $len) . $value;
}

function simulator_age(string $age): string {
    if ($age === '') { return ''; }
    if (preg_match('/^\d{3}[YMWD]$/', $age)) { return $age; }
    return str_pad((string)(int)preg_replace('/\D/', '', $age), 3, '0', STR_PAD_LEFT) . 'Y';
}

function simulator_send_to_destination(array $resourceIds, string $aeTitle, string $host, int $port): array {
    if (!$resourceIds) {
        throw new Exception('No simulator DICOM instances available to send');
    }

    $alias = 'sim_' . substr(md5($aeTitle . $host . $port), 0, 12);
    $config = [$aeTitle, $host, $port];
    $put = simulator_orthanc_request('PUT', '/modalities/' . $alias, json_encode($config), 'application/json');
    if ($put['code'] !== 200) {
        throw new Exception('Failed to register Viewer destination in Orthanc (HTTP ' . $put['code'] . '): ' . $put['body']);
    }

    $store = simulator_orthanc_request('POST', '/modalities/' . $alias . '/store', json_encode(array_values($resourceIds)), 'application/json', 0);
    if ($store['code'] !== 200) {
        $json = json_decode((string)$store['body'], true);
        $msg = $json['Message'] ?? $json['Description'] ?? $store['body'];
        throw new Exception('Failed to send images to Viewer destination (HTTP ' . $store['code'] . '): ' . $msg);
    }

    return [
        'destination' => $alias,
        'ae_title' => $aeTitle,
        'host' => $host,
        'port' => $port,
        'instances' => count($resourceIds),
        'details' => json_decode((string)$store['body'], true),
    ];
}

function simulator_delete_instance(string $instanceId): void {
    if ($instanceId === '') { return; }
    simulator_orthanc_request('DELETE', '/instances/' . rawurlencode($instanceId));
}

function simulator_orthanc_request(string $method, string $path, ?string $body = null, string $contentType = 'application/json', int $timeout = 120): array {
    $ch = curl_init(rtrim(ORTHANC_URL, '/') . $path);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: ' . $contentType]);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) { throw new Exception($err); }
    return ['code' => $code, 'body' => (string)$response];
}

function simulator_ensure_order_status(mysqli $db): void {
    $res = $db->query("SHOW COLUMNS FROM ris_orders LIKE 'status'");
    $row = $res ? $res->fetch_assoc() : null;
    $type = (string)($row['Type'] ?? '');
    if (strpos($type, "'sent_to_viewer'") !== false) { return; }
    $db->query("ALTER TABLE ris_orders MODIFY status ENUM('scheduled','arrived','sent_to_viewer','in_progress','acquired','reported','delivered','cancelled') NOT NULL DEFAULT 'scheduled'");
}
