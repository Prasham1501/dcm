<?php
/**
 * Convert uploaded PNG/JPEG images to DICOM Secondary Capture files.
 *
 * POST  multipart/form-data
 *   images[]          — one or more image files (PNG, JPEG)
 *   patient_name      — patient name
 *   patient_id        — patient ID (optional, auto-generated if empty)
 *   age               — age string (optional)
 *   sex               — M/F/O (optional)
 *   modality          — e.g. "OT" (default)
 *   study_description — (optional)
 *   referring_physician — (optional)
 *   accession_number  — (optional)
 *
 * Returns JSON:
 *   { "ok": true, "files": ["C:/xampp/.../0001.dcm", ...] }
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST required']);
    exit;
}

// ── Validate uploads ──────────────────────────────────────────
if (empty($_FILES['images'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'No images uploaded']);
    exit;
}

$images = $_FILES['images'];
$count  = is_array($images['name']) ? count($images['name']) : 1;

// Normalize single-file upload to array form
if (!is_array($images['name'])) {
    foreach (['name','type','tmp_name','error','size'] as $k) {
        $images[$k] = [$images[$k]];
    }
}

// ── Patient metadata ──────────────────────────────────────────
$patientName  = trim($_POST['patient_name']  ?? '');
$patientId    = trim($_POST['patient_id']    ?? '') ?: ('P' . time());
$age          = trim($_POST['age']           ?? '');
$sex          = trim($_POST['sex']           ?? '');
$modality     = trim($_POST['modality']      ?? 'OT');
$studyDesc    = trim($_POST['study_description']    ?? '');
$refPhysician = trim($_POST['referring_physician']  ?? '');
$accession    = trim($_POST['accession_number']     ?? '');

if ($patientName === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'patient_name is required']);
    exit;
}

// ── Output directory ──────────────────────────────────────────
$outDir = __DIR__ . '/../../uploads/converted/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $patientId);
if (!is_dir($outDir)) {
    mkdir($outDir, 0755, true);
}

// ── Shared UIDs for the study/series ──────────────────────────
$studyUID  = generateUID();
$seriesUID = generateUID();
$now       = new DateTime('now', new DateTimeZone('UTC'));
$dateStr   = $now->format('Ymd');
$timeStr   = $now->format('His');

$outputPaths = [];
$errors      = [];

for ($i = 0; $i < $count; $i++) {
    if ($images['error'][$i] !== UPLOAD_ERR_OK) {
        $errors[] = $images['name'][$i] . ': upload error ' . $images['error'][$i];
        continue;
    }

    $tmpFile = $images['tmp_name'][$i];
    $origName = $images['name'][$i];
    $mime = strtolower($images['type'][$i]);

    // Validate image type. Supported: PNG, JPEG, BMP.
    $allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/bmp', 'image/x-ms-bmp'];
    if (!in_array($mime, $allowed)) {
        // Double-check with actual file
        $detected = @mime_content_type($tmpFile);
        if (!$detected || !in_array($detected, $allowed)) {
            $errors[] = $origName . ': not a valid PNG/JPEG/BMP image';
            continue;
        }
    }

    // Read & decode the image
    $imgInfo = @getimagesize($tmpFile);
    if (!$imgInfo) {
        $errors[] = $origName . ': cannot read image dimensions';
        continue;
    }

    $width  = $imgInfo[0];
    $height = $imgInfo[1];
    $type   = $imgInfo[2]; // IMG_PNG, IMG_JPEG, etc.

    $gd = null;
    if ($type === IMAGETYPE_JPEG) {
        $gd = @imagecreatefromjpeg($tmpFile);
    } elseif ($type === IMAGETYPE_PNG) {
        $gd = @imagecreatefrompng($tmpFile);
    } elseif ($type === IMAGETYPE_BMP) {
        // imagecreatefrombmp requires PHP 7.2+ (GD). Fall back gracefully.
        $gd = function_exists('imagecreatefrombmp') ? @imagecreatefrombmp($tmpFile) : null;
    }
    if (!$gd) {
        $errors[] = $origName . ': failed to decode image';
        continue;
    }

    // Extract raw RGB pixel data (interleaved R,G,B per pixel)
    $pixelData = '';
    for ($y = 0; $y < $height; $y++) {
        for ($x = 0; $x < $width; $x++) {
            $rgb = imagecolorat($gd, $x, $y);
            $r = ($rgb >> 16) & 0xFF;
            $g = ($rgb >>  8) & 0xFF;
            $b =  $rgb        & 0xFF;
            $pixelData .= chr($r) . chr($g) . chr($b);
        }
    }
    imagedestroy($gd);

    $instanceUID = generateUID();
    $instanceNum = $i + 1;

    $dcmBytes = buildDicomFile([
        'patientName'  => $patientName,
        'patientId'    => $patientId,
        'age'          => $age,
        'sex'          => $sex,
        'modality'     => $modality,
        'studyDesc'    => $studyDesc,
        'refPhysician' => $refPhysician,
        'accession'    => $accession,
        'studyUID'     => $studyUID,
        'seriesUID'    => $seriesUID,
        'instanceUID'  => $instanceUID,
        'dateStr'      => $dateStr,
        'timeStr'      => $timeStr,
        'instanceNum'  => $instanceNum,
        'width'        => $width,
        'height'       => $height,
        'pixelData'    => $pixelData,
    ]);

    $outFile = $outDir . '/' . str_pad($instanceNum, 4, '0', STR_PAD_LEFT) . '.dcm';
    if (file_put_contents($outFile, $dcmBytes) === false) {
        $errors[] = $origName . ': failed to write .dcm';
        continue;
    }

    // Normalize to forward slashes for cross-platform compatibility
    $outputPaths[] = str_replace('\\', '/', realpath($outFile));
}

echo json_encode([
    'ok'     => count($outputPaths) > 0,
    'files'  => $outputPaths,
    'errors' => $errors,
    'study_instance_uid' => $studyUID,
]);
exit;


/* ════════════════════════════════════════════════════════════════
 *  DICOM Part 10 builder — minimal Secondary Capture Image
 * ════════════════════════════════════════════════════════════════ */

/**
 * Build a complete DICOM Part 10 file (Explicit VR Little Endian).
 */
function buildDicomFile(array $p): string {
    $implUID   = '1.2.826.0.1.3680043.8.1055.1'; // Implementation Class UID
    $implName  = 'ONECLICK_MEDIVIEW';
    $sopClass  = '1.2.840.10008.5.1.4.1.1.7';    // Secondary Capture
    $txUID     = '1.2.840.10008.1.2.1';           // Explicit VR Little Endian

    // ── File Meta Information (group 0002) ────────────────────
    $meta  = '';
    $meta .= dicomTag(0x0002, 0x0001, 'OB', "\x00\x01");                  // FileMetaInformationVersion
    $meta .= dicomTag(0x0002, 0x0002, 'UI', $sopClass);                   // MediaStorageSOPClassUID
    $meta .= dicomTag(0x0002, 0x0003, 'UI', $p['instanceUID']);            // MediaStorageSOPInstanceUID
    $meta .= dicomTag(0x0002, 0x0010, 'UI', $txUID);                      // TransferSyntaxUID
    $meta .= dicomTag(0x0002, 0x0012, 'UI', $implUID);                    // ImplementationClassUID
    $meta .= dicomTag(0x0002, 0x0013, 'SH', $implName);                   // ImplementationVersionName

    // Group length for File Meta (tag 0002,0000)
    $metaLen = strlen($meta);
    $metaHeader = dicomTag(0x0002, 0x0000, 'UL', pack('V', $metaLen));

    // ── Patient module (0010) ─────────────────────────────────
    $body  = '';
    // Specific Character Set — required so non-ASCII names round-trip correctly
    $body .= dicomTag(0x0008, 0x0005, 'CS', 'ISO_IR 100');
    // Image Type (Type 1 for SC IOD): DERIVED \ SECONDARY \ OTHER
    $body .= dicomTag(0x0008, 0x0008, 'CS', 'DERIVED\\SECONDARY\\OTHER');
    $body .= dicomTag(0x0008, 0x0012, 'DA', $p['dateStr']);                // InstanceCreationDate
    $body .= dicomTag(0x0008, 0x0013, 'TM', $p['timeStr']);                // InstanceCreationTime
    $body .= dicomTag(0x0008, 0x0016, 'UI', $sopClass);                   // SOPClassUID
    $body .= dicomTag(0x0008, 0x0018, 'UI', $p['instanceUID']);            // SOPInstanceUID
    $body .= dicomTag(0x0008, 0x0020, 'DA', $p['dateStr']);                // StudyDate
    $body .= dicomTag(0x0008, 0x0021, 'DA', $p['dateStr']);                // SeriesDate
    $body .= dicomTag(0x0008, 0x0023, 'DA', $p['dateStr']);                // ContentDate (Type 1 for SC)
    $body .= dicomTag(0x0008, 0x0030, 'TM', $p['timeStr']);                // StudyTime
    $body .= dicomTag(0x0008, 0x0031, 'TM', $p['timeStr']);                // SeriesTime
    $body .= dicomTag(0x0008, 0x0033, 'TM', $p['timeStr']);                // ContentTime (Type 1 for SC)
    $body .= dicomTag(0x0008, 0x0050, 'SH', $p['accession']);              // AccessionNumber
    $body .= dicomTag(0x0008, 0x0060, 'CS', $p['modality']);               // Modality
    // Conversion Type (Type 1 for SC IOD): WSD = Workstation
    $body .= dicomTag(0x0008, 0x0064, 'CS', 'WSD');
    $body .= dicomTag(0x0008, 0x0070, 'LO', 'OneClickz MediView');        // Manufacturer
    $body .= dicomTag(0x0008, 0x0090, 'PN', $p['refPhysician']);           // ReferringPhysicianName
    $body .= dicomTag(0x0008, 0x1030, 'LO', $p['studyDesc']);             // StudyDescription
    $body .= dicomTag(0x0008, 0x103E, 'LO', $p['studyDesc']);             // SeriesDescription
    $body .= dicomTag(0x0008, 0x1090, 'LO', 'MediView SC Converter');     // ManufacturerModelName

    $body .= dicomTag(0x0010, 0x0010, 'PN', $p['patientName']);            // PatientName
    $body .= dicomTag(0x0010, 0x0020, 'LO', $p['patientId']);             // PatientID
    $body .= dicomTag(0x0010, 0x0030, 'DA', '');                          // PatientBirthDate (Type 2 — empty allowed)
    $body .= dicomTag(0x0010, 0x0040, 'CS', $p['sex']);                    // PatientSex
    $body .= dicomTag(0x0010, 0x1010, 'AS', padAge($p['age']));           // PatientAge

    // General Equipment / Software
    $body .= dicomTag(0x0018, 0x1020, 'LO', 'OneClickz MediView 1.0');     // SoftwareVersions

    $body .= dicomTag(0x0020, 0x000D, 'UI', $p['studyUID']);              // StudyInstanceUID
    $body .= dicomTag(0x0020, 0x000E, 'UI', $p['seriesUID']);             // SeriesInstanceUID
    $body .= dicomTag(0x0020, 0x0010, 'SH', '1');                         // StudyID
    $body .= dicomTag(0x0020, 0x0011, 'IS', '1');                         // SeriesNumber
    $body .= dicomTag(0x0020, 0x0013, 'IS', (string)$p['instanceNum']);   // InstanceNumber
    $body .= dicomTag(0x0020, 0x0020, 'CS', '');                          // PatientOrientation (Type 2C — empty for SC)

    // ── Image Pixel module ────────────────────────────────────
    $body .= dicomTag(0x0028, 0x0002, 'US', pack('v', 3));                 // SamplesPerPixel = 3 (RGB)
    $body .= dicomTag(0x0028, 0x0004, 'CS', 'RGB');                        // PhotometricInterpretation
    $body .= dicomTag(0x0028, 0x0006, 'US', pack('v', 0));                 // PlanarConfiguration (interleaved)
    $body .= dicomTag(0x0028, 0x0010, 'US', pack('v', $p['height']));      // Rows
    $body .= dicomTag(0x0028, 0x0011, 'US', pack('v', $p['width']));       // Columns
    $body .= dicomTag(0x0028, 0x0100, 'US', pack('v', 8));                 // BitsAllocated
    $body .= dicomTag(0x0028, 0x0101, 'US', pack('v', 8));                 // BitsStored
    $body .= dicomTag(0x0028, 0x0102, 'US', pack('v', 7));                 // HighBit
    $body .= dicomTag(0x0028, 0x0103, 'US', pack('v', 0));                 // PixelRepresentation (unsigned)
    // ── SC Image / Lossy module (must remain in ascending tag order) ──
    $body .= dicomTag(0x0028, 0x0301, 'CS', 'NO');                         // BurnedInAnnotation (Type 1 for SC)
    $body .= dicomTag(0x0028, 0x2110, 'CS', '00');                         // LossyImageCompression = none

    // ── Pixel Data ────────────────────────────────────────────
    $pixLen = strlen($p['pixelData']);
    // Tag (7FE0,0010), VR=OW, reserved 2 bytes, then 4-byte length
    $body .= pack('v', 0x7FE0) . pack('v', 0x0010)
           . 'OW' . pack('xx') . pack('V', $pixLen)
           . $p['pixelData'];

    // ── Assemble Part 10 file ─────────────────────────────────
    $preamble = str_repeat("\x00", 128) . 'DICM';
    return $preamble . $metaHeader . $meta . $body;
}

/**
 * Encode a single DICOM tag in Explicit VR Little Endian.
 */
function dicomTag(int $group, int $element, string $vr, string $value): string {
    // Pad strings to even length
    $len = strlen($value);
    if ($len % 2 !== 0) {
        // UI pads with \0, others with space
        $value .= ($vr === 'UI') ? "\x00" : ' ';
        $len++;
    }

    $tag = pack('v', $group) . pack('v', $element);

    // VRs with 4-byte length field
    $longVRs = ['OB', 'OW', 'OF', 'SQ', 'UC', 'UN', 'UR', 'UT'];
    if (in_array($vr, $longVRs)) {
        return $tag . $vr . pack('xx') . pack('V', $len) . $value;
    }
    // Short VR: 2-byte length
    return $tag . $vr . pack('v', $len) . $value;
}

/**
 * Generate a DICOM UID (max 64 chars, dot-separated numeric).
 */
function generateUID(): string {
    // Root: 1.2.826.0.1.3680043.8.1055 (registered)
    // Append timestamp + random for uniqueness
    $root = '1.2.826.0.1.3680043.8.1055';
    $ts   = str_replace('.', '', microtime(true));
    $rand = mt_rand(1000, 9999);
    $uid  = $root . '.' . $ts . '.' . $rand;
    // UID max length is 64
    return substr($uid, 0, 64);
}

/**
 * Format age string to DICOM AS value representation (e.g. "045Y").
 */
function padAge(string $age): string {
    if ($age === '') return '';
    // If already formatted (e.g. "045Y"), return as-is
    if (preg_match('/^\d{3}[YMWD]$/', $age)) return $age;
    // Extract numeric part
    $num = (int) preg_replace('/\D/', '', $age);
    return str_pad($num, 3, '0', STR_PAD_LEFT) . 'Y';
}
