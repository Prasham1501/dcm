import type { Reading, TemplateKey } from './types';

const CATEGORY_SCORES: Record<TemplateKey, string[]> = {
  obstetric: ['BPD', 'HC', 'AC', 'FL', 'CRL', 'EFW', 'GA', 'FHR', 'AFI', 'HL'],
  abdominal: ['liver_length', 'spleen', 'rk', 'lk', 'kidney', 'pancreas', 'gb', 'aorta', 'cbd', 'portal_vein'],
  pelvic: ['uterus', 'et', 'r_ovary', 'l_ovary', 'ovary', 'prostate', 'bladder'],
  smallParts: ['rt_thyroid', 'lt_thyroid', 'thyroid_isthmus', 'thyroid'],
  cardiac: ['EF', 'LVIDd', 'LVIDs', 'IVS'],
  vascular: ['PSV', 'EDV', 'RI', 'PI'],
  generic: [],
};

export function detectTemplate(readings: Reading[]): TemplateKey {
  const keys = new Set(readings.map(r => r.key));
  const scores: Record<TemplateKey, number> = {
    obstetric: 0, abdominal: 0, pelvic: 0, smallParts: 0, cardiac: 0, vascular: 0, generic: 0,
  };

  for (const [template, templateKeys] of Object.entries(CATEGORY_SCORES) as [TemplateKey, string[]][]) {
    for (const k of templateKeys) {
      if (keys.has(k)) scores[template]++;
    }
  }

  // Also count by category field on the readings
  for (const r of readings) {
    if (r.category && r.category !== 'generic') {
      scores[r.category] = (scores[r.category] ?? 0) + 0.5;
    }
  }

  const best = (Object.entries(scores) as [TemplateKey, number][])
    .sort((a, b) => b[1] - a[1])[0];

  return best[1] > 0 ? best[0] : 'generic';
}
