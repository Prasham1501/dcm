import type { Reading, TemplateKey } from './types';

/** Canonical measurement aliases → key + label + category */
const ALIASES: Array<{
  patterns: RegExp[];
  key: string;
  label: string;
  category: TemplateKey;
}> = [
  // Obstetric
  { patterns: [/\bBPD\b/i], key: 'BPD', label: 'Biparietal Diameter', category: 'obstetric' },
  { patterns: [/\bHC\b/i, /head\s*circ/i], key: 'HC', label: 'Head Circumference', category: 'obstetric' },
  { patterns: [/\bAC\b/i, /abd\s*circ/i, /abdominal\s*circ/i], key: 'AC', label: 'Abdominal Circumference', category: 'obstetric' },
  { patterns: [/\bFL\b/i, /femur\s*len/i], key: 'FL', label: 'Femur Length', category: 'obstetric' },
  { patterns: [/\bCRL\b/i, /crown[\s-]*rump/i], key: 'CRL', label: 'Crown Rump Length', category: 'obstetric' },
  { patterns: [/\bEFW\b/i, /est\.?\s*fetal\s*wt/i, /estimated\s*fetal\s*weight/i], key: 'EFW', label: 'Estimated Fetal Weight', category: 'obstetric' },
  { patterns: [/\bGA\b/i, /gest\.?\s*age/i, /gestational\s*age/i], key: 'GA', label: 'Gestational Age', category: 'obstetric' },
  { patterns: [/\bFHR\b/i, /fetal\s*heart\s*rate/i], key: 'FHR', label: 'Fetal Heart Rate', category: 'obstetric' },
  { patterns: [/\bAFI\b/i, /amniotic\s*fluid/i], key: 'AFI', label: 'Amniotic Fluid Index', category: 'obstetric' },
  { patterns: [/\bHL\b/i, /humerus\s*len/i], key: 'HL', label: 'Humerus Length', category: 'obstetric' },

  // Abdominal
  { patterns: [/liver\s*len/i, /liver\s*size/i], key: 'liver_length', label: 'Liver Length', category: 'abdominal' },
  { patterns: [/\bspleen\b/i], key: 'spleen', label: 'Spleen Size', category: 'abdominal' },
  { patterns: [/rt\.?\s*kidney/i, /right\s*kidney/i], key: 'rk', label: 'Right Kidney', category: 'abdominal' },
  { patterns: [/lt\.?\s*kidney/i, /left\s*kidney/i], key: 'lk', label: 'Left Kidney', category: 'abdominal' },
  { patterns: [/\bkidney\b/i], key: 'kidney', label: 'Kidney', category: 'abdominal' },
  { patterns: [/\bpancreas\b/i], key: 'pancreas', label: 'Pancreas', category: 'abdominal' },
  { patterns: [/\bgallbladder\b/i, /\bGB\b/], key: 'gb', label: 'Gallbladder', category: 'abdominal' },
  { patterns: [/\baorta\b/i], key: 'aorta', label: 'Aorta', category: 'abdominal' },
  { patterns: [/\bCBD\b/i, /common\s*bile\s*duct/i], key: 'cbd', label: 'Common Bile Duct', category: 'abdominal' },
  { patterns: [/portal\s*vein/i], key: 'portal_vein', label: 'Portal Vein', category: 'abdominal' },

  // Pelvic
  { patterns: [/\buterus\b/i], key: 'uterus', label: 'Uterus', category: 'pelvic' },
  { patterns: [/endometri/i, /\bET\b/], key: 'et', label: 'Endometrial Thickness', category: 'pelvic' },
  { patterns: [/rt\.?\s*ovary/i, /right\s*ovary/i], key: 'r_ovary', label: 'Right Ovary', category: 'pelvic' },
  { patterns: [/lt\.?\s*ovary/i, /left\s*ovary/i], key: 'l_ovary', label: 'Left Ovary', category: 'pelvic' },
  { patterns: [/\bovary\b/i], key: 'ovary', label: 'Ovary', category: 'pelvic' },
  { patterns: [/\bprostate\b/i], key: 'prostate', label: 'Prostate', category: 'pelvic' },
  { patterns: [/\bbladder\b/i], key: 'bladder', label: 'Bladder', category: 'pelvic' },

  // Small parts / thyroid
  { patterns: [/rt\.?\s*thyroid\s*lobe/i, /right\s*thyroid/i], key: 'rt_thyroid', label: 'Right Thyroid Lobe', category: 'smallParts' },
  { patterns: [/lt\.?\s*thyroid\s*lobe/i, /left\s*thyroid/i], key: 'lt_thyroid', label: 'Left Thyroid Lobe', category: 'smallParts' },
  { patterns: [/thyroid\s*isthmus/i], key: 'thyroid_isthmus', label: 'Thyroid Isthmus', category: 'smallParts' },
  { patterns: [/\bthyroid\b/i], key: 'thyroid', label: 'Thyroid', category: 'smallParts' },

  // Cardiac
  { patterns: [/\bEF\b/i, /ejection\s*fraction/i], key: 'EF', label: 'Ejection Fraction', category: 'cardiac' },
  { patterns: [/\bLVIDd\b/i, /LV\s*diastol/i], key: 'LVIDd', label: 'LV Internal Dimension Diastole', category: 'cardiac' },
  { patterns: [/\bLVIDs\b/i, /LV\s*systol/i], key: 'LVIDs', label: 'LV Internal Dimension Systole', category: 'cardiac' },
  { patterns: [/\bIVS\b/i, /interventricul/i], key: 'IVS', label: 'Interventricular Septum', category: 'cardiac' },

  // Vascular
  { patterns: [/peak\s*sys/i, /\bPSV\b/i], key: 'PSV', label: 'Peak Systolic Velocity', category: 'vascular' },
  { patterns: [/end\s*dia/i, /\bEDV\b/i], key: 'EDV', label: 'End Diastolic Velocity', category: 'vascular' },
  { patterns: [/resistive\s*index/i, /\bRI\b/], key: 'RI', label: 'Resistive Index', category: 'vascular' },
  { patterns: [/pulsatility\s*index/i, /\bPI\b/], key: 'PI', label: 'Pulsatility Index', category: 'vascular' },
  // Velocity (Mindray/GE label: "Vel", "Velocity", or just "V")
  { patterns: [/\bVel\b/i, /\bvelocity\b/i], key: 'Vel', label: 'Velocity', category: 'vascular' },
  // Angle (Doppler angle correction)
  { patterns: [/\bangle\b/i, /\bang\b/i], key: 'angle', label: 'Doppler Angle', category: 'vascular' },
  // Time-Averaged Mean Velocity
  { patterns: [/\bTAMV\b/i, /\bTAV\b/i], key: 'TAMV', label: 'Time-Averaged Mean Velocity', category: 'vascular' },
  // Intima-Media Thickness
  { patterns: [/\bIMT\b/i, /intima/i], key: 'IMT', label: 'Intima-Media Thickness', category: 'vascular' },
  // Carotid / vessel specific
  { patterns: [/\bCCA\b/i, /common\s*carotid/i], key: 'CCA', label: 'Common Carotid Artery', category: 'vascular' },
  { patterns: [/\bICA\b/i, /internal\s*carotid/i], key: 'ICA', label: 'Internal Carotid Artery', category: 'vascular' },
  { patterns: [/\bATA\b/i, /anterior\s*tibial/i], key: 'ATA', label: 'Anterior Tibial Artery', category: 'vascular' },
  { patterns: [/\bPTA\b/i, /posterior\s*tibial/i], key: 'PTA', label: 'Posterior Tibial Artery', category: 'vascular' },
  { patterns: [/\bDPA\b/i, /dorsalis\s*pedis/i], key: 'DPA', label: 'Dorsalis Pedis Artery', category: 'vascular' },
];

const UNIT_NORMALIZER: Record<string, string> = {
  cm: 'cm', centimeter: 'cm', centimeters: 'cm',
  mm: 'mm', millimeter: 'mm', millimeters: 'mm',
  ml: 'ml', 'ml)': 'ml', cc: 'ml',
  g: 'g', gm: 'g', grams: 'g', kg: 'kg',
  'cm/s': 'cm/s', 'cm/sec': 'cm/s', cms: 'cm/s',
  'm/s': 'm/s', 'm/sec': 'm/s',
  '%': '%',
  wk: 'wks', wks: 'wks', weeks: 'wks', week: 'wks',
  d: 'days', days: 'days', day: 'days',
  bpm: 'bpm',
  '°': '°', deg: '°',
};

function normalizeUnit(raw: string): string {
  return UNIT_NORMALIZER[raw.toLowerCase().trim()] ?? raw.trim();
}

function identifyKey(text: string): { key: string; label: string; category: TemplateKey } {
  for (const alias of ALIASES) {
    for (const pat of alias.patterns) {
      if (pat.test(text)) {
        return { key: alias.key, label: alias.label, category: alias.category };
      }
    }
  }
  return { key: 'measurement', label: 'Measurement', category: 'generic' };
}

/** Parse a single line of text for a measurement value + unit */
export function parseLine(line: string): Reading | null {
  line = line.trim();
  if (!line) return null;

  // Dimension format: "5.2 x 3.1 x 2.8 cm" or "5.2×3.1 cm"
  const dimMatch = line.match(
    /(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)(?:\s*[xX×]\s*(\d+\.?\d*))?\s*(cm|mm)\b/i
  );
  if (dimMatch) {
    const unit = normalizeUnit(dimMatch[4]);
    const v2 = dimMatch[2];
    const v3 = dimMatch[3];
    const val = v3 ? `${dimMatch[1]} × ${v2} × ${v3}` : `${dimMatch[1]} × ${v2}`;
    const { key, label, category } = identifyKey(line);
    return { key, label, value: val, unit, confidence: 0.8, category, rawText: line };
  }

  // Standard: "BPD 5.2 cm" / "BPD: 5.2cm" / "BPD = 5.2 cm"
  const numMatch = line.match(
    /(\d+\.?\d*)\s*(cm\/s|m\/s|cm|mm|ml|cc|g|gm|kg|%|wk|wks|weeks|d|days|bpm|°|deg)\b/i
  );
  if (numMatch) {
    const value = parseFloat(numMatch[1]);
    const unit = normalizeUnit(numMatch[2]);
    const { key, label, category } = identifyKey(line);
    return { key, label, value, unit, confidence: 0.85, category, rawText: line };
  }

  // Gestational age: "GA: 24w 3d" or "24 weeks 3 days"
  const gaMatch = line.match(/(\d+)\s*w(?:eeks?)?\s*(\d+)?\s*d(?:ays?)?/i);
  if (gaMatch && /GA|gest/i.test(line)) {
    const val = gaMatch[2] ? `${gaMatch[1]}w ${gaMatch[2]}d` : `${gaMatch[1]}w`;
    return { key: 'GA', label: 'Gestational Age', value: val, unit: '', confidence: 0.9, category: 'obstetric', rawText: line };
  }

  return null;
}

/** Parse a block of text (e.g. OCR output) into Readings */
export function parseTextBlock(text: string): { readings: Reading[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Map<string, Reading>();

  const lines = text.split(/[\n\r,;]+/);
  for (const line of lines) {
    const r = parseLine(line);
    if (!r) continue;
    // deduplicate by key, higher confidence wins
    const existing = seen.get(r.key);
    if (!existing || r.confidence > existing.confidence) {
      seen.set(r.key, r);
    }
  }

  if (seen.size === 0) {
    warnings.push('No recognizable measurements found in text block');
  }

  return { readings: Array.from(seen.values()), warnings };
}
