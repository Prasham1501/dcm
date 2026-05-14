/**
 * FMF (Fetal Medicine Foundation) — first-trimester risk math.
 *
 * Implements the three calculators offered in the Biometry tab:
 *   - combinedAneuploidyRisk : T21 / T18 / T13
 *   - preeclampsiaRisk        : early-PE / preterm-PE / term-PE
 *   - pretermBirthRisk        : sPTB < 34 weeks based on cervical length
 *
 * References
 *   - Nicolaides KH. "Screening for fetal aneuploidies at 11–13 weeks."
 *     Prenat Diagn 2011;31:7–15.
 *   - Kagan KO et al. "Combined screening for trisomies 21, 18 and 13 at
 *     11–13 weeks." UOG 2008;31:618–24.
 *   - Wright D et al. "Two-stage screening for preterm preeclampsia."
 *     Am J Obstet Gynecol 2019;220:197.e1–197.e11.
 *   - To MS, Skentou C, Nicolaides KH. "Cervical length screening."
 *     UOG 2006;27:362–7.
 *
 * IMPORTANT
 *   These calculators are research / education helpers. They use published
 *   coefficients but are not regulated medical devices. Clinical decisions
 *   must rely on validated FMF software (e.g. Astraia) and current
 *   guidelines.
 */

// ─── A-priori risks by maternal age ──────────────────────────────────────
//
// Source: Snijders RJM, Sundberg K, Holzgreve W, Henry G, Nicolaides KH.
// "Maternal age- and gestation-specific risk for trisomy 21." UOG
// 1999;13:167–170. (Values at 12 weeks gestation, the standard FTS GA.)
//
// We linearly interpolate between table rows for non-integer ages.

const T21_AGE_TABLE: ReadonlyArray<readonly [number, number]> = [
  // [maternalAge, 1:N risk at 12w]
  [20, 1068], [21, 1068], [22, 1068], [23, 990],  [24, 942],
  [25, 887],  [26, 826],  [27, 754],  [28, 675],  [29, 591],
  [30, 507],  [31, 423],  [32, 343],  [33, 273],  [34, 213],
  [35, 164],  [36, 124],  [37, 93],   [38, 70],   [39, 52],
  [40, 38],   [41, 28],   [42, 21],   [43, 15],   [44, 11],
  [45, 8],    [46, 6],    [47, 4],    [48, 3],
];

/** Trisomy 21 a-priori risk at 12 weeks given maternal age (1:N form). */
export function aprioriT21(age: number): number {
  if (!Number.isFinite(age)) return Number.NaN;
  if (age <= T21_AGE_TABLE[0][0]) return T21_AGE_TABLE[0][1];
  const last = T21_AGE_TABLE[T21_AGE_TABLE.length - 1];
  if (age >= last[0]) return last[1];
  for (let i = 0; i < T21_AGE_TABLE.length - 1; i++) {
    const [a1, r1] = T21_AGE_TABLE[i];
    const [a2, r2] = T21_AGE_TABLE[i + 1];
    if (age >= a1 && age <= a2) {
      const t = (age - a1) / (a2 - a1);
      return Math.round(r1 + (r2 - r1) * t);
    }
  }
  return last[1];
}

/**
 * Approximate a-priori risks for T18 and T13 at 12 weeks. These are roughly
 * one-third and one-quarter of the T21 risk respectively across the age
 * range used in FTS screening (Snijders 1995).
 */
export function aprioriT18(age: number): number {
  return Math.round(aprioriT21(age) * 3);
}
export function aprioriT13(age: number): number {
  return Math.round(aprioriT21(age) * 4);
}

// ─── Marker likelihood ratios ────────────────────────────────────────────
//
// Source: Kagan KO et al. UOG 2008;31:618–24 and Nicolaides 2011 §3.
// We expose them as constants so they can be reviewed / tuned later by
// moving them into the `risk_coefficients` DB table.

interface MarkerLR { lrPlus: number; lrMinus: number; }

export const MARKER_LR = {
  nasalBoneAbsent:   { t21: { lrPlus: 23.27, lrMinus: 0.46 }, t18: { lrPlus: 14,   lrMinus: 0.5 }, t13: { lrPlus: 7,   lrMinus: 0.7 } } as Record<'t21' | 't18' | 't13', MarkerLR>,
  dvReversedAWave:   { t21: { lrPlus: 17.45, lrMinus: 0.49 }, t18: { lrPlus: 21,   lrMinus: 0.6 }, t13: { lrPlus: 16,  lrMinus: 0.7 } } as Record<'t21' | 't18' | 't13', MarkerLR>,
  tricuspidRegurg:   { t21: { lrPlus: 13.62, lrMinus: 0.51 }, t18: { lrPlus: 39.6, lrMinus: 0.7 }, t13: { lrPlus: 21,  lrMinus: 0.7 } } as Record<'t21' | 't18' | 't13', MarkerLR>,
} as const;

/**
 * Likelihood ratio for a given NT MoM (Multiple of the Median for CRL).
 *
 * Uses the simplified bivariate Gaussian approach from Kagan 2008 with
 * trisomy-specific log-NT-MoM medians.
 *
 *   mu_unaffected = 0       sigma_unaffected = 0.0884
 *   mu_T21        = 0.2117  sigma_T21        = 0.1772
 *   mu_T18        = 0.2522  sigma_T18        = 0.1925
 *   mu_T13        = 0.2522  sigma_T13        = 0.1925
 */
export function ntLR(ntMoM: number, trisomy: 't21' | 't18' | 't13'): number {
  if (!Number.isFinite(ntMoM) || ntMoM <= 0) return 1;
  const x = Math.log10(ntMoM);
  const params = {
    t21: { mu: 0.2117, sig: 0.1772 },
    t18: { mu: 0.2522, sig: 0.1925 },
    t13: { mu: 0.2522, sig: 0.1925 },
  }[trisomy];

  const pNormal     = gauss(x, 0,           0.0884);
  const pAffected   = gauss(x, params.mu,   params.sig);
  return pNormal === 0 ? Number.POSITIVE_INFINITY : pAffected / pNormal;
}

/** Standard-normal pdf. */
function gauss(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

// ─── Combined aneuploidy risk ────────────────────────────────────────────

export interface AneuploidyInputs {
  maternalAge:    number;             // years
  ntMoM?:         number;             // Multiple of Median for CRL
  nasalBone?:     'present' | 'absent' | 'unknown';
  ductusVenosus?: 'normal'  | 'reversed' | 'unknown';
  tricuspid?:     'normal'  | 'regurg'   | 'unknown';
  fhrMoM?:        number;             // optional FHR MoM (currently informational)
  /** Optional independent malformations bumping T18/T13 risk */
  majorMalformations?: boolean;
}

export interface AneuploidyResult {
  apriori:  { t21: number; t18: number; t13: number };   // 1:N
  combined: { t21: number; t18: number; t13: number };   // 1:N
  lr:       { t21: number; t18: number; t13: number };   // composite LR
  /** Plain-English category for display chips. */
  category: { t21: RiskCategory; t18: RiskCategory; t13: RiskCategory };
}

export type RiskCategory = 'low' | 'moderate' | 'high';

const HIGH_RISK_THRESHOLD = 250;       // 1:N — anything ≤ this is "high"
const MODERATE_RISK_THRESHOLD = 1000;  // ≤ this and > HIGH_RISK is "moderate"

function classify(oneInN: number): RiskCategory {
  if (oneInN <= HIGH_RISK_THRESHOLD)    return 'high';
  if (oneInN <= MODERATE_RISK_THRESHOLD) return 'moderate';
  return 'low';
}

export function combinedAneuploidyRisk(inp: AneuploidyInputs): AneuploidyResult {
  const apriori = {
    t21: aprioriT21(inp.maternalAge),
    t18: aprioriT18(inp.maternalAge),
    t13: aprioriT13(inp.maternalAge),
  };

  // Build a composite LR per trisomy by multiplying marker-specific LRs.
  const lr = { t21: 1, t18: 1, t13: 1 };

  if (inp.ntMoM !== undefined) {
    lr.t21 *= ntLR(inp.ntMoM, 't21');
    lr.t18 *= ntLR(inp.ntMoM, 't18');
    lr.t13 *= ntLR(inp.ntMoM, 't13');
  }

  if (inp.nasalBone && inp.nasalBone !== 'unknown') {
    const side = inp.nasalBone === 'absent' ? 'lrPlus' : 'lrMinus';
    lr.t21 *= MARKER_LR.nasalBoneAbsent.t21[side];
    lr.t18 *= MARKER_LR.nasalBoneAbsent.t18[side];
    lr.t13 *= MARKER_LR.nasalBoneAbsent.t13[side];
  }

  if (inp.ductusVenosus && inp.ductusVenosus !== 'unknown') {
    const side = inp.ductusVenosus === 'reversed' ? 'lrPlus' : 'lrMinus';
    lr.t21 *= MARKER_LR.dvReversedAWave.t21[side];
    lr.t18 *= MARKER_LR.dvReversedAWave.t18[side];
    lr.t13 *= MARKER_LR.dvReversedAWave.t13[side];
  }

  if (inp.tricuspid && inp.tricuspid !== 'unknown') {
    const side = inp.tricuspid === 'regurg' ? 'lrPlus' : 'lrMinus';
    lr.t21 *= MARKER_LR.tricuspidRegurg.t21[side];
    lr.t18 *= MARKER_LR.tricuspidRegurg.t18[side];
    lr.t13 *= MARKER_LR.tricuspidRegurg.t13[side];
  }

  // Major structural malformations heavily elevate T18/T13 risk.
  if (inp.majorMalformations) { lr.t18 *= 6; lr.t13 *= 8; }

  // Convert "1:N apriori × LR" to "1:N combined" via Bayes on odds form.
  //   posterior odds = prior odds × LR
  //   prior odds = 1 / (N - 1)  → posterior 1:N' = 1 + (N - 1) / LR
  const apply = (apr: number, LR: number) => {
    if (LR <= 0 || !Number.isFinite(LR)) return apr;
    const posteriorOdds = LR / (apr - 1);
    const oneInN = 1 + 1 / posteriorOdds;
    return Math.max(2, Math.round(oneInN));
  };

  const combined = {
    t21: apply(apriori.t21, lr.t21),
    t18: apply(apriori.t18, lr.t18),
    t13: apply(apriori.t13, lr.t13),
  };

  return {
    apriori,
    combined,
    lr,
    category: {
      t21: classify(combined.t21),
      t18: classify(combined.t18),
      t13: classify(combined.t13),
    },
  };
}

// ─── Preeclampsia risk ───────────────────────────────────────────────────
//
// Two-stage logistic model from Wright et al 2019, simplified for the
// markers commonly available in the first trimester:
//   - Maternal characteristics (age, BMI, race, parity, history)
//   - Mean Arterial Pressure MoM
//   - Uterine artery PI MoM
//   - PAPP-A or PlGF MoM (optional)
//
// We expose a flattened risk for "preterm preeclampsia" (delivery < 37 wks).

export interface PreeclampsiaInputs {
  maternalAge:  number;
  bmi:          number;
  race?:        'white' | 'black' | 'south_asian' | 'east_asian' | 'mixed' | 'other';
  parity?:      'nulliparous' | 'multiparous_no_pe' | 'multiparous_with_pe';
  chronicHTN?:  boolean;
  diabetes?:    boolean;
  ivfPregnancy?:boolean;

  mapMoM?:      number;
  utaPiMoM?:    number;
  pappAMoM?:    number;
  plgfMoM?:     number;
}

export interface PreeclampsiaResult {
  pretermPE: number;     // 1:N
  termPE:    number;     // 1:N
  category:  RiskCategory;
}

export function preeclampsiaRisk(inp: PreeclampsiaInputs): PreeclampsiaResult {
  // Baseline log-OR (intercept) — calibrated so that the average nulliparous
  // healthy 30-year-old returns ~1:200 risk for preterm PE.
  let logOR = -5.4;

  // Maternal characteristics (Wright et al coefficients, rounded)
  logOR += 0.06 * Math.max(0, inp.maternalAge - 35);   // age contribution
  logOR += 0.12 * Math.max(0, inp.bmi - 25);           // BMI contribution

  if (inp.race === 'black')        logOR += 0.99;
  if (inp.race === 'south_asian')  logOR += 0.48;

  if (inp.parity === 'multiparous_no_pe')   logOR -= 1.27;
  if (inp.parity === 'multiparous_with_pe') logOR += 1.74;

  if (inp.chronicHTN)   logOR += 1.78;
  if (inp.diabetes)     logOR += 0.69;
  if (inp.ivfPregnancy) logOR += 0.59;

  // Biomarkers (log-MoM)
  if (inp.mapMoM      !== undefined && inp.mapMoM      > 0) logOR +=  6.0 * Math.log10(inp.mapMoM);
  if (inp.utaPiMoM    !== undefined && inp.utaPiMoM    > 0) logOR +=  4.5 * Math.log10(inp.utaPiMoM);
  if (inp.pappAMoM    !== undefined && inp.pappAMoM    > 0) logOR += -1.9 * Math.log10(inp.pappAMoM);
  if (inp.plgfMoM     !== undefined && inp.plgfMoM     > 0) logOR += -3.2 * Math.log10(inp.plgfMoM);

  // Convert log-odds → probability → 1:N
  const p = 1 / (1 + Math.exp(-logOR));
  const oneInN = Math.max(2, Math.round(1 / p));

  return {
    pretermPE: oneInN,
    termPE:    Math.round(oneInN * 0.4),   // term PE ≈ 2.5× more common
    category:  classify(oneInN),
  };
}

// ─── Spontaneous preterm-birth risk ──────────────────────────────────────
//
// Two-variable model from To/Skentou/Nicolaides:
//   risk = baseline × OR(cervical length) × OR(prior PTB)
//
// Implemented as a piecewise OR table for CL because the published
// regression coefficient is hard to use without the centred CL median.

export interface PretermInputs {
  cervicalLengthMm: number;            // measured at 19–24 wks TVS
  priorSpontaneousPTB?: boolean;
  multipleGestation?: boolean;
  conisation?: boolean;
}

export interface PretermResult {
  sPTBunder34: number;   // 1:N
  category:    RiskCategory;
}

function cervicalLengthOR(clMm: number): number {
  if (clMm <  10) return 50;
  if (clMm <  15) return 25;
  if (clMm <  20) return 14;
  if (clMm <  25) return 6;
  if (clMm <  30) return 2.4;
  if (clMm <  35) return 1.0;          // reference
  return 0.5;
}

export function pretermBirthRisk(inp: PretermInputs): PretermResult {
  // Baseline sPTB < 34 weeks risk in low-risk singleton ≈ 1:80.
  let oddsPer1 = 1 / 80;
  oddsPer1 *= cervicalLengthOR(inp.cervicalLengthMm);
  if (inp.priorSpontaneousPTB) oddsPer1 *= 4.5;
  if (inp.multipleGestation)   oddsPer1 *= 6;
  if (inp.conisation)          oddsPer1 *= 1.6;

  const p = oddsPer1 / (1 + oddsPer1);
  const oneInN = Math.max(2, Math.round(1 / p));
  return { sPTBunder34: oneInN, category: classify(oneInN) };
}

// ─── Display helpers ─────────────────────────────────────────────────────

export function formatRisk(oneInN: number): string {
  if (!Number.isFinite(oneInN)) return '—';
  if (oneInN < 2) return '> 1:2';
  if (oneInN > 10000) return '< 1:10000';
  return `1:${oneInN.toLocaleString()}`;
}

export function categoryColor(c: RiskCategory): string {
  return c === 'high'     ? 'text-red-700 bg-red-50 border-red-300 dark:bg-red-900/30 dark:text-red-300'
       : c === 'moderate' ? 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300'
       :                    'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300';
}
export function categoryLabel(c: RiskCategory): string {
  return c === 'high' ? 'High Risk' : c === 'moderate' ? 'Moderate Risk' : 'Low Risk';
}
