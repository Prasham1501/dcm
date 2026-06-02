<?php
/**
 * patch-tags.php — rewrite top-level patient/study tags inside one or more
 * existing DICOM Part 10 files.
 *
 * POST application/json
 *   {
 *     "files":  ["C:/path/a.dcm", ...],
 *     "tags": {                        // any subset; missing keys are skipped
 *       "patient_name":         "...",
 *       "patient_id":           "...",
 *       "patient_birth_date":   "YYYYMMDD",
 *       "patient_sex":          "M|F|O",
 *       "patient_age":          "045Y",
 *       "referring_physician":  "...",
 *       "accession_number":     "...",
 *       "study_description":    "...",
 *       "modality":             "CS"
 *     }
 *   }
 *
 * Returns JSON:
 *   { "ok": true, "patched": N, "failed": [{ "file": "...", "error": "..." }] }
 *
 * Only top-level dataset tags are rewritten; nested sequences and pixel data
 * are untouched. Both Implicit VR LE and Explicit VR LE transfer syntaxes are
 * supported (the common cases). Compressed pixel data is preserved verbatim.
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

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$files = $body['files'] ?? [];
$tags  = $body['tags']  ?? [];
if (!is_array($files) || count($files) === 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => '"files" array is required']);
    exit;
}
if (!is_array($tags) || count($tags) === 0) {
    echo json_encode(['ok' => true, 'patched' => 0, 'failed' => []]);
    exit;
}

// Map our JSON keys to DICOM (group, element, VR).
// VR must match what the file already uses for the tag (these are the
// standard VRs from the DICOM data dictionary).
$TAG_MAP = [
    'patient_name'        => [0x0010, 0x0010, 'PN'],
    'patient_id'          => [0x0010, 0x0020, 'LO'],
    'patient_birth_date'  => [0x0010, 0x0030, 'DA'],
    'patient_sex'         => [0x0010, 0x0040, 'CS'],
    'patient_age'         => [0x0010, 0x1010, 'AS'],
    'referring_physician' => [0x0008, 0x0090, 'PN'],
    'accession_number'    => [0x0008, 0x0050, 'SH'],
    'study_description'   => [0x0008, 0x1030, 'LO'],
    'modality'            => [0x0008, 0x0060, 'CS'],
];

// Build the targets array: (group, element) → [vr, newValueString]
$targets = [];
foreach ($tags as $key => $val) {
    if (!isset($TAG_MAP[$key])) continue;
    [$g, $e, $vr] = $TAG_MAP[$key];
    $targets[($g << 16) | $e] = [$vr, (string)$val];
}
if (count($targets) === 0) {
    echo json_encode(['ok' => true, 'patched' => 0, 'failed' => []]);
    exit;
}

$patched = 0;
$failed  = [];
foreach ($files as $filePath) {
    try {
        $resolved = realpath($filePath) ?: $filePath;
        if (!is_file($resolved)) throw new RuntimeException('File not found');
        $bytes = file_get_contents($resolved);
        if ($bytes === false) throw new RuntimeException('Cannot read file');
        $new = dicomPatchTags($bytes, $targets);
        if ($new === null) throw new RuntimeException('Not a valid DICOM file');
        // Write atomically to avoid leaving a half-written file if the
        // process is killed mid-write.
        $tmp = $resolved . '.tmp_' . bin2hex(random_bytes(4));
        if (file_put_contents($tmp, $new) === false) throw new RuntimeException('Cannot write temp file');
        if (!@rename($tmp, $resolved)) {
            @unlink($tmp);
            throw new RuntimeException('Cannot replace original');
        }
        $patched++;
    } catch (Throwable $e) {
        $failed[] = ['file' => $filePath, 'error' => $e->getMessage()];
    }
}

echo json_encode(['ok' => true, 'patched' => $patched, 'failed' => $failed]);
exit;


/**
 * Rewrite specific top-level tags inside a DICOM Part 10 byte string.
 * Returns the new byte string, or null if the file is not a valid DICOM.
 *
 * @param string $bytes
 * @param array<int, array{0:string,1:string}> $targets keyed by (group<<16)|element
 */
function dicomPatchTags(string $bytes, array $targets): ?string {
    $len = strlen($bytes);
    if ($len < 132 + 4) return null;
    if (substr($bytes, 128, 4) !== 'DICM') return null;

    // File meta (group 0002) is always Explicit VR Little Endian. Parse it
    // to discover the dataset's transfer syntax, but do NOT patch any meta
    // tags (the caller's target tags all live in the dataset).
    $pos = 132;

    // Read the (0002,0000) FileMetaInformationGroupLength — UL, 4-byte value.
    [$tag, $vr, $valLen, $valOff] = readExplicitVrItem($bytes, $pos);
    if ($tag !== 0x00020000 || $vr !== 'UL' || $valLen !== 4) return null;
    $metaGroupLen = unpack('V', substr($bytes, $valOff, 4))[1];
    $metaEnd = $valOff + 4 + $metaGroupLen;
    if ($metaEnd > $len) return null;

    // Walk file meta to find TransferSyntaxUID (0002,0010)
    $txUid = '1.2.840.10008.1.2.1'; // default to Explicit VR LE
    $p = $valOff + 4;
    while ($p < $metaEnd) {
        [$t, $vr2, $vl, $vo] = readExplicitVrItem($bytes, $p);
        if ($t === 0x00020010) {
            $txUid = rtrim(substr($bytes, $vo, $vl), " \x00");
        }
        $p = $vo + $vl;
    }

    $isImplicit = ($txUid === '1.2.840.10008.1.2');
    // Encapsulated / compressed pixel data still uses Explicit VR LE for
    // the dataset header.
    $isExplicitLE = !$isImplicit;

    // Walk top-level dataset and collect target tag spans.
    // We stop iterating when we reach PixelData (7FE0,0010) — everything
    // beyond it is binary or encapsulated and we want it preserved verbatim
    // (and our target tags would never appear after PixelData).
    $spans = []; // list of [oldStart, oldEnd, newTagBytes]
    $p = $metaEnd;
    while ($p < $len) {
        if ($p + 8 > $len) break;
        $group   = unpack('v', substr($bytes, $p, 2))[1];
        $element = unpack('v', substr($bytes, $p + 2, 2))[1];
        $key = ($group << 16) | $element;

        // PixelData → stop walking the top-level dataset
        if ($group === 0x7FE0 && $element === 0x0010) break;

        if ($isExplicitLE) {
            [$t, $vr, $vl, $vo] = readExplicitVrItem($bytes, $p);
        } else {
            // Implicit VR LE: tag(4) + length(4) + value
            $vl = unpack('V', substr($bytes, $p + 4, 4))[1];
            $vo = $p + 8;
            $vr = ''; // unknown from header; assume target's standard VR
        }

        // Undefined length (0xFFFFFFFF) means a sequence with delimiter items.
        // Skip over it without descending — patient/study tags don't live in
        // nested sequences, so we leave the whole SQ as-is.
        if ($vl === 0xFFFFFFFF) {
            $p = skipUndefinedLengthItem($bytes, $vo, $len);
            if ($p === -1) break;
            continue;
        }

        if (isset($targets[$key])) {
            [$wantedVr, $newValue] = $targets[$key];
            $useVr = $isExplicitLE ? ($vr ?: $wantedVr) : '';
            $newTagBytes = encodeTag($group, $element, $useVr, $newValue, $isExplicitLE);
            $spans[] = [$p, $vo + $vl, $newTagBytes];
        }

        $p = $vo + $vl;
    }

    if (count($spans) === 0) return $bytes; // nothing to change

    // Rebuild the file: concatenate original chunks with replacements.
    // Spans are already in ascending offset order because we walked forward.
    $out = '';
    $cursor = 0;
    foreach ($spans as [$start, $end, $newBytes]) {
        $out .= substr($bytes, $cursor, $start - $cursor);
        $out .= $newBytes;
        $cursor = $end;
    }
    $out .= substr($bytes, $cursor);
    return $out;
}

/**
 * Read one Explicit-VR-Little-Endian data element header at $pos.
 * Returns [tagKey, vr, valueLength, valueOffset].
 */
function readExplicitVrItem(string $bytes, int $pos): array {
    $group   = unpack('v', substr($bytes, $pos, 2))[1];
    $element = unpack('v', substr($bytes, $pos + 2, 2))[1];
    $vr      = substr($bytes, $pos + 4, 2);
    $tagKey  = ($group << 16) | $element;

    static $longVRs = ['OB' => 1, 'OW' => 1, 'OF' => 1, 'SQ' => 1, 'UC' => 1, 'UN' => 1, 'UR' => 1, 'UT' => 1];
    if (isset($longVRs[$vr])) {
        // 2 reserved bytes, then 4-byte length
        $vl = unpack('V', substr($bytes, $pos + 8, 4))[1];
        $vo = $pos + 12;
    } else {
        $vl = unpack('v', substr($bytes, $pos + 6, 2))[1];
        $vo = $pos + 8;
    }
    return [$tagKey, $vr, $vl, $vo];
}

/**
 * Skip past an undefined-length item (SQ or encapsulated pixel data). Returns
 * the offset just after the SequenceDelimitationItem (FFFE,E0DD) terminator,
 * or -1 if no terminator is found before EOF.
 */
function skipUndefinedLengthItem(string $bytes, int $pos, int $end): int {
    while ($pos + 8 <= $end) {
        $g = unpack('v', substr($bytes, $pos, 2))[1];
        $e = unpack('v', substr($bytes, $pos + 2, 2))[1];
        $vl = unpack('V', substr($bytes, $pos + 4, 4))[1];
        // SequenceDelimitationItem
        if ($g === 0xFFFE && $e === 0xE0DD) {
            return $pos + 8;
        }
        // Item start (FFFE,E000) and Item delim (FFFE,E00D) have 4-byte length,
        // no VR. Skip past the item value.
        if ($vl === 0xFFFFFFFF) {
            // Nested undefined-length item
            $pos = skipUndefinedLengthItem($bytes, $pos + 8, $end);
            if ($pos === -1) return -1;
        } else {
            $pos += 8 + $vl;
        }
    }
    return -1;
}

/**
 * Encode a single tag with the given value. For strings, the value is padded
 * to even length per DICOM rules. Numeric/binary VRs are not used by this
 * patcher's target list — all targets are string VRs.
 */
function encodeTag(int $group, int $element, string $vr, string $value, bool $explicitVr): string {
    // Even-length padding
    if (strlen($value) % 2 !== 0) {
        $value .= ($vr === 'UI') ? "\x00" : ' ';
    }
    $tag = pack('v', $group) . pack('v', $element);
    $len = strlen($value);

    if (!$explicitVr) {
        // Implicit VR: tag(4) + length(4)
        return $tag . pack('V', $len) . $value;
    }
    // Explicit VR
    static $longVRs = ['OB' => 1, 'OW' => 1, 'OF' => 1, 'SQ' => 1, 'UC' => 1, 'UN' => 1, 'UR' => 1, 'UT' => 1];
    if (isset($longVRs[$vr])) {
        return $tag . $vr . pack('xx') . pack('V', $len) . $value;
    }
    return $tag . $vr . pack('v', $len) . $value;
}
