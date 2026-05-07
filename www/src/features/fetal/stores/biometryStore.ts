import { create } from 'zustand';
import { biometryApi } from '@/features/fetal/api/biometryApi';
import type { BiometryField, GrowthChartAuthor, GrowthChartPoint } from '@/features/fetal/types';
import type { Reading } from '@/lib/usgExtraction/types';

// FTS field definitions (ordered as they appear in the form)
export const FTS_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'CRL',  label: 'Crown-Rump Length',         unit: 'mm' },
  { key: 'NT',   label: 'Nuchal Translucency',        unit: 'mm' },
  { key: 'NB',   label: 'Nasal Bone',                 unit: 'mm' },
  { key: 'IT',   label: 'Intracranial Translucency',  unit: 'mm' },
  { key: 'BPD',  label: 'Biparietal Diameter',        unit: 'mm' },
  { key: 'HC',   label: 'Head Circumference',         unit: 'mm' },
  { key: 'AC',   label: 'Abdominal Circumference',    unit: 'mm' },
  { key: 'FL',   label: 'Femur Length',               unit: 'mm' },
];

export const SECOND_TRIMESTER_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'BPD',  label: 'Biparietal Diameter',        unit: 'mm' },
  { key: 'HC',   label: 'Head Circumference',         unit: 'mm' },
  { key: 'AC',   label: 'Abdominal Circumference',    unit: 'mm' },
  { key: 'FL',   label: 'Femur Length',               unit: 'mm' },
  { key: 'HL',   label: 'Humerus Length',             unit: 'mm' },
  { key: 'EFW',  label: 'Est. Fetal Weight',          unit: 'g'  },
];

interface BiometryState {
  examinationId: number | null;
  fields: Record<string, BiometryField>;
  authors: GrowthChartAuthor[];
  chartCache: Record<string, GrowthChartPoint[]>;   // key: `${parameter}_${authorId}`
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadForExamination: (id: number) => Promise<void>;
  loadAuthors: () => Promise<void>;
  loadChartData: (parameter: string, authorId: number) => Promise<GrowthChartPoint[]>;
  setFieldValue: (key: string, value: number | null) => void;
  setFieldAuthor: (key: string, authorCode: string) => void;
  setFieldMeta: (key: string, meta: Partial<BiometryField>) => void;
  save: () => Promise<void>;
  clear: () => void;
  /** Auto-fill fields from extracted DICOM/OCR readings. Returns array of {fieldKey, value, source} for all matched. */
  applyReadings: (readings: Reading[]) => { fieldKey: string; value: number; label: string; unit: string; source: string }[];
  /** Recalculate percentile/z-score for all filled fields */
  recalcAllPercentiles: (gaWeeks: number | null) => Promise<number>;
}

const emptyField = (unit: string): BiometryField => ({
  value: null, unit, referenceAuthor: null,
  percentile: null, zScore: null, isAbnormal: false,
});

export const useBiometryStore = create<BiometryState>((set, get) => ({
  examinationId: null,
  fields: {},
  authors: [],
  chartCache: {},
  loading: false,
  saving: false,
  error: null,

  async loadForExamination(id) {
    set({ loading: true, error: null, examinationId: id });
    try {
      const data = await biometryApi.load(id);
      // Merge with empty defaults so all fields appear
      const merged: Record<string, BiometryField> = {};
      [...FTS_FIELDS, ...SECOND_TRIMESTER_FIELDS].forEach(({ key, unit }) => {
        merged[key] = data[key] ?? emptyField(unit);
      });
      set({ fields: merged, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async loadAuthors() {
    if (get().authors.length > 0) return;
    try {
      const authors = await biometryApi.listAuthors();
      set({ authors });
    } catch { /* non-fatal */ }
  },

  async loadChartData(parameter, authorId) {
    const cacheKey = `${parameter}_${authorId}`;
    const cached = get().chartCache[cacheKey];
    if (cached) return cached;
    try {
      const data = await biometryApi.getChartData(parameter, authorId);
      set((s) => ({ chartCache: { ...s.chartCache, [cacheKey]: data } }));
      return data;
    } catch {
      return [];
    }
  },

  setFieldValue(key, value) {
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: { ...(s.fields[key] ?? emptyField('mm')), value },
      },
    }));
  },

  setFieldAuthor(key, authorCode) {
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: { ...(s.fields[key] ?? emptyField('mm')), referenceAuthor: authorCode },
      },
    }));
  },

  setFieldMeta(key, meta) {
    set((s) => ({
      fields: {
        ...s.fields,
        [key]: { ...(s.fields[key] ?? emptyField('mm')), ...meta },
      },
    }));
  },

  async save() {
    const { examinationId, fields } = get();
    if (!examinationId) return;
    set({ saving: true });
    try {
      const payload = Object.entries(fields)
        .filter(([, f]) => f.value !== null)
        .map(([field_key, f]) => ({ field_key, ...f }));
      await biometryApi.save(examinationId, payload as any);
    } finally {
      set({ saving: false });
    }
  },

  clear() {
    set({ examinationId: null, fields: {}, chartCache: {}, loading: false, error: null });
  },

  applyReadings(readings) {
    // Build a comprehensive map: normalize extraction keys → biometry field keys
    const ALL_FIELD_KEYS = new Set([
      ...FTS_FIELDS.map(f => f.key),
      ...SECOND_TRIMESTER_FIELDS.map(f => f.key),
    ]);

    // Normalize reading key → biometry field key
    const normalizeKey = (raw: string): string | null => {
      // Strip trailing _2, _3 suffixes and vessel prefixes like "Dorsalis Pedis A._PSV"
      let k = raw.replace(/_\d+$/, '');
      // If it contains a dot-prefixed part (vessel.PARAM), extract PARAM
      if (k.includes('.')) {
        const parts = k.split('.');
        k = parts[parts.length - 1].replace(/^_/, '');
      }
      k = k.toUpperCase().trim();
      // Direct match
      if (ALL_FIELD_KEYS.has(k)) return k;
      // Common OCR variants
      const ALIASES: Record<string, string> = {
        'BIPARIETAL': 'BPD', 'BIPARIETAL DIAMETER': 'BPD',
        'HEAD CIRCUMFERENCE': 'HC', 'HEAD CIRC': 'HC',
        'ABDOMINAL CIRCUMFERENCE': 'AC', 'ABD CIRC': 'AC', 'ABDOMINAL CIRC': 'AC',
        'FEMUR LENGTH': 'FL', 'FEMUR LEN': 'FL', 'FEMUR': 'FL',
        'CROWN RUMP LENGTH': 'CRL', 'CROWN-RUMP': 'CRL', 'CROWN-RUMP LENGTH': 'CRL',
        'HUMERUS LENGTH': 'HL', 'HUMERUS LEN': 'HL', 'HUMERUS': 'HL',
        'ESTIMATED FETAL WEIGHT': 'EFW', 'EST FETAL WEIGHT': 'EFW', 'EST. FETAL WT': 'EFW', 'FETAL WEIGHT': 'EFW',
        'NUCHAL TRANSLUCENCY': 'NT', 'NUCHAL': 'NT',
        'NASAL BONE': 'NB',
        'INTRACRANIAL TRANSLUCENCY': 'IT',
      };
      if (ALIASES[k]) return ALIASES[k];
      // Try matching against label text from reading
      return null;
    };

    // Unit conversion: extraction may use cm, biometry expects mm (or g for EFW)
    const convertValue = (fieldKey: string, value: number, unit: string): number => {
      const targetField = [...FTS_FIELDS, ...SECOND_TRIMESTER_FIELDS].find(f => f.key === fieldKey);
      const targetUnit = targetField?.unit ?? 'mm';
      const srcUnit = unit.toLowerCase().trim();
      if (targetUnit === 'mm' && srcUnit === 'cm') return +(value * 10).toFixed(1);
      if (targetUnit === 'cm' && srcUnit === 'mm') return +(value / 10).toFixed(1);
      if (targetUnit === 'g' && srcUnit === 'kg') return +(value * 1000).toFixed(0);
      if (targetUnit === 'g' && srcUnit === 'gm') return value;
      // If source is cm and target is mm but value looks like mm already (>10 for lengths like BPD, HC, AC, FL)
      if (targetUnit === 'mm' && !srcUnit && value > 0 && value < 10 && ['BPD','HC','AC','FL','CRL','HL','NT','NB','IT'].includes(fieldKey)) {
        // Likely in cm, convert
        return +(value * 10).toFixed(1);
      }
      return value;
    };

    const fields = { ...get().fields };
    const applied: { fieldKey: string; value: number; label: string; unit: string; source: string }[] = [];
    const seenKeys = new Set<string>();   // deduplicate: first reading per field wins

    for (const reading of readings) {
      // Try key first, then label
      let fieldKey = normalizeKey(reading.key);
      if (!fieldKey && reading.label) {
        fieldKey = normalizeKey(reading.label);
      }
      if (!fieldKey || !fields[fieldKey]) continue;
      if (seenKeys.has(fieldKey)) continue;  // skip duplicate readings for same field

      let numericValue: number | null = null;
      if (typeof reading.value === 'number') {
        numericValue = reading.value;
      } else if (typeof reading.value === 'string') {
        // Parse first number from strings like "5.2 × 3.1" or "310.4 mm"
        const match = reading.value.match(/[\d.]+/);
        if (match) numericValue = parseFloat(match[0]);
      }

      if (numericValue === null || isNaN(numericValue) || numericValue <= 0) continue;

      const converted = convertValue(fieldKey, numericValue, reading.unit ?? '');
      const fieldDef = [...FTS_FIELDS, ...SECOND_TRIMESTER_FIELDS].find(f => f.key === fieldKey);

      // Always overwrite — user clicked Insert explicitly
      fields[fieldKey] = { ...fields[fieldKey], value: converted };
      seenKeys.add(fieldKey);
      applied.push({
        fieldKey,
        value: converted,
        label: fieldDef?.label ?? fieldKey,
        unit: fieldDef?.unit ?? reading.unit ?? '',
        source: reading.key,
      });
    }

    if (applied.length > 0) {
      set({ fields });
    }
    return applied;
  },

  async recalcAllPercentiles(gaWeeks) {
    if (gaWeeks === null) return 0;
    const { fields, authors, loadChartData, setFieldMeta } = get();
    if (authors.length === 0) return 0;

    let recalced = 0;
    for (const [key, field] of Object.entries(fields)) {
      if (field.value === null || field.value === undefined) continue;

      const authorCode = field.referenceAuthor ?? authors[0]?.code;
      const author = authors.find(a => a.code === authorCode);
      if (!author) continue;

      try {
        const pts = await loadChartData(key, author.id);
        if (!pts.length) continue;
        const closest = pts.reduce((best, p) =>
          Math.abs(p.ga_weeks - gaWeeks) < Math.abs(best.ga_weeks - gaWeeks) ? p : best
        );
        if (!closest.mean || !closest.sd) continue;

        const z = (field.value - closest.mean) / closest.sd;
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
        const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
        const pct = +(z >= 0 ? phi * 100 : (1 - phi) * 100).toFixed(1);
        const isAbnormal = pct < 5 || pct > 95;

        setFieldMeta(key, { percentile: pct, zScore: +z.toFixed(2), isAbnormal });
        recalced++;
      } catch { /* non-fatal */ }
    }
    return recalced;
  },
}));
