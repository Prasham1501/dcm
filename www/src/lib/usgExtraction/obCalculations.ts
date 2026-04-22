/**
 * Obstetric calculations — Hadlock reference tables.
 *
 * All formulas from:
 *   Hadlock FP et al. "Estimation of fetal weight with the use of head, body,
 *   and femur measurements" Radiology 1985;150:535-540.
 *   Hadlock FP et al. "Fetal biometry: normal values" Radiology 1984;152:497-501.
 *
 * GA-from-biometry regression equations from Hadlock 1984.
 * Percentile tables derived from Hadlock 1991 (mean ± SD at each GA week).
 */

// ── Hadlock GA estimation from individual measurements ──────────────────

/** BPD (cm) → GA in weeks. Hadlock 1984: GA = 9.54 + 1.482×BPD + 0.1676×BPD². */
export function gaFromBPD(bpdCm: number): number {
  return 9.54 + 1.482 * bpdCm + 0.1676 * bpdCm * bpdCm;
}

/** HC (cm) → GA in weeks. Hadlock 1984: GA = 8.96 + 0.540×HC + 0.0003×HC³. */
export function gaFromHC(hcCm: number): number {
  return 8.96 + 0.540 * hcCm + 0.0003 * hcCm * hcCm * hcCm;
}

/** AC (cm) → GA in weeks. Hadlock 1984: GA = 8.14 + 0.753×AC + 0.0036×AC². */
export function gaFromAC(acCm: number): number {
  return 8.14 + 0.753 * acCm + 0.0036 * acCm * acCm;
}

/** FL (cm) → GA in weeks. Hadlock 1984: GA = 10.35 + 2.460×FL + 0.170×FL². */
export function gaFromFL(flCm: number): number {
  return 10.35 + 2.460 * flCm + 0.170 * flCm * flCm;
}

/** CRL (cm) → GA in weeks. Robinson & Fleming 1975: GA = 8.052×√CRL + 23.73. (days → weeks) */
export function gaFromCRL(crlCm: number): number {
  const days = 8.052 * Math.sqrt(crlCm * 10) + 23.73; // CRL in mm
  return days / 7;
}

// ── Hadlock EFW calculation ────────────────────────────────────────────

/**
 * Hadlock C formula (BPD, HC, AC, FL → EFW in grams).
 * log₁₀(EFW) = 1.3596 + 0.0064×HC + 0.0424×AC + 0.174×FL
 *              + 0.00061×BPD×AC − 0.00386×AC×FL
 * All inputs in cm.
 */
export function hadlockEFW_C(bpdCm: number, hcCm: number, acCm: number, flCm: number): number {
  const log10EFW = 1.3596
    + 0.0064 * hcCm
    + 0.0424 * acCm
    + 0.174 * flCm
    + 0.00061 * bpdCm * acCm
    - 0.00386 * acCm * flCm;
  return Math.pow(10, log10EFW);
}

/**
 * Hadlock B formula (AC, FL → EFW in grams) — fallback when BPD/HC not available.
 * log₁₀(EFW) = 1.304 + 0.05281×AC + 0.1938×FL − 0.004×AC×FL
 */
export function hadlockEFW_B(acCm: number, flCm: number): number {
  const log10EFW = 1.304 + 0.05281 * acCm + 0.1938 * flCm - 0.004 * acCm * flCm;
  return Math.pow(10, log10EFW);
}

/**
 * Hadlock A formula (HC, AC, FL → EFW in grams) — when BPD not available.
 * log₁₀(EFW) = 1.326 + 0.0107×HC + 0.0438×AC + 0.158×FL − 0.00326×AC×FL
 */
export function hadlockEFW_A(hcCm: number, acCm: number, flCm: number): number {
  const log10EFW = 1.326 + 0.0107 * hcCm + 0.0438 * acCm + 0.158 * flCm - 0.00326 * acCm * flCm;
  return Math.pow(10, log10EFW);
}

// ── Percentile reference tables (Hadlock 1991) ─────────────────────────
// Each entry: [GA_weeks, mean_cm, SD_cm]
// BPD, HC, AC, FL tables cover 14–40 weeks.

export const BPD_TABLE: [number, number, number][] = [
  [14, 2.8, 0.2], [15, 3.2, 0.2], [16, 3.5, 0.2], [17, 3.8, 0.2], [18, 4.2, 0.2],
  [19, 4.5, 0.2], [20, 4.8, 0.3], [21, 5.1, 0.3], [22, 5.4, 0.3], [23, 5.7, 0.3],
  [24, 6.0, 0.3], [25, 6.3, 0.3], [26, 6.5, 0.3], [27, 6.8, 0.3], [28, 7.0, 0.3],
  [29, 7.3, 0.3], [30, 7.5, 0.4], [31, 7.7, 0.4], [32, 7.9, 0.4], [33, 8.1, 0.4],
  [34, 8.3, 0.4], [35, 8.5, 0.4], [36, 8.7, 0.4], [37, 8.8, 0.4], [38, 9.0, 0.4],
  [39, 9.1, 0.4], [40, 9.3, 0.4],
];

export const HC_TABLE: [number, number, number][] = [
  [14, 10.1, 0.7], [15, 11.5, 0.7], [16, 12.8, 0.8], [17, 14.2, 0.8], [18, 15.5, 0.9],
  [19, 16.8, 0.9], [20, 18.0, 1.0], [21, 19.3, 1.0], [22, 20.5, 1.1], [23, 21.7, 1.1],
  [24, 22.8, 1.2], [25, 23.9, 1.2], [26, 25.0, 1.2], [27, 26.0, 1.3], [28, 27.0, 1.3],
  [29, 27.9, 1.3], [30, 28.8, 1.4], [31, 29.7, 1.4], [32, 30.5, 1.4], [33, 31.2, 1.4],
  [34, 31.9, 1.5], [35, 32.5, 1.5], [36, 33.1, 1.5], [37, 33.6, 1.5], [38, 34.0, 1.5],
  [39, 34.4, 1.5], [40, 34.8, 1.5],
];

export const AC_TABLE: [number, number, number][] = [
  [14, 8.7, 0.7], [15, 9.9, 0.7], [16, 11.1, 0.8], [17, 12.4, 0.9], [18, 13.6, 0.9],
  [19, 14.8, 1.0], [20, 16.0, 1.1], [21, 17.2, 1.1], [22, 18.4, 1.2], [23, 19.5, 1.3],
  [24, 20.7, 1.3], [25, 21.8, 1.4], [26, 22.9, 1.5], [27, 24.0, 1.5], [28, 25.1, 1.6],
  [29, 26.1, 1.7], [30, 27.1, 1.7], [31, 28.1, 1.8], [32, 29.0, 1.9], [33, 29.9, 1.9],
  [34, 30.8, 2.0], [35, 31.6, 2.1], [36, 32.4, 2.1], [37, 33.1, 2.2], [38, 33.8, 2.2],
  [39, 34.4, 2.3], [40, 35.0, 2.3],
];

export const FL_TABLE: [number, number, number][] = [
  [14, 1.5, 0.1], [15, 1.8, 0.2], [16, 2.1, 0.2], [17, 2.5, 0.2], [18, 2.8, 0.2],
  [19, 3.1, 0.2], [20, 3.4, 0.2], [21, 3.7, 0.3], [22, 3.9, 0.3], [23, 4.2, 0.3],
  [24, 4.5, 0.3], [25, 4.7, 0.3], [26, 5.0, 0.3], [27, 5.2, 0.3], [28, 5.4, 0.3],
  [29, 5.6, 0.3], [30, 5.8, 0.4], [31, 6.0, 0.4], [32, 6.2, 0.4], [33, 6.4, 0.4],
  [34, 6.6, 0.4], [35, 6.7, 0.4], [36, 6.9, 0.4], [37, 7.0, 0.4], [38, 7.1, 0.4],
  [39, 7.3, 0.4], [40, 7.4, 0.4],
];

/** EFW percentile table (Hadlock 1991) — [GA_weeks, mean_g, SD_g] */
export const EFW_TABLE: [number, number, number][] = [
  [14, 93, 13], [15, 117, 16], [16, 146, 20], [17, 181, 25], [18, 223, 31],
  [19, 273, 38], [20, 331, 46], [21, 399, 56], [22, 478, 67], [23, 568, 79],
  [24, 670, 94], [25, 785, 110], [26, 913, 128], [27, 1055, 148], [28, 1210, 169],
  [29, 1379, 193], [30, 1559, 218], [31, 1751, 245], [32, 1953, 273], [33, 2162, 303],
  [34, 2377, 333], [35, 2595, 363], [36, 2813, 394], [37, 3028, 424], [38, 3236, 453],
  [39, 3435, 481], [40, 3619, 507],
];

/** AFI normal range by GA (cm) — [GA_weeks, p5, p50, p95] */
const AFI_TABLE: [number, number, number, number][] = [
  [16, 7.9, 12.1, 18.5], [17, 8.3, 12.7, 19.4], [18, 8.7, 13.3, 20.3],
  [19, 9.0, 13.7, 20.7], [20, 9.3, 14.1, 21.2], [21, 9.5, 14.3, 21.4],
  [22, 9.7, 14.5, 21.6], [23, 9.8, 14.6, 21.6], [24, 9.8, 14.7, 21.5],
  [25, 9.7, 14.7, 21.4], [26, 9.7, 14.7, 21.2], [27, 9.5, 14.6, 21.0],
  [28, 9.4, 14.6, 20.6], [29, 9.2, 14.2, 20.2], [30, 9.0, 13.8, 19.7],
  [31, 8.7, 13.4, 19.2], [32, 8.3, 13.0, 18.6], [33, 7.9, 12.5, 17.9],
  [34, 7.5, 12.0, 17.2], [35, 7.0, 11.4, 16.4], [36, 6.6, 10.8, 15.6],
  [37, 6.1, 10.2, 14.7], [38, 5.6, 9.5, 13.7], [39, 5.1, 8.8, 12.7],
  [40, 4.6, 7.9, 11.6],
];

// ── Percentile calculation helpers ─────────────────────────────────────

/**
 * Standard normal CDF approximation (Abramowitz & Stegun).
 * Returns P(Z ≤ z) for the standard normal distribution.
 */
function normalCDF(z: number): number {
  if (z < -6) return 0;
  if (z > 6) return 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** Look up percentile from a reference table. Returns 0-100 or null if GA out of range. */
function lookupPercentile(
  table: [number, number, number][],
  gaWeeks: number,
  measuredValue: number,
): number | null {
  const gaRounded = Math.round(gaWeeks);
  const entry = table.find(([w]) => w === gaRounded);
  if (!entry) return null;
  const [, mean, sd] = entry;
  const z = (measuredValue - mean) / sd;
  return Math.round(normalCDF(z) * 100);
}

/** Percentile for BPD (cm) at given GA (weeks). */
export function bpdPercentile(bpdCm: number, gaWeeks: number): number | null {
  return lookupPercentile(BPD_TABLE, gaWeeks, bpdCm);
}

/** Percentile for HC (cm) at given GA (weeks). */
export function hcPercentile(hcCm: number, gaWeeks: number): number | null {
  return lookupPercentile(HC_TABLE, gaWeeks, hcCm);
}

/** Percentile for AC (cm) at given GA (weeks). */
export function acPercentile(acCm: number, gaWeeks: number): number | null {
  return lookupPercentile(AC_TABLE, gaWeeks, acCm);
}

/** Percentile for FL (cm) at given GA (weeks). */
export function flPercentile(flCm: number, gaWeeks: number): number | null {
  return lookupPercentile(FL_TABLE, gaWeeks, flCm);
}

/** Percentile for EFW (grams) at given GA (weeks). */
export function efwPercentile(efwG: number, gaWeeks: number): number | null {
  return lookupPercentile(EFW_TABLE, gaWeeks, efwG);
}

/** AFI assessment at given GA. Returns { percentile, interpretation }. */
export function afiAssessment(afiCm: number, gaWeeks: number): { percentile: string; interpretation: string } | null {
  const gaRounded = Math.round(gaWeeks);
  const entry = AFI_TABLE.find(([w]) => w === gaRounded);
  if (!entry) {
    // Fall back to simple thresholds (ACOG guidelines)
    if (afiCm < 5) return { percentile: '<5th', interpretation: 'Oligohydramnios' };
    if (afiCm > 24) return { percentile: '>95th', interpretation: 'Polyhydramnios' };
    return { percentile: 'Normal', interpretation: 'Normal' };
  }
  const [, p5, p50, p95] = entry;
  if (afiCm < p5) return { percentile: '<5th', interpretation: 'Oligohydramnios' };
  if (afiCm > p95) return { percentile: '>95th', interpretation: 'Polyhydramnios' };
  if (afiCm < p50) return { percentile: '5th-50th', interpretation: 'Normal' };
  return { percentile: '50th-95th', interpretation: 'Normal' };
}

// ── Color flag for percentile ──────────────────────────────────────────

/** Format a number with correct ordinal suffix: 1st, 2nd, 3rd, 11th, 21st, etc. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export type PercentileFlag = 'critical-low' | 'low' | 'normal' | 'high' | 'critical-high';

export function percentileFlag(percentile: number | null): PercentileFlag {
  if (percentile === null) return 'normal';
  if (percentile < 3) return 'critical-low';
  if (percentile < 10) return 'low';
  if (percentile > 97) return 'critical-high';
  if (percentile > 90) return 'high';
  return 'normal';
}

export const FLAG_COLORS: Record<PercentileFlag, { bg: string; text: string; label: string }> = {
  'critical-low':  { bg: 'bg-red-500/20',    text: 'text-red-600',    label: '↓↓' },
  'low':           { bg: 'bg-amber-500/20',   text: 'text-amber-600',  label: '↓' },
  'normal':        { bg: 'bg-green-500/10',   text: 'text-green-600',  label: '✓' },
  'high':          { bg: 'bg-amber-500/20',   text: 'text-amber-600',  label: '↑' },
  'critical-high': { bg: 'bg-red-500/20',     text: 'text-red-600',    label: '↑↑' },
};

// ── Parse GA string to weeks (float) ───────────────────────────────────

/** Parse "35w 4d" or "35w4d" or "36wad" → fractional weeks. Returns null if unparseable. */
export function parseGAtoWeeks(gaStr: string): number | null {
  if (typeof gaStr !== 'string') return null;
  const m = gaStr.match(/(\d+)\s*w\s*(\d+)?\s*d?/i);
  if (!m) return null;
  const weeks = parseInt(m[1]);
  const days = m[2] ? parseInt(m[2]) : 0;
  return weeks + days / 7;
}

/** Format fractional weeks to "Xw Yd" string. */
export function formatGA(weeks: number): string {
  const w = Math.floor(weeks);
  const d = Math.round((weeks - w) * 7);
  return `${w}w ${d}d`;
}

// ── Computed OB data from readings ─────────────────────────────────────

export interface OBComputedReading {
  key: string;
  label: string;
  value: number | string;
  unit: string;
  /** GA estimated from this measurement alone (Hadlock regression) */
  estimatedGA?: string;
  /** Percentile at given GA */
  percentile?: number | null;
  /** Percentile flag for UI color */
  flag?: PercentileFlag;
  /** Original Reading category */
  category: string;
}

export interface OBComputedResult {
  readings: OBComputedReading[];
  /** Average GA from all biometry measurements */
  compositeGA?: string;
  /** EFW computed from Hadlock formula (if enough measurements) */
  computedEFW?: { value: number; unit: string; percentile?: number | null; flag?: PercentileFlag };
  /** AFI assessment if available */
  afiResult?: { value: number; unit: string; percentile: string; interpretation: string };
  /** The GA used for percentile calculations (from machine GA or composite) */
  referenceGA?: number;
}

/** Compute GA from a single reading's own value. Returns null if key isn't a biometry type. */
function computeGAForKey(baseKey: string, value: number): number | null {
  switch (baseKey) {
    case 'CRL': return (value > 0 && value < 10) ? gaFromCRL(value) : null;
    case 'BPD': return value > 2 ? gaFromBPD(value) : null;
    case 'HC':  return value > 8 ? gaFromHC(value) : null;
    case 'AC':  return value > 8 ? gaFromAC(value) : null;
    case 'FL':  return value > 1 ? gaFromFL(value) : null;
    default:    return null;
  }
}

/**
 * Compute OB-specific derived data from raw readings.
 * @param readings - All extracted readings
 * @param machineGA - GA reported by the machine (if found in readings), e.g. "35w 4d"
 */
export function computeOBData(readings: import('./types').Reading[], machineGA?: string): OBComputedResult {
  // Extract numeric values
  const getNumeric = (key: string): number | null => {
    // Handle numbered duplicates: FL, FL_2, FL_3, etc.
    const r = readings.find(r => r.key === key || r.key.startsWith(key + '_'));
    if (!r) return null;
    if (typeof r.value === 'number') return r.value;
    const n = parseFloat(String(r.value));
    return isNaN(n) ? null : n;
  };

  const bpd = getNumeric('BPD');
  const hc  = getNumeric('HC');
  const ac  = getNumeric('AC');
  const fl  = getNumeric('FL');
  const crl = getNumeric('CRL');
  const afi = getNumeric('AFI');

  // Determine reference GA: prefer machine-reported GA, then compute from biometry
  let refGA: number | null = null;
  if (machineGA) {
    refGA = parseGAtoWeeks(machineGA);
  }

  // Compute GA from each measurement
  const gaEstimates: { key: string; ga: number }[] = [];
  if (crl !== null && crl > 0 && crl < 10) { // CRL valid range: 0.5–8.4cm (6-14 wks)
    gaEstimates.push({ key: 'CRL', ga: gaFromCRL(crl) });
  }
  if (bpd !== null && bpd > 2) gaEstimates.push({ key: 'BPD', ga: gaFromBPD(bpd) });
  if (hc !== null && hc > 8)   gaEstimates.push({ key: 'HC',  ga: gaFromHC(hc) });
  if (ac !== null && ac > 8)   gaEstimates.push({ key: 'AC',  ga: gaFromAC(ac) });
  if (fl !== null && fl > 1)   gaEstimates.push({ key: 'FL',  ga: gaFromFL(fl) });

  // Composite GA = average of all estimates
  let compositeGA: string | undefined;
  if (gaEstimates.length > 0) {
    const avg = gaEstimates.reduce((s, e) => s + e.ga, 0) / gaEstimates.length;
    compositeGA = formatGA(avg);
    if (!refGA) refGA = avg;
  }

  // Build enriched readings
  const computed: OBComputedReading[] = readings.map(r => {
    const cr: OBComputedReading = {
      key: r.key,
      label: r.label,
      value: r.value,
      unit: r.unit,
      category: r.category,
    };

    const numVal = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
    if (isNaN(numVal)) return cr;

    // Add GA estimate from this measurement's own value
    const baseKey = r.key.replace(/_\d+$/, ''); // FL_2 → FL
    const gaForReading = computeGAForKey(baseKey, numVal);
    if (gaForReading !== null) {
      cr.estimatedGA = formatGA(gaForReading);
    }

    // Add percentile if we have a reference GA
    if (refGA !== null) {
      switch (baseKey) {
        case 'BPD': cr.percentile = bpdPercentile(numVal, refGA); break;
        case 'HC':  cr.percentile = hcPercentile(numVal, refGA);  break;
        case 'AC':  cr.percentile = acPercentile(numVal, refGA);  break;
        case 'FL':  cr.percentile = flPercentile(numVal, refGA);  break;
      }
      if (cr.percentile !== null && cr.percentile !== undefined) {
        cr.flag = percentileFlag(cr.percentile);
      }
    }

    return cr;
  });

  // Compute EFW if enough biometry available
  let computedEFW: OBComputedResult['computedEFW'];
  if (ac !== null && fl !== null) {
    let efw: number;
    if (bpd !== null && hc !== null) {
      efw = hadlockEFW_C(bpd, hc, ac, fl);
    } else if (hc !== null) {
      efw = hadlockEFW_A(hc, ac, fl);
    } else {
      efw = hadlockEFW_B(ac, fl);
    }
    efw = Math.round(efw);
    const pct = refGA ? efwPercentile(efw, refGA) : null;
    computedEFW = {
      value: efw,
      unit: 'g',
      percentile: pct,
      flag: percentileFlag(pct),
    };
  }

  // AFI assessment
  let afiResult: OBComputedResult['afiResult'];
  if (afi !== null && refGA) {
    const assessment = afiAssessment(afi, refGA);
    if (assessment) {
      afiResult = { value: afi, unit: 'cm', ...assessment };
    }
  }

  return {
    readings: computed,
    compositeGA,
    computedEFW,
    afiResult,
    referenceGA: refGA ?? undefined,
  };
}
