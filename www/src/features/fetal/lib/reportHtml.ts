/**
 * Pure HTML builder for the fetal medicine report.
 *
 * Takes a `ReportData` bundle (collected by the Composer tab from all the
 * fetal stores + hospital branding) and produces a fully self-contained
 * HTML document suitable for either:
 *   - printing via window.print()
 *   - saving as a string in medical_reports
 *
 * The CSS is inlined so the same string renders identically in a popup
 * window or when rehydrated later. No external dependencies.
 */

import type { Examination } from '@/features/fetal/types';
import type { BiometryField } from '@/features/fetal/types';
import type { StructuralRow } from '@/features/fetal/api/structuralApi';
import type {
  ExamFinding, ExamSyndrome, ExamGene, ExamInvestigation,
} from '@/features/fetal/api/dstApi';
import type { RiskResultRow } from '@/features/fetal/api/riskApi';
import type { InterventionProcedure } from '@/features/fetal/api/interventionsApi';
import { formatRisk } from '@/features/fetal/lib/fmfRisk';
import { CHECKLISTS, type ChecklistKind } from '@/features/fetal/lib/anatomySchema';

export interface ReportData {
  hospital: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    logoDataUrl?: string;
  };
  patient: {
    id: string;
    name?: string;
    age?: string;
    sex?: string;
    referringDoctor?: string;
  };
  examination: Examination;
  dating: { gaDisplay: string; gaWeeks: number | null; edd: string | null };
  biometry: Record<string, BiometryField>;
  biometryAuthor: string | null;
  structural: StructuralRow[];
  findings: ExamFinding[];
  syndromes: ExamSyndrome[];
  genes: ExamGene[];
  investigations: ExamInvestigation[];
  risk: Record<'aneuploidy' | 'preeclampsia' | 'preterm', RiskResultRow | null>;
  interventions:        InterventionProcedure[];
  counsellingNotes:     string;
  contentBody: string;
  recommendationsBody: string;
  /** Map of parameter key → SVG/data-url string for embedded growth charts. */
  charts: Record<string, string>;
  sectionInclude: Record<string, boolean>;
}

/* Scanofe-style: clean, document-like layout — bordered 3-cell header,
   centered report title, left-column blue section heading with dotted-leader
   key/value pairs in the right content column. */
const css = `
  * { box-sizing: border-box; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #2b2b2b;
         font-size: 10pt; margin: 0; padding: 0; line-height: 1.4; }
  .page { padding: 14mm 14mm 12mm; max-width: 210mm; margin: 0 auto; }

  /* ── Page header (3-cell bordered table) ── */
  table.brand { width: 100%; border-collapse: collapse; margin-bottom: 8pt; }
  table.brand td { border: 0.5pt solid #9aa3b2; padding: 6pt 8pt; vertical-align: middle; }
  td.brand-logo  { width: 22%; height: 64pt; text-align: center; color: #888; font-size: 9pt; }
  td.brand-logo img { max-height: 50pt; max-width: 100%; object-fit: contain; }
  td.brand-name  { width: 56%; text-align: center; }
  td.brand-name .title { font-size: 17pt; font-weight: 800; color: #1a1a1a; letter-spacing: 0.2pt; line-height: 1.15; }
  td.brand-name .doctor { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4pt; font-size: 10pt; }
  td.brand-name .doctor .doc-name { font-weight: 700; color: #1a1a1a; }
  td.brand-name .doctor .doc-name + .role { font-weight: 400; color: #555; margin-left: 4pt; }
  td.brand-name .doctor .doc-city { color: #444; }
  td.brand-right { width: 22%; text-align: center; font-size: 9pt; color: #555; }
  td.brand-right img { max-height: 26pt; max-width: 100%; }
  td.brand-right .tag { font-size: 7.5pt; color: #6b7280; margin-top: 2pt; line-height: 1.2; }

  /* ── Patient info bar (lightly bordered band) ── */
  table.patient { width: 100%; border-collapse: collapse; margin-bottom: 10pt; }
  table.patient td { border: 0.5pt solid #9aa3b2; padding: 3pt 8pt; font-size: 10pt; vertical-align: top; }
  table.patient td .lbl { display: inline-block; width: 110pt; color: #1a1a1a; }
  table.patient td .val { color: #2b2b2b; }

  /* ── Report title ── */
  .report-title { text-align: center; font-size: 12pt; font-weight: 800;
                  color: #1a1a1a; letter-spacing: 0.4pt; margin: 4pt 0 14pt; }

  /* ── Section block: left-column blue heading + right content ── */
  table.section { width: 100%; border-collapse: collapse; margin: 0 0 10pt; }
  table.section > tbody > tr > td { vertical-align: top; padding: 2pt 0; }
  td.section-head { width: 110pt; padding-right: 10pt; color: #1f3a64;
                    font-size: 11pt; font-weight: 700; }
  td.section-body { padding-left: 0; }

  /* Dotted-leader key/value rows */
  .kv { display: flex; align-items: baseline; font-size: 10pt; margin-bottom: 2pt; }
  .kv .label { white-space: nowrap; color: #2b2b2b; }
  .kv .dots  { flex: 1; border-bottom: 1px dotted #8a92a3; margin: 0 6pt;
               transform: translateY(-2pt); height: 0; }
  .kv .value { white-space: nowrap; color: #2b2b2b; font-weight: 500; }

  /* Section sub-table (Dating, biometry, family history etc.) */
  table.subdata { width: 100%; border-collapse: collapse; margin-top: 2pt; }
  table.subdata th, table.subdata td { padding: 3pt 6pt; font-size: 9.5pt;
                                       text-align: left; vertical-align: top; }
  table.subdata thead th { color: #1a1a1a; font-weight: 700; border-bottom: 0.5pt solid #c0c6d2; }
  table.subdata tbody tr td { color: #2b2b2b; border-bottom: 0.5pt dotted #d8dce4; }
  table.subdata tbody tr:last-child td { border-bottom: 0; }
  table.subdata tr.abnormal td { background: #fff1f2; }
  table.subdata tr.warn td     { background: #fff8e1; }

  /* Two-column family history layout */
  table.family { width: 100%; border-collapse: collapse; margin-top: 2pt; font-size: 9.5pt; }
  table.family th, table.family td { padding: 3pt 6pt; text-align: left; }
  table.family thead th { font-weight: 700; color: #1a1a1a; border-bottom: 0.5pt solid #c0c6d2; }
  table.family td.cond { color: #2b2b2b; }
  table.family td.val  { text-align: center; color: #2b2b2b; width: 23%; }
  table.family tbody tr td { border-bottom: 0.5pt dotted #d8dce4; }
  table.family tbody tr:last-child td { border-bottom: 0; }

  /* Chips for selected findings/syndromes/genes */
  .chip { display: inline-block; padding: 1.5pt 7pt; border-radius: 9pt;
          font-size: 9pt; background: #eef1f6; color: #2b2b2b;
          margin: 1pt 3pt 1pt 0; border: 0.4pt solid #d4d9e3; }
  .chip.r { background: #fde7e9; color: #8a1f29; border-color: #f0c3c8; }
  .chip.y { background: #fff3c4; color: #6b4a00; border-color: #ecd693; }
  .chip.g { background: #ddf1df; color: #1e5128; border-color: #b7dcbd; }

  /* Rich text content body */
  .rich p { margin: 0 0 6pt; }
  .rich ul, .rich ol { margin: 4pt 0 6pt 18pt; }
  .rich h3 { margin: 6pt 0 3pt; font-size: 10.5pt; color: #1f3a64; }

  /* Charts */
  .chart-block { margin: 4pt 0 8pt; padding: 0; }
  .chart-block .chart-title { font-size: 10pt; font-weight: 700; color: #1f3a64; margin-bottom: 2pt; }

  /* Empty/placeholder text */
  .empty { color: #8e97aa; font-style: italic; font-size: 9.5pt; }

  /* Page footer */
  .page-footer { margin-top: 14pt; padding-top: 4pt; border-top: 0.5pt solid #c0c6d2;
                 font-size: 8pt; color: #6b7280; display: flex; justify-content: space-between; }

  @page { size: A4; margin: 0; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function richHtml(body: string): string {
  if (!body.trim()) return '';
  // If the body already contains HTML tags (produced by the RichTextEditor
  // or by a template), pass it through unchanged. Otherwise fall back to
  // the plain-text → paragraph treatment for legacy inputs.
  if (/<[a-zA-Z][^>]*>/.test(body)) return body;
  return body
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function pctColorClass(pct: number | null): '' | 'chip-r' | 'chip-y' | 'chip-g' {
  if (pct == null) return '';
  if (pct < 5 || pct > 95) return 'chip-r';
  if (pct < 10 || pct > 90) return 'chip-y';
  return 'chip-g';
}

// ── Helpers shared by renderers ────────────────────────────────────────────

/** "EARLY PREGNANCY REPORT", "2ND TRIMESTER REPORT", etc. */
function reportTitleFor(d: ReportData): string {
  const t = d.examination.exam_type;
  const weeks = d.dating.gaWeeks;
  if (t === 'FTS' || (weeks !== null && weeks < 14)) return 'EARLY PREGNANCY REPORT';
  if (t === 'SECOND_TRIMESTER') return 'SECOND TRIMESTER REPORT';
  if (t === 'THIRD_TRIMESTER')  return 'THIRD TRIMESTER REPORT';
  if (t === 'FETAL_ECHO')       return 'FETAL ECHOCARDIOGRAPHY REPORT';
  if (t === 'NEURO')            return 'FETAL NEUROSONOGRAPHY REPORT';
  return 'FETAL MEDICINE REPORT';
}

/** key-value row with dotted leader (Scanofe-style). */
function kv(label: string, value: string): string {
  return `<div class="kv"><span class="label">${esc(label)}</span><span class="dots"></span><span class="value">${esc(value)}</span></div>`;
}

/** Wrap a section with the left-column heading + right-content layout. */
function section(heading: string, contentHtml: string): string {
  if (!contentHtml.trim()) return '';
  return `<table class="section"><tbody><tr>
    <td class="section-head">${esc(heading)}</td>
    <td class="section-body">${contentHtml}</td>
  </tr></tbody></table>`;
}

/** Parse a JSON-string column safely; returns {} when missing/invalid. */
function parseJsonField(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string')   return {};
  try { const o = JSON.parse(value); return (o && typeof o === 'object') ? o : {}; }
  catch { return {}; }
}

// ── Section renderers ──────────────────────────────────────────────────────

/** 3-cell bordered brand header — Hospital Logo | Title + Doctor | Right brand */
function renderHeader(d: ReportData): string {
  const h = d.hospital;
  const doctorName = (d.patient.referringDoctor || '').trim();
  const city = (h.address.split(',').pop() || '').trim();
  return `
    <table class="brand">
      <tr>
        <td class="brand-logo">
          ${h.logoDataUrl
            ? `<img src="${esc(h.logoDataUrl)}" alt="Logo">`
            : `<span>Hospital Logo</span>`}
        </td>
        <td class="brand-name">
          <div class="title">${esc(h.name || 'Fetal Medicine Imaging')}</div>
          <div class="doctor">
            <span>
              ${doctorName ? `<span class="doc-name">${esc(doctorName)}</span><br><span class="role">Doctor</span>` : `<span class="doc-name">&nbsp;</span>`}
            </span>
            <span class="doc-city">${esc(city)}</span>
          </div>
        </td>
        <td class="brand-right">
          <div style="font-weight:700;color:#1f3a64;font-size:11pt">One Clickz</div>
          <div class="tag">Fetal Medicine Module</div>
        </td>
      </tr>
    </table>`;
}

/** Patient bar — name / date / id stacked on the left, page is left-aligned. */
function renderPatient(d: ReportData): string {
  return `
    <table class="patient">
      <tr><td><span class="lbl">Name :</span><span class="val">${esc(d.patient.name || 'N/A')}</span></td></tr>
      <tr><td><span class="lbl">Examination Date :</span><span class="val">${esc(d.examination.exam_date || 'N/A')}</span></td></tr>
      <tr><td><span class="lbl">Patient ID :</span><span class="val">${esc(d.patient.id || 'N/A')}</span></td></tr>
    </table>
    <div class="report-title">${esc(reportTitleFor(d))}</div>`;
}

/** Dating: 4-column sub-table (Method | Date | GA | EDD by Scan). */
function renderDating(d: ReportData): string {
  return section('Dating', `
    <table class="subdata">
      <thead><tr>
        <th>Method</th><th>Date</th><th>Gestational Age</th><th>EDD by Scan</th>
      </tr></thead>
      <tbody><tr>
        <td>LMP</td>
        <td>${esc(d.examination.lmp_date || 'N/A')}</td>
        <td>${esc(d.dating.gaDisplay || 'N/A')}</td>
        <td>${esc(d.dating.edd || 'N/A')}</td>
      </tr></tbody>
    </table>`);
}

/** Pregnancy — Type + Obstetric History (G/P/A/L/E). */
function renderPregnancy(d: ReportData): string {
  const ob = parseJsonField((d.examination as unknown as { obstetric_history?: unknown }).obstetric_history);
  const type = (ob.type as string) || 'Single Pregnancy';
  const G = (ob.G as number | string) ?? 0;
  const P = (ob.P as number | string) ?? 0;
  const A = (ob.A as number | string) ?? 0;
  const L = (ob.L as number | string) ?? 0;
  const E = (ob.E as number | string) ?? 0;
  const gpale = `G ${G}  P ${P}  A ${A}  L ${L}  E ${E}`;
  return section('Pregnancy', `
    ${kv('Type', type)}
    ${kv('Obstetric History', gpale)}
  `);
}

/** Maternal assessment — Cycle Regularity / Days / Conception / Cigarettes / Consanguinity */
function renderMaternal(d: ReportData): string {
  const m = parseJsonField((d.examination as unknown as { maternal_assessment?: unknown }).maternal_assessment);
  const cycleReg   = (m.cycleRegularity as string) || 'Regular';
  const cycleDays  = String(m.cycleDays ?? '28');
  const conception = (m.conception as string) || 'Spontaneous';
  const cigarettes = (m.cigarettes as string) || 'No';
  const consang    = (m.consanguinity as string) || 'No';

  // Only show extended maternal vitals if they were recorded.
  const optionalRows: string[] = [];
  if (m.height)   optionalRows.push(kv('Height',          `${m.height} cm`));
  if (m.weight)   optionalRows.push(kv('Weight',          `${m.weight} kg`));
  if (m.bmi)      optionalRows.push(kv('BMI',             `${m.bmi}`));
  if (m.bp)       optionalRows.push(kv('Blood Pressure',  `${m.bp}`));
  if (m.map)      optionalRows.push(kv('MAP',             `${m.map}`));

  return section('Maternal assessment', `
    ${kv('Cycle Regularity', cycleReg)}
    ${kv('Cycle Days',       cycleDays)}
    ${kv('Conception',       conception)}
    ${kv('Cigarettes',       cigarettes)}
    ${kv('Consanguinity',    consang)}
    ${optionalRows.join('')}
  `);
}

/** Family history — two-column table (Maternal | Partner). */
function renderFamilyHistory(d: ReportData): string {
  const f = parseJsonField((d.examination as unknown as { family_history?: unknown }).family_history);
  const conditions: ReadonlyArray<readonly [string, string]> = [
    ['Diabetes',                         'diabetes'],
    ['Disability',                       'disability'],
    ['Hemoglobinopathy',                 'hemoglobinopathy'],
    ['Hypertension',                     'hypertension'],
    ['Malformations',                    'malformations'],
    ['Medical Termination Of Pregnancy', 'mtp'],
    ['Recurrent Miscarriage',            'recurrentMiscarriage'],
  ];
  const lookup = (side: 'maternal' | 'partner', key: string): string => {
    const sideObj = (f[side] as Record<string, unknown> | undefined) ?? {};
    const v = sideObj[key];
    if (v === undefined || v === null || v === '') return 'No';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };
  const rows = conditions
    .map(([label, key]) => `<tr>
      <td class="cond">${esc(label)}</td>
      <td class="val">${esc(lookup('maternal', key))}</td>
      <td class="val">${esc(lookup('partner',  key))}</td>
    </tr>`)
    .join('');
  return section('Family History', `
    <table class="family">
      <thead><tr><th>&nbsp;</th><th class="val">Maternal History</th><th class="val">Partner History</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function renderBiometry(d: ReportData): string {
  const entries = Object.entries(d.biometry).filter(([, f]) => f.value !== null && f.value !== undefined);
  if (entries.length === 0) return section('Fetal Biometry', `<div class="empty">No biometry recorded.</div>`);

  const rows = entries.map(([k, f]) => {
    const cls = pctColorClass(f.percentile);
    return `<tr class="${cls === 'chip-r' ? 'abnormal' : cls === 'chip-y' ? 'warn' : ''}">
      <td><b>${esc(k)}</b></td>
      <td>${f.value} ${esc(f.unit)}</td>
      <td>${esc(f.referenceAuthor || 'N/A')}</td>
      <td>${f.percentile != null ? `${f.percentile.toFixed(1)}<sup>th</sup>` : 'N/A'}</td>
      <td>${f.zScore != null ? f.zScore.toFixed(2) : 'N/A'}</td>
    </tr>`;
  }).join('');

  return section('Fetal Biometry', `
    <table class="subdata">
      <thead><tr><th>Parameter</th><th>Value</th><th>Reference</th><th>Centile</th><th>z-score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function renderStructural(d: ReportData): string {
  if (d.structural.length === 0) {
    return section('Structural Assessment', `<div class="empty">Not assessed.</div>`);
  }

  // Group by checklist kind (body part vs echo vs neuro) — inferred from system key.
  const groups: Record<ChecklistKind, StructuralRow[]> = { body_part: [], echo: [], neuro: [] };
  for (const r of d.structural) {
    if (r.system.startsWith('echo_'))      groups.echo.push(r);
    else if (r.system.startsWith('neuro_')) groups.neuro.push(r);
    else                                    groups.body_part.push(r);
  }
  const kindLabel: Record<ChecklistKind, string> = {
    body_part: 'Body Part Checklist',
    echo:      'Fetal Echocardiography',
    neuro:     'Neurosonography',
  };

  // Each checklist kind is its own section block so the left "Structural" heading
  // stays clean. We emit them as separate sections only when populated.
  const blocks: string[] = [];
  for (const kind of Object.keys(groups) as ChecklistKind[]) {
    const rows = groups[kind];
    if (rows.length === 0) continue;
    const schema = CHECKLISTS[kind];
    const labelLookup = new Map<string, string>();
    for (const sys of schema) for (const a of sys.items) labelLookup.set(`${sys.key}::${a.key}`, a.label);

    const tableRows = rows.map((r) => {
      const label = labelLookup.get(`${r.system}::${r.anatomyKey}`) || `${r.system} / ${r.anatomyKey}`;
      const cls = r.status === 'abnormal' ? 'abnormal' : r.status === 'not_seen' ? 'warn' : '';
      return `<tr class="${cls}">
        <td>${esc(label)}</td>
        <td>${esc(r.status.replace('_', ' '))}</td>
        <td>${esc(r.comments ?? '')}</td>
      </tr>`;
    }).join('');

    blocks.push(section(kindLabel[kind], `
      <table class="subdata">
        <thead><tr><th>Anatomy</th><th>Status</th><th>Comments</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>`));
  }
  return blocks.join('');
}

function renderRisk(d: ReportData): string {
  const aneu = d.risk.aneuploidy?.results as any;
  const pe   = d.risk.preeclampsia?.results as any;
  const pt   = d.risk.preterm?.results as any;
  if (!aneu && !pe && !pt) {
    return section('Risk Assessment', `<div class="empty">No risk calculations performed.</div>`);
  }

  const blocks: string[] = [];
  if (aneu && d.risk.aneuploidy?.include_in_report) {
    const rows = (['t21', 't18', 't13'] as const).map((k) => {
      const label = k === 't21' ? 'T21 (Down)' : k === 't18' ? 'T18 (Edwards)' : 'T13 (Patau)';
      const cat   = aneu.category?.[k] ?? 'low';
      const cls   = cat === 'high' ? 'abnormal' : cat === 'moderate' ? 'warn' : '';
      return `<tr class="${cls}">
        <td>${label}</td>
        <td>${formatRisk(aneu.apriori[k])}</td>
        <td>${aneu.lr[k].toFixed(2)}</td>
        <td><b>${formatRisk(aneu.combined[k])}</b></td>
        <td>${cat}</td>
      </tr>`;
    }).join('');
    blocks.push(section('Aneuploidy Risk', `
      <table class="subdata">
        <thead><tr><th>Trisomy</th><th>A-priori</th><th>Composite LR</th><th>Combined</th><th>Category</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`));
  }
  if (pe && d.risk.preeclampsia?.include_in_report) {
    const cat = pe.category ?? 'low';
    const cls = cat === 'high' ? 'abnormal' : cat === 'moderate' ? 'warn' : '';
    blocks.push(section('Preeclampsia Risk', `
      <table class="subdata">
        <tbody>
          <tr class="${cls}"><td><b>Preterm PE (&lt; 37 wk)</b></td><td>${formatRisk(pe.pretermPE)}</td><td>${cat}</td></tr>
          <tr><td>Term PE</td><td>${formatRisk(pe.termPE)}</td><td>—</td></tr>
        </tbody>
      </table>`));
  }
  if (pt && d.risk.preterm?.include_in_report) {
    const cat = pt.category ?? 'low';
    const cls = cat === 'high' ? 'abnormal' : cat === 'moderate' ? 'warn' : '';
    blocks.push(section('Preterm Birth Risk', `
      <table class="subdata">
        <tbody>
          <tr class="${cls}"><td><b>sPTB &lt; 34 weeks</b></td><td>${formatRisk(pt.sPTBunder34)}</td><td>${cat}</td></tr>
        </tbody>
      </table>`));
  }
  return blocks.join('');
}

function renderFindings(d: ReportData): string {
  const inc = (rows: { include_in_report: number }[]) => rows.filter((r) => r.include_in_report);
  const fIn = inc(d.findings) as ExamFinding[];
  const sIn = inc(d.syndromes) as ExamSyndrome[];
  const gIn = inc(d.genes) as ExamGene[];
  const iBasic = (d.investigations as ExamInvestigation[]).filter((i) => i.include_in_report && i.category === 'basic');
  const iSpec  = (d.investigations as ExamInvestigation[]).filter((i) => i.include_in_report && i.category === 'specific');

  if (!fIn.length && !sIn.length && !gIn.length && !iBasic.length && !iSpec.length) {
    return section('Diagnoses & Investigations', `<div class="empty">None selected.</div>`);
  }

  const chips = (rows: { id: number; name?: string; symbol?: string }[]) =>
    rows.length === 0 ? '<span class="empty">—</span>'
                      : rows.map((r) => `<span class="chip">${esc(r.name ?? r.symbol ?? '')}</span>`).join(' ');
  const synChips = sIn.length === 0
    ? '<span class="empty">—</span>'
    : sIn.map((s) => `<span class="chip">${esc(s.name)}${s.match_score_num != null ? ` (${s.match_score_num}/${s.match_score_den})` : ''}</span>`).join(' ');

  const blocks: string[] = [];
  if (fIn.length)    blocks.push(kv('Findings',          '') + `<div style="margin-top:-2pt">${chips(fIn)}</div>`);
  if (sIn.length)    blocks.push(kv('Syndromes',         '') + `<div style="margin-top:-2pt">${synChips}</div>`);
  if (gIn.length)    blocks.push(kv('Genes',             '') + `<div style="margin-top:-2pt">${chips(gIn)}</div>`);
  if (iBasic.length) blocks.push(kv('Basic tests',       '') + `<div style="margin-top:-2pt">${chips(iBasic)}</div>`);
  if (iSpec.length)  blocks.push(kv('Specific tests',    '') + `<div style="margin-top:-2pt">${chips(iSpec)}</div>`);

  return section('Diagnoses & Investigations', blocks.join(''));
}

function renderInterventions(d: ReportData): string {
  const visible = d.interventions.filter((p) => p.include_in_report);
  if (visible.length === 0 && !d.counsellingNotes.trim()) return '';

  const blocks: string[] = [];
  if (visible.length) {
    const rows = visible.map((p) => `<tr>
      <td>${esc(p.procedure_date || 'N/A')}</td>
      <td>${esc(p.procedure_type)}</td>
      <td>${esc(p.operator || 'N/A')}</td>
      <td>${esc(p.indication || 'N/A')}</td>
      <td>${esc(p.findings || 'N/A')}</td>
      <td>${esc(p.outcome || 'N/A')}</td>
    </tr>`).join('');
    blocks.push(section('Interventions', `
      <table class="subdata">
        <thead><tr><th>Date</th><th>Procedure</th><th>Operator</th><th>Indication</th><th>Findings</th><th>Outcome</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`));
  }
  if (d.counsellingNotes.trim()) {
    blocks.push(section('Counselling', `<div class="rich">${richHtml(d.counsellingNotes)}</div>`));
  }
  return blocks.join('');
}

function renderContent(d: ReportData): string {
  if (!d.contentBody.trim()) return '';
  return section('Report Content', `<div class="rich">${richHtml(d.contentBody)}</div>`);
}

function renderRecommendations(d: ReportData): string {
  if (!d.recommendationsBody.trim()) return '';
  return section('Recommendations', `<div class="rich">${richHtml(d.recommendationsBody)}</div>`);
}

function renderCharts(d: ReportData): string {
  const params = Object.keys(d.charts);
  if (params.length === 0) return '';
  const blocks = params.map((p) =>
    `<div class="chart-block"><div class="chart-title">${esc(p)}</div>${d.charts[p]}</div>`
  ).join('');
  return section('Growth Charts', blocks);
}

// ── Public builder ─────────────────────────────────────────────────────────

/** Produce a full self-contained HTML document for the fetal report.
 *  Section order mirrors the Scanofe demo layout. */
export function buildReportHtml(d: ReportData): string {
  const inc = d.sectionInclude;
  const sections: string[] = [];

  if (inc.header    ?? true) sections.push(renderHeader(d));
  if (inc.patient   ?? true) sections.push(renderPatient(d));          // also emits the centered report title
  if (inc.dating    ?? true) sections.push(renderDating(d));
  if (inc.pregnancy ?? true) sections.push(renderPregnancy(d));
  if (inc.maternal  ?? true) sections.push(renderMaternal(d));
  if (inc.family    ?? true) sections.push(renderFamilyHistory(d));
  if (inc.biometry  ?? true) sections.push(renderBiometry(d));
  if (inc.structural ?? true) sections.push(renderStructural(d));
  if (inc.risk      ?? true) sections.push(renderRisk(d));
  if (inc.findings  ?? true) sections.push(renderFindings(d));
  if (inc.intervention ?? true) sections.push(renderInterventions(d));
  if (inc.content   ?? true) sections.push(renderContent(d));
  if (inc.recommendations ?? true) sections.push(renderRecommendations(d));
  if (inc.charts    ?? true) sections.push(renderCharts(d));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fetal Medicine Report — ${esc(d.patient.name || d.patient.id)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">
    ${sections.filter(Boolean).join('\n')}
    <div class="page-footer">
      <span>Generated by One Clickz · Fetal Medicine Module</span>
      <span>${new Date().toLocaleDateString()}</span>
    </div>
  </div>
</body>
</html>`;
}

/** Open the rendered HTML in a popup window and trigger the print dialog. */
export function printReport(html: string): void {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    alert('Pop-up blocked. Allow pop-ups for this site to print the report.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Wait one paint so images and SVG have rendered before printing.
  setTimeout(() => { w.focus(); w.print(); }, 400);
}
