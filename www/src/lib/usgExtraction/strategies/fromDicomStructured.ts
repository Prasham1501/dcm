/**
 * Strategy 0 (NEW): Extract structured measurements from DICOM tags.
 * Reads SR content sequences, graphic annotations, and known tag locations.
 * Returns typed measurements with 100% confidence — no OCR, no regex guessing.
 */
import type { Reading, TemplateKey } from '../types';
import { parseTextBlock } from '../parseUsgText';

/** Map well-known DICOM SR concept names to our internal keys */
const SR_NAME_MAP: Record<string, { key: string; label: string; category: TemplateKey }> = {
  // Obstetric
  'biparietal diameter':          { key: 'BPD', label: 'Biparietal Diameter', category: 'obstetric' },
  'head circumference':          { key: 'HC', label: 'Head Circumference', category: 'obstetric' },
  'abdominal circumference':     { key: 'AC', label: 'Abdominal Circumference', category: 'obstetric' },
  'femur length':                { key: 'FL', label: 'Femur Length', category: 'obstetric' },
  'crown rump length':           { key: 'CRL', label: 'Crown Rump Length', category: 'obstetric' },
  'estimated fetal weight':      { key: 'EFW', label: 'Estimated Fetal Weight', category: 'obstetric' },
  'gestational age':             { key: 'GA', label: 'Gestational Age', category: 'obstetric' },
  'fetal heart rate':            { key: 'FHR', label: 'Fetal Heart Rate', category: 'obstetric' },
  'amniotic fluid index':        { key: 'AFI', label: 'Amniotic Fluid Index', category: 'obstetric' },
  'humerus length':              { key: 'HL', label: 'Humerus Length', category: 'obstetric' },
  'estimated delivery date':     { key: 'EDD', label: 'Estimated Due Date', category: 'obstetric' },
  'estimated due date':          { key: 'EDD', label: 'Estimated Due Date', category: 'obstetric' },
  // Cardiac
  'ejection fraction':           { key: 'EF', label: 'Ejection Fraction', category: 'cardiac' },
  'lv internal dimension diastole': { key: 'LVIDd', label: 'LV Internal Dimension Diastole', category: 'cardiac' },
  'lv internal dimension systole':  { key: 'LVIDs', label: 'LV Internal Dimension Systole', category: 'cardiac' },
  // Vascular
  'peak systolic velocity':      { key: 'PSV', label: 'Peak Systolic Velocity', category: 'vascular' },
  'end diastolic velocity':      { key: 'EDV', label: 'End Diastolic Velocity', category: 'vascular' },
  'resistive index':             { key: 'RI', label: 'Resistive Index', category: 'vascular' },
  'pulsatility index':           { key: 'PI', label: 'Pulsatility Index', category: 'vascular' },
};

/** Normalize DICOM SR unit codes to display units */
const UNIT_MAP: Record<string, string> = {
  cm: 'cm', mm: 'mm', ml: 'ml', '%': '%',
  'cm/s': 'cm/s', 'm/s': 'm/s',
  g: 'g', gm: 'g', kg: 'kg',
  bpm: 'bpm', '{H.B.}/min': 'bpm',
  wk: 'wks', d: 'days',
  '{percentile}': '%',
  '1': '',       // unitless ratio (RI, PI)
  '{ratio}': '', // unitless ratio
};

function normalizeUnit(raw: string): string {
  return UNIT_MAP[raw] ?? UNIT_MAP[raw.toLowerCase()] ?? raw;
}

interface StructuredMeasurement {
  source: string; // 'sr' | 'sr-text' | 'graphic-annotation' | 'image-comments' | etc.
  name: string;
  value: string;
  unit: string;
}

export async function fromDicomStructured(
  filePaths: string[]
): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  if (!filePaths || filePaths.length === 0) {
    warnings.push('No file paths provided for structured extraction');
    return { readings: [], warnings };
  }

  const api = (window as any).electronAPI;
  if (!api?.invoke) {
    warnings.push('Electron IPC not available — skipping structured extraction');
    return { readings: [], warnings };
  }

  try {
    const result = await api.invoke('extract-dicom-all-readings', { filePaths });
    const rawStructured: StructuredMeasurement[] = result?.structured ?? [];
    const rawTextFragments: string[] = result?.textFragments ?? [];

    if (rawStructured.length === 0 && rawTextFragments.length === 0) {
      warnings.push('No structured measurements or text found in DICOM tags');
      return { readings: [], warnings };
    }

    const readings: Reading[] = [];
    const keyCount = new Map<string, number>();

    // ── Process typed SR measurements (100% confidence) ──
    for (const m of rawStructured) {
      if ((m.source === 'sr' || m.source === 'sr-code') && m.name && m.value) {
        // Structured numeric measurement — directly typed, 100% accuracy
        const nameLower = m.name.toLowerCase().trim();
        const mapped = SR_NAME_MAP[nameLower];

        const numVal = parseFloat(m.value);
        const unit = normalizeUnit(m.unit);

        if (mapped) {
          const count = (keyCount.get(mapped.key) || 0) + 1;
          keyCount.set(mapped.key, count);
          const uniqueKey = count === 1 ? mapped.key : `${mapped.key}_${count}`;
          const label = count === 1 ? mapped.label : `${mapped.label} (${count})`;

          readings.push({
            key: uniqueKey,
            label,
            value: isNaN(numVal) ? m.value : numVal,
            unit,
            confidence: 1.0,
            category: mapped.category,
            rawText: `[DICOM SR] ${m.name}: ${m.value} ${m.unit}`,
          });
        } else {
          // Unknown SR concept name — still add it with high confidence
          const safeKey = m.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
          const count = (keyCount.get(safeKey) || 0) + 1;
          keyCount.set(safeKey, count);
          const uniqueKey = count === 1 ? safeKey : `${safeKey}_${count}`;

          readings.push({
            key: uniqueKey,
            label: m.name,
            value: isNaN(numVal) ? m.value : numVal,
            unit,
            confidence: 1.0,
            category: 'generic',
            rawText: `[DICOM SR] ${m.name}: ${m.value} ${m.unit}`,
          });
        }
      } else if (m.source === 'sr-text' && m.name && m.value) {
        // SR text observation — store as-is
        const safeKey = m.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        readings.push({
          key: safeKey,
          label: m.name,
          value: m.value,
          unit: '',
          confidence: 1.0,
          category: 'generic',
          rawText: `[DICOM SR Text] ${m.name}: ${m.value}`,
        });
      }
    }

    // ── Parse text fragments from tags (graphic annotations, comments, private tags) ──
    if (rawTextFragments.length > 0) {
      const combined = rawTextFragments.join('\n');
      const { readings: parsedReadings, warnings: parseWarnings } = parseTextBlock(combined);
      // Add with slightly lower confidence since they're parsed from text
      for (const r of parsedReadings) {
        // Avoid duplicates — skip if we already have a structured reading with same key
        const existingKeys = new Set(readings.map(rd => rd.key.replace(/_\d+$/, '')));
        if (!existingKeys.has(r.key.replace(/_\d+$/, ''))) {
          r.confidence = 0.95; // High but not 100% — it's from tag text, not structured
          r.rawText = `[DICOM Tag Text] ${r.rawText || ''}`;
          readings.push(r);
        }
      }
      warnings.push(...parseWarnings);
    }

    console.log(`[fromDicomStructured] ${readings.length} readings from structured tags`);
    return { readings, warnings };
  } catch (err: any) {
    warnings.push(`Structured extraction failed: ${err?.message}`);
    return { readings: [], warnings };
  }
}
