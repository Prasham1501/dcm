/**
 * Placeholder registry for fetal report templates.
 *
 * Each entry is a `{{token}}` that the user can drop anywhere in a
 * template body, plus a function that resolves the token at render time
 * from the current examination state (biometry, dating, risk, etc.).
 *
 * To add a new placeholder:
 *   1. Append to PLACEHOLDERS below with a stable key, a UI label, and a resolver.
 *   2. Optionally add a group so it shows up under a logical heading
 *      in the Insert dropdown.
 */

import type { Examination } from '@/features/fetal/types';
import type { BiometryField } from '@/features/fetal/types';
import type { DstBundle } from '@/features/fetal/api/dstApi';
import type { RiskResultRow } from '@/features/fetal/api/riskApi';
import { formatRisk } from '@/features/fetal/lib/fmfRisk';

export interface PlaceholderContext {
  examination:        Examination;
  dating:             { gaDisplay: string; gaWeeks: number | null; edd: string | null };
  biometry:           Record<string, BiometryField>;
  dst:                DstBundle;
  risk:               Record<'aneuploidy' | 'preeclampsia' | 'preterm', RiskResultRow | null>;
  patient:            { id: string; name?: string; age?: string; sex?: string; referringDoctor?: string };
}

export interface PlaceholderDef {
  token: string;                                    // 'patient_name' → matches `{{patient_name}}`
  label: string;                                    // human-readable for the dropdown
  group: 'Patient' | 'Dating' | 'Biometry' | 'Risk' | 'Findings';
  example?: string;                                 // shown next to the label
  resolve: (ctx: PlaceholderContext) => string;     // returns empty string when no data
}

/** Format a biometry value as "12.4 mm (45th)" or "—". */
function fmtBiometry(f: BiometryField | undefined): string {
  if (!f || f.value == null) return '—';
  const v = `${f.value} ${f.unit}`;
  return f.percentile != null ? `${v} (${f.percentile.toFixed(0)}ᵗʰ)` : v;
}

function biometryToken(key: string, label: string, example?: string): PlaceholderDef {
  return {
    token: key.toLowerCase(),
    label, group: 'Biometry', example,
    resolve: (ctx) => fmtBiometry(ctx.biometry[key]),
  };
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  // ── Patient ──
  { token: 'patient_name',     label: 'Patient name',       group: 'Patient',
    resolve: (c) => c.patient.name || '—' },
  { token: 'patient_id',       label: 'Patient ID',         group: 'Patient',
    resolve: (c) => c.patient.id || '—' },
  { token: 'patient_age',      label: 'Patient age',        group: 'Patient',
    resolve: (c) => c.patient.age || '—' },
  { token: 'referring_doctor', label: 'Referring doctor',   group: 'Patient',
    resolve: (c) => c.patient.referringDoctor || '—' },

  // ── Dating ──
  { token: 'lmp',              label: 'LMP',                group: 'Dating',
    resolve: (c) => c.examination.lmp_date || '—' },
  { token: 'exam_date',        label: 'Exam date',          group: 'Dating',
    resolve: (c) => c.examination.exam_date || '—' },
  { token: 'ga',               label: 'Gestational age',    group: 'Dating', example: '14w 3d',
    resolve: (c) => c.dating.gaDisplay || '—' },
  { token: 'ga_weeks',         label: 'GA (decimal weeks)', group: 'Dating', example: '14.4',
    resolve: (c) => c.dating.gaWeeks != null ? c.dating.gaWeeks.toFixed(1) : '—' },
  { token: 'edd',              label: 'Estimated due date', group: 'Dating',
    resolve: (c) => c.dating.edd || '—' },
  { token: 'exam_type',        label: 'Examination type',   group: 'Dating',
    resolve: (c) => c.examination.exam_type },

  // ── Biometry (first-trimester) ──
  biometryToken('CRL',     'Crown–rump length'),
  biometryToken('NT',      'Nuchal translucency'),
  biometryToken('IT',      'Intracranial translucency'),
  biometryToken('NB',      'Nasal bone length'),
  biometryToken('BPD_CRL', 'BPD (from CRL)'),
  biometryToken('HC_CRL',  'HC (from CRL)'),
  biometryToken('AC_CRL',  'AC (from CRL)'),
  biometryToken('FL_CRL',  'FL (from CRL)'),

  // ── Biometry (second / third trimester) ──
  biometryToken('BPD',     'Biparietal diameter'),
  biometryToken('HC',      'Head circumference'),
  biometryToken('AC',      'Abdominal circumference'),
  biometryToken('FL',      'Femur length'),
  biometryToken('HL',      'Humerus length'),
  biometryToken('EFW',     'Estimated fetal weight'),
  biometryToken('AFI',     'Amniotic fluid index'),
  biometryToken('FHR',     'Fetal heart rate'),

  // ── Risk ──
  { token: 'aneuploidy_t21', label: 'T21 risk',     group: 'Risk', example: '1:280',
    resolve: (c) => {
      const r = c.risk.aneuploidy?.results as { combined?: { t21: number } } | null;
      return r?.combined?.t21 != null ? formatRisk(r.combined.t21) : '—';
    }},
  { token: 'aneuploidy_t18', label: 'T18 risk',     group: 'Risk',
    resolve: (c) => {
      const r = c.risk.aneuploidy?.results as { combined?: { t18: number } } | null;
      return r?.combined?.t18 != null ? formatRisk(r.combined.t18) : '—';
    }},
  { token: 'aneuploidy_t13', label: 'T13 risk',     group: 'Risk',
    resolve: (c) => {
      const r = c.risk.aneuploidy?.results as { combined?: { t13: number } } | null;
      return r?.combined?.t13 != null ? formatRisk(r.combined.t13) : '—';
    }},
  { token: 'pe_preterm_risk', label: 'Preterm PE risk', group: 'Risk',
    resolve: (c) => {
      const r = c.risk.preeclampsia?.results as { pretermPE?: number } | null;
      return r?.pretermPE != null ? formatRisk(r.pretermPE) : '—';
    }},
  { token: 'sptb_risk', label: 'sPTB <34w risk', group: 'Risk',
    resolve: (c) => {
      const r = c.risk.preterm?.results as { sPTBunder34?: number } | null;
      return r?.sPTBunder34 != null ? formatRisk(r.sPTBunder34) : '—';
    }},

  // ── Findings summary ──
  { token: 'findings_list',  label: 'All findings (comma list)', group: 'Findings',
    resolve: (c) => c.dst.findings.filter((f) => f.include_in_report)
                                  .map((f) => f.name).join(', ') || 'No abnormal findings.' },
  { token: 'syndromes_list', label: 'Syndromes considered',      group: 'Findings',
    resolve: (c) => c.dst.syndromes.filter((s) => s.include_in_report)
                                   .map((s) => s.name).join(', ') || '—' },
  { token: 'investigations_basic',    label: 'Recommended basic tests',    group: 'Findings',
    resolve: (c) => c.dst.investigations.filter((i) => i.include_in_report && i.category === 'basic')
                                        .map((i) => i.name).join(', ') || '—' },
  { token: 'investigations_specific', label: 'Recommended specific tests', group: 'Findings',
    resolve: (c) => c.dst.investigations.filter((i) => i.include_in_report && i.category === 'specific')
                                        .map((i) => i.name).join(', ') || '—' },
];

/** Look up a placeholder by its raw token, case-insensitive. */
export function findPlaceholder(token: string): PlaceholderDef | undefined {
  const t = token.trim().toLowerCase();
  return PLACEHOLDERS.find((p) => p.token === t);
}

/**
 * Replace every `{{token}}` (whitespace-tolerant) in `body` with its
 * resolved value. Unknown tokens are left untouched so the user notices.
 */
export function resolvePlaceholders(body: string, ctx: PlaceholderContext): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, tokenName: string) => {
    const def = findPlaceholder(tokenName);
    if (!def) return full;
    try { return def.resolve(ctx) ?? ''; }
    catch { return full; }
  });
}

/** Returns the placeholders bucketed by group, for the Insert dropdown. */
export function groupedPlaceholders(): Record<PlaceholderDef['group'], PlaceholderDef[]> {
  const out: Record<string, PlaceholderDef[]> = {};
  for (const p of PLACEHOLDERS) (out[p.group] ||= []).push(p);
  return out as any;
}
