import type { Reading, TemplateKey } from './types';

/** Canonical measurement aliases → key + label + category */
const ALIASES: Array<{
  patterns: RegExp[];
  key: string;
  label: string;
  category: TemplateKey;
}> = [
  // Obstetric — patterns cover Mindray, GE Voluson/Logiq, Philips HD15/iU22/EPIQ,
  // Samsung Hera, Canon Aplio (Toshiba), Siemens Acuson, Hitachi/Aloka.
  // Hitachi appends sequence numbers like "BPD(1)"; Voluson appends formula like "EFW(Hadlock)".
  { patterns: [/\bBPD\b/i, /\bB\.P\.D\b/i, /\bBPD\(\d+\)/i], key: 'BPD', label: 'Biparietal Diameter', category: 'obstetric' },
  { patterns: [/\bHC\b/i, /head\s*circ/i, /\bH\.C\b/i, /\bHC\(\d+\)/i, /\bHC\(HAD\)/i], key: 'HC', label: 'Head Circumference', category: 'obstetric' },
  { patterns: [/\bAC\b/i, /abd\s*circ/i, /abdominal\s*circ/i, /\bA\.C\b/i, /\bAC\(\d+\)/i, /\bAC\(HAD\)/i], key: 'AC', label: 'Abdominal Circumference', category: 'obstetric' },
  { patterns: [/\bFL\b/i, /femur\s*len/i, /\bfemur\b/i, /\bF\.L\b/i, /\bFL\(\d+\)/i], key: 'FL', label: 'Femur Length', category: 'obstetric' },
  { patterns: [/\bCRL\b/i, /crown[\s-]*rump/i, /\bC\.R\.L\b/i, /\bCRL\(\d+\)/i], key: 'CRL', label: 'Crown Rump Length', category: 'obstetric' },
  { patterns: [/\bEFW\b/i, /est\.?\s*fetal\s*wt/i, /estimated\s*fetal\s*weight/i, /\bEFW\([A-Za-z]+\)/i, /Hadlock\s*EFW/i], key: 'EFW', label: 'Estimated Fetal Weight', category: 'obstetric' },
  { patterns: [/\bGA\b/i, /gest\.?\s*age/i, /gestational\s*age/i, /\bGA\([A-Za-z]+\)/i, /\bAUA\b/i, /\bLMP\b/i], key: 'GA', label: 'Gestational Age', category: 'obstetric' },
  { patterns: [/\bFHR\b/i, /fetal\s*heart\s*rate/i, /fetal\s*HR\b/i, /\bFetal\b.*\bHR\b/i], key: 'FHR', label: 'Fetal Heart Rate', category: 'obstetric' },
  { patterns: [/\bAFI\b/i, /amniotic\s*fluid/i, /\bMVP\b/i, /max\s*vert\s*pocket/i], key: 'AFI', label: 'Amniotic Fluid Index', category: 'obstetric' },
  { patterns: [/\bHL\b/i, /humerus\s*len/i, /\bhumerus\b/i], key: 'HL', label: 'Humerus Length', category: 'obstetric' },
  { patterns: [/\bEDD\b/i, /est\.?\s*due\s*date/i, /estimated\s*delivery/i, /\bEDC\b/i, /estimated\s*due\s*conception/i], key: 'EDD', label: 'Estimated Due Date', category: 'obstetric' },
  { patterns: [/\bNT\b/i, /nuchal\s*translucency/i], key: 'NT', label: 'Nuchal Translucency', category: 'obstetric' },
  { patterns: [/\bNB\b/i, /nasal\s*bone/i], key: 'NB', label: 'Nasal Bone', category: 'obstetric' },
  { patterns: [/\bAPTD\b/i, /\bA\.P\.T\.D\b/i], key: 'APTD', label: 'Antero-Posterior Trunk Diameter', category: 'obstetric' },
  { patterns: [/\bTTD\b/i, /\bT\.T\.D\b/i], key: 'TTD', label: 'Transverse Trunk Diameter', category: 'obstetric' },
  // Cisterna Magna — must NOT be preceded by a digit (otherwise we'd match the 'cm' unit)
  { patterns: [/(?<![\d.])\bCM\b\s*[:=]?\s*(?=\d)/i, /cisterna\s*magna/i], key: 'CM', label: 'Cisterna Magna', category: 'obstetric' },
  { patterns: [/\bOFD\b/i, /occipito[\s-]*frontal/i], key: 'OFD', label: 'Occipito-Frontal Diameter', category: 'obstetric' },

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
  'cm/s': 'cm/s', 'cm/sec': 'cm/s', cms: 'cm/s', cmis: 'cm/s', 'cm\\s': 'cm/s',
  'm/s': 'm/s', 'm/sec': 'm/s', mis: 'm/s',
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

/** Parse a single line of text for a measurement value + unit.
 * @param labelHint - Optional pre-identified label from a preceding label-only line (multi-line format). */
export function parseLine(line: string, labelHint?: { key: string; label: string; category: TemplateKey }): Reading | null {
  line = line.trim();
  if (!line) return null;

  // ── Early rejection of machine settings noise ──
  // These are ultrasound machine parameters, not medical measurements.
  // Rejecting them early prevents false matches and speeds up parsing.
  if (/^(PRF|IWF|WF|DR|FR|FH|PW|TIS|MI|SVD|SV|AP|G\d|F\d|IP|B\d|THI|STC|AO)\s*[\d.]/i.test(line)) return null;
  if (/^\d+\s*fps$/i.test(line)) return null; // frame rate
  if (/^[A-Z]{1,3}\d+\.\d[A-Z]\d/i.test(line)) return null; // concatenated settings like "F4.2G58"

  // Pre-clean common OCR artifacts
  // cmis → cm/s, cms → cm/s (common Tesseract misread of "cm/s")
  let cleaned = line
    .replace(/cmis/gi, 'cm/s')
    .replace(/cm\\s/gi, 'cm/s')
    .replace(/(\d)cms/gi, '$1 cm/s')
    .replace(/\bcms\b/gi, 'cm/s')
    // OB OCR artifacts: "1AC" → "AC", "*FL" → "FL", "® FL" → "FL"
    .replace(/^[©®*#\[\]]+\s*/g, '')
    // Remove leading "1" before known measurement prefixes (OCR misread)
    .replace(/1(AC|HC|FL|BPD)(?=\d|\s|$)/gi, '$1')
    // Numbered Doppler readings: "1 Vel 63.61 cm/s" → "Vel 63.61 cm/s"
    .replace(/^\d+\s+(Vel|PSV|EDV|RI|PI|TAMV|Angle)\b/i, '$1')
    // Insert space between label and number when concatenated: "AC31.04" → "AC 31.04"
    .replace(/(AC|HC|FL|BPD|CRL|EFW|AFI|HL|PSV|EDV|Vel|TAMV|IMT|HR|FHR|NT|NB|OFD|APTD|TTD)(\d)/gi, '$1 $2')
    // "31.04m75%" → "31.04cm 75%" (garbled 'c' before 'm')
    .replace(/(\d+\.\d+)m(\d+%)/g, '$1cm $2')
    // GA OCR: "35wo0d" → "35w0d" (OCR misread '0' as 'o' before digit+d)
    .replace(/(\d+)w[oO](\d+d)/gi, '$1w$2')
    // Philips/GE "=" separator: "BPD=5.2cm" → "BPD 5.2cm"; "GA=23w4d" → "GA 23w4d"
    .replace(/([A-Za-z\)])\s*=\s*(\d)/g, '$1 $2')
    // Canon Aplio dot leaders: "BPD ........ 5.2 cm" → "BPD 5.2 cm"
    .replace(/\s*\.{2,}\s*/g, ' ')
    // Voluson/GE percentile suffix: "5.2cm(70%)" or "5.2 cm (70%)" → "5.2cm" (drop percentile)
    .replace(/(\d+(?:\.\d+)?\s*(?:cm|mm|g|kg|ml))\s*\(\s*\d+\s*%\s*\)/gi, '$1')
    // Hitachi/Aloka sequence parens: "BPD(1) 5.2cm" → "BPD 5.2cm"
    .replace(/\b(BPD|HC|AC|FL|CRL|EFW|HL|GA|NT|FHR)\(\d+\)\b/gi, '$1')
    // Voluson formula tag: "EFW(Hadlock) 2719g" → "EFW 2719g"; "GA(AUA) 23w4d" → "GA 23w4d"
    .replace(/\b(EFW|GA|HC|AC|BPD|FL)\([A-Za-z]+\)/gi, '$1')
    // Standalone confidence interval: "5.2 cm ± 0.3" → "5.2 cm" (drop ± part)
    .replace(/\s*[±+\-]\s*\d+(?:\.\d+)?\s*(?:cm|mm)?\b/gi, '');

  // Dimension format: "5.2 x 3.1 x 2.8 cm" or "5.2×3.1 cm"
  const dimMatch = cleaned.match(
    /(-?\d+\.?\d*)\s*[xX×]\s*(-?\d+\.?\d*)(?:\s*[xX×]\s*(-?\d+\.?\d*))?\s*(cm|mm)\b/i
  );
  if (dimMatch) {
    const unit = normalizeUnit(dimMatch[4]);
    const v2 = dimMatch[2];
    const v3 = dimMatch[3];
    const val = v3 ? `${dimMatch[1]} × ${v2} × ${v3}` : `${dimMatch[1]} × ${v2}`;
    const { key, label, category } = identifyKey(cleaned);
    return { key, label, value: val, unit, confidence: 0.8, category, rawText: line };
  }

  // ── OB-specific patterns (BEFORE generic numMatch to avoid false positives) ──

  // Gestational age: "GA: 24w 3d" or "24 weeks 3 days" or "GA 36wad" (OCR misread digit as letter)
  const gaMatch = cleaned.match(/(\d+)\s*w(?:eeks?)?\s*([\da-z])?\s*d(?:ays?)?/i);
  if (gaMatch && /GA|gest/i.test(cleaned)) {
    const days = gaMatch[2] && /\d/.test(gaMatch[2]) ? gaMatch[2] : '0';
    const val = `${gaMatch[1]}w ${days}d`;
    return { key: 'GA', label: 'Gestational Age', value: val, unit: '', confidence: 0.9, category: 'obstetric', rawText: line };
  }

  // Gestational age from header: "GA=37w3d" (no spaces)
  const gaHeaderMatch = cleaned.match(/GA\s*=\s*(\d+)\s*w\s*(\d+)?\s*d/i);
  if (gaHeaderMatch) {
    const val = gaHeaderMatch[2] ? `${gaHeaderMatch[1]}w ${gaHeaderMatch[2]}d` : `${gaHeaderMatch[1]}w`;
    return { key: 'GA', label: 'Gestational Age', value: val, unit: '', confidence: 0.9, category: 'obstetric', rawText: line };
  }

  // EDD: "EDD 16/04/2022" or "EDD: 2022-04-16"
  const eddMatch = cleaned.match(/EDD\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (eddMatch) {
    return { key: 'EDD', label: 'Estimated Due Date', value: eddMatch[1], unit: '', confidence: 0.9, category: 'obstetric', rawText: line };
  }

  // EFW without decimal: "EFW 2719g" or "EFW: 2719 g"
  const efwMatch = cleaned.match(/EFW\s*:?\s*(\d{3,5})\s*(g|gm|kg)\b/i);
  if (efwMatch) {
    const value = parseInt(efwMatch[1]);
    const unit = normalizeUnit(efwMatch[2]);
    return { key: 'EFW', label: 'Estimated Fetal Weight', value, unit, confidence: 0.85, category: 'obstetric', rawText: line };
  }

  // ── Dimensionless vascular ratios (RI, PI, S/D) — no unit suffix ──
  // RI: "RI 0.72" / "RI: 0.72" / "RI=0.72" / "RI0.72"
  const riMatch = cleaned.match(/\bRI\s*[=:]?\s*(\d+\.\d+)/i);
  if (riMatch) {
    return { key: 'RI', label: 'Resistive Index', value: parseFloat(riMatch[1]), unit: '', confidence: 0.88, category: 'vascular', rawText: line };
  }
  // PI: "PI 1.50" / "PI: 1.50" / "PI=1.50" / "PI1.50"
  const piMatch = cleaned.match(/\bPI\s*[=:]?\s*(\d+\.\d+)/i);
  if (piMatch) {
    return { key: 'PI', label: 'Pulsatility Index', value: parseFloat(piMatch[1]), unit: '', confidence: 0.88, category: 'vascular', rawText: line };
  }
  // S/D ratio: "S/D 4.5" or "SD 4.5" or "S/D: 4.5"
  const sdMatch = cleaned.match(/\bS\s*\/?\s*D\s*[=:]?\s*(\d+\.\d+)/i);
  if (sdMatch) {
    return { key: 'SD', label: 'S/D Ratio', value: parseFloat(sdMatch[1]), unit: '', confidence: 0.85, category: 'vascular', rawText: line };
  }

  // ── Organ-context dimension labels (Length / Width / Depth) ──
  // Philips/GE renal/abdo studies show "Length 9.74 cm" or "X Length 3.78 cm".
  // We treat these as generic length/width/depth — the parseTextBlock loop will
  // attach the active organ context (RT Kidney, Liver, etc.) afterwards.
  const dimLabelMatch = cleaned.match(/(?:\bX\s+)?\b(Length|Width|Depth|Height)\b\s*[:=]?\s*(-?\d+\.?\d*)\s*(cm|mm)\b/i);
  if (dimLabelMatch) {
    const isCross = /\bX\s+(?:Length|Width|Depth)/i.test(cleaned);
    const labelWord = dimLabelMatch[1].toLowerCase();
    // "X Length" on a kidney/organ usually means the cross-axis (width)
    const key = isCross && labelWord === 'length' ? 'width' : labelWord;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return {
      key, label,
      value: parseFloat(dimLabelMatch[2]),
      unit: normalizeUnit(dimLabelMatch[3]),
      confidence: 0.78,
      category: 'abdominal',
      rawText: line,
    };
  }

  // ── Generic measurement: "BPD 5.2 cm" / "Vel 63.61 cm/s" ──
  // Use lookahead instead of \b — works for non-word chars like ° and %
  const numMatch = cleaned.match(
    /(-?\d+\.?\d*)\s*(cm\/s|m\/s|cm|mm|ml|cc|g|gm|kg|%|wk|wks|weeks|bpm|°|deg)(?=\s|$|[^a-zA-Z])/i
  );
  if (numMatch) {
    const value = parseFloat(numMatch[1]);
    const unit = normalizeUnit(numMatch[2]);
    const { key, label, category } = identifyKey(cleaned);

    // Reject biometry/OB measurements with '%' unit — these are on-screen percentiles, not measurements
    const BIOMETRY_KEYS = new Set(['BPD', 'HC', 'AC', 'FL', 'CRL', 'EFW', 'AFI', 'HL']);
    if (unit === '%' && BIOMETRY_KEYS.has(key)) {
      return null;
    }

    if (key === 'measurement') {
      // If we have a label hint from the preceding line (multi-line Doppler format), use it
      if (labelHint) {
        return { key: labelHint.key, label: labelHint.label, value, unit, confidence: 0.8, category: labelHint.category, rawText: line };
      }
      return null; // Still skip truly generic measurements — too noisy from OCR
    }
    return { key, label, value, unit, confidence: 0.85, category, rawText: line };
  }

  // Standalone dimensionless number with labelHint (e.g. RI/PI with no unit: "0.78")
  if (labelHint) {
    const bareNum = cleaned.match(/^(-?\d+\.\d+)\s*$/);
    if (bareNum) {
      return { key: labelHint.key, label: labelHint.label, value: parseFloat(bareNum[1]), unit: '', confidence: 0.75, category: labelHint.category, rawText: line };
    }
  }

  return null;
}

/** Known vessel/anatomy name patterns — used as context labels for nearby measurements */
const VESSEL_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Lower extremity arteries
  { pattern: /dorsalis\s*pedis/i, name: 'Dorsalis Pedis A.' },
  { pattern: /\bDPA\b/, name: 'Dorsalis Pedis A.' },
  { pattern: /posterior\s*tibial/i, name: 'Post. Tibial A.' },
  { pattern: /\bPTA\b/, name: 'Post. Tibial A.' },
  { pattern: /anterior\s*tibial/i, name: 'Ant. Tibial A.' },
  { pattern: /\bATA\b/, name: 'Ant. Tibial A.' },
  { pattern: /popliteal/i, name: 'Popliteal A.' },
  { pattern: /common\s*femoral/i, name: 'Common Femoral A.' },
  { pattern: /\bCFA\b/, name: 'Common Femoral A.' },
  { pattern: /superficial\s*femoral/i, name: 'Superficial Femoral A.' },
  { pattern: /\bSFA\b/, name: 'Superficial Femoral A.' },
  { pattern: /deep\s*femoral/i, name: 'Deep Femoral A.' },
  { pattern: /\bDFA\b/, name: 'Deep Femoral A.' },
  { pattern: /peroneal/i, name: 'Peroneal A.' },
  // Carotid
  { pattern: /common\s*carotid/i, name: 'CCA' },
  { pattern: /internal\s*carotid/i, name: 'ICA' },
  { pattern: /external\s*carotid/i, name: 'ECA' },
  { pattern: /vertebral/i, name: 'Vertebral A.' },
  { pattern: /subclavian/i, name: 'Subclavian A.' },
  // Digital / toe arteries
  { pattern: /digital\s*artery[^]*?(\d+\w*\s*toe)/i, name: 'Digital A.' },
  { pattern: /digital\s*artery/i, name: 'Digital A.' },
  // Renal
  { pattern: /renal\s*artery/i, name: 'Renal A.' },
  { pattern: /\bMRA\b/, name: 'Main Renal A.' },
  // Organ context for abdominal scans — used to label generic Length/Width measurements
  { pattern: /rt\.?\s*kidn(?:ey)?|right\s*kidn(?:ey)?|\bRT\s*KIDN\b/i, name: 'RT Kidney' },
  { pattern: /lt\.?\s*kidn(?:ey)?|left\s*kidn(?:ey)?|\bLT\s*KIDN\b/i, name: 'LT Kidney' },
  { pattern: /\bliver\b/i, name: 'Liver' },
  { pattern: /\bspleen\b/i, name: 'Spleen' },
  { pattern: /\bpancreas\b/i, name: 'Pancreas' },
  { pattern: /gallbladder|\bGB\b/i, name: 'Gallbladder' },
  { pattern: /\bprostate\b/i, name: 'Prostate' },
  { pattern: /\buterus\b/i, name: 'Uterus' },
  { pattern: /\bovary\b/i, name: 'Ovary' },
  { pattern: /\bbladder\b/i, name: 'Bladder' },
  { pattern: /\bthyroid\b/i, name: 'Thyroid' },
  // Aorta
  { pattern: /\baorta\b/i, name: 'Aorta' },
  // Generic (catch-all for unrecognized arteries/veins)
  { pattern: /lower\s*ext(?:remity)?\s*artery/i, name: 'Lower Ext. Artery' },
  { pattern: /upper\s*ext(?:remity)?\s*artery/i, name: 'Upper Ext. Artery' },
];

/** Try to detect a vessel/anatomy name from a line of text */
function detectVesselName(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return null;
  for (const v of VESSEL_PATTERNS) {
    const m = trimmed.match(v.pattern);
    if (m) {
      // For digital artery, include the toe number if captured
      if (v.name === 'Digital A.' && m[1]) {
        return `Digital A. ${m[1].trim()}`;
      }
      return v.name;
    }
  }
  return null;
}

/** Parse a block of text (e.g. OCR output) into Readings */
export function parseTextBlock(text: string): { readings: Reading[]; warnings: string[] } {
  // Normalize Philips/GE cross-axis notation: "X Length" / "X Width" is the
  // perpendicular measurement on an organ — treat as Width regardless of label.
  text = text.replace(/\bX\s+Length\b/gi, 'Width').replace(/\bXlength\b/gi, 'Width');
  const warnings: string[] = [];
  const seen = new Map<string, Reading>();
  const keyCount = new Map<string, number>();
  let currentVessel: string | null = null;
  // For multi-line format: label on one line, value on the next (common on Doppler/Mindray DC-7)
  let pendingLabel: { key: string; label: string; category: TemplateKey } | null = null;

  // Split on newlines, commas, semicolons first
  const rawLines = text.split(/[\n\r,;]+/);
  // Then further split lines that have multiple measurements concatenated (e.g. "BPD 92mm HC 328mm AC 310mm")
  const lines: string[] = [];
  const MEAS_LABELS = /(?=\b(?:BPD|HC|AC|FL|CRL|EFW|FHR|AFI|HL|NT|NB|IT|GA|EDD|EDC|PSV|EDV|RI|PI|TAMV|IMT|Vel|OFD|APTD|TTD|AUA|LMP|X\s+Length|Length|Width|Depth|Height)\b)/i;
  for (const raw of rawLines) {
    const parts = raw.split(MEAS_LABELS).map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length > 1) {
      lines.push(...parts);
    } else {
      lines.push(raw);
    }
  }
  console.log(`[parseTextBlock] Parsing ${lines.length} lines...`);
  for (const line of lines) {
    // Check if this line names a vessel/anatomy — use it as context for subsequent measurements
    const vessel = detectVesselName(line);
    if (vessel) {
      currentVessel = vessel;
      pendingLabel = null;
      console.log(`  [VESSEL] "${line.trim()}" → context: ${vessel}`);
    }

    const r = parseLine(line, pendingLabel ?? undefined);
    if (r) {
      pendingLabel = null; // consumed
      // Apply vessel context: prefix label with vessel name for generic measurement types
      if (currentVessel && (r.key === 'Vel' || r.key === 'angle' || r.key === 'PSV' || r.key === 'EDV' || r.key === 'RI' || r.key === 'PI' || r.key === 'TAMV' || r.key === 'SD' || r.key === 'IMT' || r.key === 'length' || r.key === 'width' || r.key === 'depth')) {
        r.label = `${currentVessel} — ${r.label}`;
        r.key = `${currentVessel}_${r.key}`;
      }
      console.log(`  [MATCH] "${line.trim()}" → ${r.key}=${r.value} ${r.unit}`);
    }
    if (!r) {
      // Detect a standalone label line (e.g. "PSV", "RI", "EDV", "2 Vel") for multi-line format.
      // Save it so the NEXT line's numeric value can be paired with it.
      let trimmed = line.trim().replace(/^[©®*#\[\]]+\s*/g, '').replace(/[\s:=]+$/, '');
      // Strip leading number prefix: "1 Vel" → "Vel", "2 PSV" → "PSV"
      trimmed = trimmed.replace(/^\d+\s+/, '');
      if (trimmed.length >= 2 && trimmed.length <= 10 && !/\d/.test(trimmed) && /^[A-Za-z/]+$/.test(trimmed)) {
        const identified = identifyKey(trimmed);
        if (identified.key !== 'measurement') {
          pendingLabel = identified;
          console.log(`  [PENDING] "${trimmed}" → waiting for value`);
        } else {
          pendingLabel = null;
        }
      } else {
        pendingLabel = null;
      }
      continue;
    }

    // Number duplicate keys: Vel → Vel, Vel_2, Vel_3, etc.
    const count = (keyCount.get(r.key) || 0) + 1;
    keyCount.set(r.key, count);
    const uniqueKey = count === 1 ? r.key : `${r.key}_${count}`;
    r.key = uniqueKey;
    if (count > 1) {
      r.label = `${r.label} (${count})`;
    }
    seen.set(uniqueKey, r);
  }

  if (seen.size === 0) {
    warnings.push('No recognizable measurements found in text block');
    // Log first 20 non-empty lines that didn't match, for debugging
    const nonEmpty = lines.map(l => l.trim()).filter(l => l.length > 2);
    console.warn('[parseTextBlock] No matches. First 20 non-empty lines:', nonEmpty.slice(0, 20));
  }

  return { readings: Array.from(seen.values()), warnings };
}
