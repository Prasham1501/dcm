import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import dicomParser from 'dicom-parser';

// PHP writes the .wl; we parse it back with an independent library to prove validity.
const PHP = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
const EMIT = join(process.cwd(), 'tests', 'wl-emit.php');

const str = (ds: any, tag: string) => (ds.string(tag) || '').trim();

describe('RisDicomWriter (.wl round-trip)', () => {
  it('produces a parseable DICOM worklist with the expected tags', () => {
    const out = join(tmpdir(), `oczwl_${Date.now()}.wl`);
    execFileSync(PHP, [EMIT, out]);
    expect(existsSync(out)).toBe(true);

    const buf = readFileSync(out);
    const ds = dicomParser.parseDicom(new Uint8Array(buf));

    expect(str(ds, 'x00080050')).toBe('OCZ000123'); // AccessionNumber
    expect(str(ds, 'x0020000d')).toBe('1.2.826.0.1.3680043.10.1338.20260602.123'); // StudyInstanceUID
    expect(str(ds, 'x00100010')).toBe('Asha Devi'); // PatientName
    expect(str(ds, 'x00100020')).toBe('DCM45'); // PatientID
    expect(str(ds, 'x00100040')).toBe('F'); // PatientSex

    const sps = (ds.elements as any).x00400100; // ScheduledProcedureStepSequence
    expect(sps?.items?.length).toBeGreaterThan(0);
    const item = sps.items[0].dataSet;
    expect(str(item, 'x00080060')).toBe('US'); // Modality
    expect(str(item, 'x00400001')).toBe('USG1'); // ScheduledStationAETitle
    expect(str(item, 'x00400002')).toBe('20260602'); // start date
    expect(str(item, 'x00400003')).toBe('103000'); // start time
  });
});
