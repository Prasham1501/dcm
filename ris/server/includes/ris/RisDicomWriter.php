<?php
/**
 * Minimal DICOM Part-10 writer for Modality Worklist (.wl) files,
 * Explicit VR Little Endian. Consumed by the Orthanc Worklists plugin.
 * Requires RisUid (for the file-meta SOP Instance UID).
 */
class RisDicomWriter
{
    private const LONG_VR = ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC', 'UR'];

    public function write(string $path, array $fields): void
    {
        if (file_put_contents($path, $this->build($fields)) === false) {
            throw new RuntimeException('Failed to write worklist file: ' . $path);
        }
    }

    /** Build the full Part-10 byte string for the given worklist field map. */
    public function build(array $f): string
    {
        // ---- Dataset (Explicit VR LE), tags in ascending order ----
        $ds  = $this->el(0x0008, 0x0050, 'SH', $f['AccessionNumber'] ?? '');
        $ds .= $this->el(0x0008, 0x0090, 'PN', $f['ReferringPhysicianName'] ?? '');
        $ds .= $this->el(0x0010, 0x0010, 'PN', $f['PatientName'] ?? '');
        $ds .= $this->el(0x0010, 0x0020, 'LO', $f['PatientID'] ?? '');
        $ds .= $this->el(0x0010, 0x0030, 'DA', $f['PatientBirthDate'] ?? '');
        $ds .= $this->el(0x0010, 0x0040, 'CS', $f['PatientSex'] ?? '');
        $ds .= $this->el(0x0020, 0x000D, 'UI', $f['StudyInstanceUID'] ?? '');
        $ds .= $this->el(0x0032, 0x1060, 'LO', $f['RequestedProcedureDescription'] ?? '');

        // Scheduled Procedure Step Sequence (0040,0100) with one item.
        $item  = $this->el(0x0008, 0x0060, 'CS', $f['Modality'] ?? '');
        $item .= $this->el(0x0040, 0x0001, 'AE', $f['ScheduledStationAETitle'] ?? '');
        $item .= $this->el(0x0040, 0x0002, 'DA', $f['ScheduledProcedureStepStartDate'] ?? '');
        $item .= $this->el(0x0040, 0x0003, 'TM', $f['ScheduledProcedureStepStartTime'] ?? '');
        $item .= $this->el(0x0040, 0x0007, 'LO', $f['ScheduledProcedureStepDescription'] ?? '');
        $item .= $this->el(0x0040, 0x0009, 'SH', $f['AccessionNumber'] ?? '');
        $ds .= $this->el(0x0040, 0x0100, 'SQ', $this->itemWrap($item));

        // ---- File Meta Information (group 0002, Explicit VR LE) ----
        $sop = RisUid::join('1.2.826.0.1.3680043.10.1338.9', [time(), random_int(1, 99999)]);
        $meta  = $this->el(0x0002, 0x0001, 'OB', "\x00\x01");
        $meta .= $this->el(0x0002, 0x0002, 'UI', '1.2.840.10008.5.1.4.31');   // MWL Information Model - FIND
        $meta .= $this->el(0x0002, 0x0003, 'UI', $sop);
        $meta .= $this->el(0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1');      // Explicit VR Little Endian
        $meta .= $this->el(0x0002, 0x0012, 'UI', '1.2.826.0.1.3680043.10.1338.0.1');
        $groupLen = $this->el(0x0002, 0x0000, 'UL', pack('V', strlen($meta)));

        return str_repeat("\x00", 128) . 'DICM' . $groupLen . $meta . $ds;
    }

    private function el(int $group, int $elem, string $vr, string $val): string
    {
        if (strlen($val) % 2 !== 0) {
            $val .= ($vr === 'UI' || in_array($vr, self::LONG_VR, true)) ? "\x00" : ' ';
        }
        $tag = pack('v', $group) . pack('v', $elem);
        if (in_array($vr, self::LONG_VR, true)) {
            return $tag . $vr . "\x00\x00" . pack('V', strlen($val)) . $val;
        }
        return $tag . $vr . pack('v', strlen($val)) . $val;
    }

    private function itemWrap(string $data): string
    {
        return pack('v', 0xFFFE) . pack('v', 0xE000) . pack('V', strlen($data)) . $data;
    }
}
