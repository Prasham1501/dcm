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

const css = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; font-size: 11pt;
         margin: 0; padding: 0; line-height: 1.45; }
  .page { padding: 18mm 16mm; max-width: 210mm; margin: 0 auto; }
  h1, h2, h3 { margin: 0 0 6px; color: #1e3a8a; }
  h1 { font-size: 18pt; letter-spacing: 0.5px; }
  h2 { font-size: 12pt; text-transform: uppercase; letter-spacing: 1px;
       border-bottom: 1.5pt solid #1e3a8a; padding-bottom: 2px; margin-top: 14pt; }
  h3 { font-size: 10pt; color: #374151; margin-top: 6pt; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; font-size: 9.5pt; }
  th, td { border: 0.5pt solid #94a3b8; padding: 3pt 6pt; text-align: left; vertical-align: top; }
  th { background: #e2e8f0; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.4px; }
  tr.abnormal td { background: #fee2e2; }
  tr.warn td     { background: #fef3c7; }
  .header { display: flex; align-items: center; gap: 14pt; padding-bottom: 8pt; border-bottom: 2pt solid #1e3a8a; }
  .header img { max-height: 60pt; }
  .header .info { flex: 1; }
  .header .info .practice { font-size: 14pt; font-weight: 700; color: #1e3a8a; }
  .header .info .contact { font-size: 9pt; color: #4b5563; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6pt; font-size: 10pt; margin: 6pt 0; }
  .meta-grid div { display: flex; }
  .meta-grid b { min-width: 80pt; color: #374151; }
  .chip { display: inline-block; padding: 1pt 6pt; border-radius: 8pt; font-size: 8.5pt;
          background: #e2e8f0; margin: 1pt 2pt 1pt 0; }
  .chip-r { background: #fee2e2; color: #991b1b; }
  .chip-y { background: #fef3c7; color: #92400e; }
  .chip-g { background: #d1fae5; color: #065f46; }
  .pct-bar { width: 80pt; height: 6pt; background: #e2e8f0; position: relative; border-radius: 3pt; }
  .pct-bar .marker { position: absolute; top: -2pt; width: 2pt; height: 10pt; background: #dc2626; }
  .pct-bar .band   { position: absolute; top: 0; height: 6pt; background: #93c5fd; border-radius: 3pt; left: 5%; right: 5%; }
  .empty { color: #94a3b8; font-style: italic; font-size: 9pt; }
  .footer { margin-top: 20pt; padding-top: 6pt; border-top: 1pt solid #94a3b8;
            font-size: 8pt; color: #6b7280; text-align: center; }
  .chart-block { margin: 6pt 0; padding: 6pt; border: 0.5pt solid #cbd5e1; border-radius: 4pt; }
  .chart-block h3 { margin-top: 0; }
  .rich p { margin: 0 0 6pt; }
  @page { size: A4; margin: 0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
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

// ── Section renderers ──────────────────────────────────────────────────────

function renderHeader(d: ReportData): string {
  const h = d.hospital;
  return `
    <div class="header">
      ${h.logoDataUrl ? `<img src="${esc(h.logoDataUrl)}" alt="logo">` : ''}
      <div class="info">
        <div class="practice">${esc(h.name)}</div>
        <div class="contact">${esc(h.address)}</div>
        ${h.phone ? `<div class="contact">Tel: ${esc(h.phone)}</div>` : ''}
        ${h.email ? `<div class="contact">${esc(h.email)}</div>` : ''}
      </div>
      <div class="info" style="text-align:right; font-size:9pt; color:#4b5563;">
        <div><b>Report:</b> Fetal Medicine</div>
        <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
      </div>
    </div>`;
}

function renderPatient(d: ReportData): string {
  return `
    <h2>Patient</h2>
    <div class="meta-grid">
      <div><b>Patient ID</b> ${esc(d.patient.id)}</div>
      <div><b>Name</b> ${esc(d.patient.name || '—')}</div>
      <div><b>Age</b> ${esc(d.patient.age || '—')}</div>
      <div><b>Sex</b> ${esc(d.patient.sex || '—')}</div>
      <div><b>Referrer</b> ${esc(d.patient.referringDoctor || '—')}</div>
    </div>`;
}

function renderDating(d: ReportData): string {
  return `
    <h2>Dating</h2>
    <div class="meta-grid">
      <div><b>LMP</b> ${esc(d.examination.lmp_date || '—')}</div>
      <div><b>Exam Date</b> ${esc(d.examination.exam_date || '—')}</div>
      <div><b>GA</b> ${esc(d.dating.gaDisplay || '—')}</div>
      <div><b>EDD</b> ${esc(d.dating.edd || '—')}</div>
      <div><b>Exam Type</b> ${esc(d.examination.exam_type)}</div>
    </div>`;
}

function renderBiometry(d: ReportData): string {
  const entries = Object.entries(d.biometry).filter(([, f]) => f.value !== null && f.value !== undefined);
  if (entries.length === 0) return `<h2>Fetal Biometry</h2><div class="empty">No biometry recorded.</div>`;

  const rows = entries.map(([k, f]) => {
    const cls = pctColorClass(f.percentile);
    return `<tr class="${cls === 'chip-r' ? 'abnormal' : cls === 'chip-y' ? 'warn' : ''}">
      <td><b>${esc(k)}</b></td>
      <td>${f.value} ${esc(f.unit)}</td>
      <td>${esc(f.referenceAuthor || '—')}</td>
      <td>${f.percentile != null ? `${f.percentile.toFixed(1)}<sup>th</sup>` : '—'}</td>
      <td>${f.zScore != null ? f.zScore.toFixed(2) : '—'}</td>
    </tr>`;
  }).join('');

  return `
    <h2>Fetal Biometry</h2>
    <table>
      <thead><tr><th>Parameter</th><th>Value</th><th>Reference</th><th>Centile</th><th>z-score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderStructural(d: ReportData): string {
  if (d.structural.length === 0) return `<h2>Structural Assessment</h2><div class="empty">Not assessed.</div>`;

  // Group by checklist kind (body part vs echo vs neuro) — we infer the kind
  // from the system key.
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

  let out = `<h2>Structural Assessment</h2>`;
  for (const kind of Object.keys(groups) as ChecklistKind[]) {
    const rows = groups[kind];
    if (rows.length === 0) continue;

    // Resolve human-readable labels via the in-app schema
    const schema = CHECKLISTS[kind];
    const labelLookup = new Map<string, string>();
    for (const sys of schema) for (const a of sys.items) labelLookup.set(`${sys.key}::${a.key}`, a.label);

    out += `<h3>${kindLabel[kind]}</h3>`;
    out += `<table><thead><tr><th>Anatomy</th><th>Status</th><th>Comments</th></tr></thead><tbody>`;
    for (const r of rows) {
      const label = labelLookup.get(`${r.system}::${r.anatomyKey}`) || `${r.system} / ${r.anatomyKey}`;
      const cls = r.status === 'abnormal' ? 'abnormal' : r.status === 'not_seen' ? 'warn' : '';
      out += `<tr class="${cls}">
        <td>${esc(label)}</td>
        <td>${esc(r.status.replace('_', ' '))}</td>
        <td>${esc(r.comments ?? '')}</td>
      </tr>`;
    }
    out += `</tbody></table>`;
  }
  return out;
}

function renderRisk(d: ReportData): string {
  const aneu = d.risk.aneuploidy?.results as any;
  const pe   = d.risk.preeclampsia?.results as any;
  const pt   = d.risk.preterm?.results as any;
  if (!aneu && !pe && !pt) return `<h2>Risk Assessment</h2><div class="empty">No risk calculations performed.</div>`;

  let out = `<h2>Risk Assessment</h2>`;
  if (aneu && d.risk.aneuploidy?.include_in_report) {
    out += `<h3>Aneuploidy (FMF combined model)</h3>
      <table>
        <thead><tr><th>Trisomy</th><th>A-priori</th><th>Composite LR</th><th>Combined</th><th>Category</th></tr></thead>
        <tbody>
          ${(['t21', 't18', 't13'] as const).map((k) => {
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
          }).join('')}
        </tbody>
      </table>`;
  }
  if (pe && d.risk.preeclampsia?.include_in_report) {
    const cat = pe.category ?? 'low';
    const cls = cat === 'high' ? 'abnormal' : cat === 'moderate' ? 'warn' : '';
    out += `<h3>Preeclampsia (FMF 2-stage)</h3>
      <table><tbody>
        <tr class="${cls}"><td><b>Preterm PE (&lt; 37 wk)</b></td><td>${formatRisk(pe.pretermPE)}</td><td>${cat}</td></tr>
        <tr><td>Term PE</td><td>${formatRisk(pe.termPE)}</td><td>—</td></tr>
      </tbody></table>`;
  }
  if (pt && d.risk.preterm?.include_in_report) {
    const cat = pt.category ?? 'low';
    const cls = cat === 'high' ? 'abnormal' : cat === 'moderate' ? 'warn' : '';
    out += `<h3>Preterm Birth (cervical length)</h3>
      <table><tbody>
        <tr class="${cls}"><td><b>sPTB &lt; 34 weeks</b></td><td>${formatRisk(pt.sPTBunder34)}</td><td>${cat}</td></tr>
      </tbody></table>`;
  }
  return out;
}

function renderFindings(d: ReportData): string {
  const inc = (rows: { include_in_report: number }[]) => rows.filter((r) => r.include_in_report);
  const fIn = inc(d.findings) as ExamFinding[];
  const sIn = inc(d.syndromes) as ExamSyndrome[];
  const gIn = inc(d.genes) as ExamGene[];
  const iBasic = (d.investigations as ExamInvestigation[]).filter((i) => i.include_in_report && i.category === 'basic');
  const iSpec  = (d.investigations as ExamInvestigation[]).filter((i) => i.include_in_report && i.category === 'specific');

  if (!fIn.length && !sIn.length && !gIn.length && !iBasic.length && !iSpec.length) {
    return `<h2>Diagnoses &amp; Investigations</h2><div class="empty">None selected.</div>`;
  }

  const td = (rows: { id: number; name?: string; symbol?: string; description?: string | null }[]) =>
    rows.length === 0 ? '<span class="empty">—</span>' : rows.map((r) => {
      const name = esc(r.name ?? r.symbol ?? '');
      const desc = r.description ? `<div style="font-size:9px;color:#666;margin-top:1px;line-height:1.3">${esc(r.description.length > 120 ? r.description.slice(0, 120) + '…' : r.description)}</div>` : '';
      return `<div class="chip">${name}${desc}</div>`;
    }).join('');

  return `
    <h2>Diagnoses &amp; Investigations</h2>
    <table>
      <thead><tr>
        <th style="width:25%">Findings</th>
        <th style="width:25%">Syndromes</th>
        <th style="width:15%">Genes</th>
        <th style="width:17%">Basic Tests</th>
        <th style="width:18%">Specific Tests</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>${td(fIn)}</td>
          <td>${sIn.map((s) => {
            const desc = s.description ? `<div style="font-size:9px;color:#666;margin-top:1px;line-height:1.3">${esc(s.description.length > 120 ? s.description.slice(0, 120) + '…' : s.description)}</div>` : '';
            return `<div class="chip">${esc(s.name)}${s.match_score_num != null ? ` <small>(${s.match_score_num}/${s.match_score_den})</small>` : ''}${desc}</div>`;
          }).join('') || '<span class="empty">—</span>'}</td>
          <td>${td(gIn)}</td>
          <td>${td(iBasic)}</td>
          <td>${td(iSpec)}</td>
        </tr>
      </tbody>
    </table>`;
}

function renderInterventions(d: ReportData): string {
  const visible = d.interventions.filter((p) => p.include_in_report);
  if (visible.length === 0 && !d.counsellingNotes.trim()) return '';
  let out = `<h2>Interventions &amp; Counselling</h2>`;
  if (visible.length) {
    out += `<table>
      <thead><tr><th>Date</th><th>Procedure</th><th>Operator</th><th>Indication</th><th>Findings</th><th>Outcome</th></tr></thead>
      <tbody>${visible.map((p) => `<tr>
        <td>${esc(p.procedure_date || '—')}</td>
        <td>${esc(p.procedure_type)}</td>
        <td>${esc(p.operator || '—')}</td>
        <td>${esc(p.indication || '—')}</td>
        <td>${esc(p.findings || '—')}</td>
        <td>${esc(p.outcome || '—')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }
  if (d.counsellingNotes.trim()) {
    out += `<h3>Counselling notes</h3><div class="rich">${richHtml(d.counsellingNotes)}</div>`;
  }
  return out;
}

function renderContent(d: ReportData): string {
  if (!d.contentBody.trim()) return '';
  return `<h2>Report Content</h2><div class="rich">${richHtml(d.contentBody)}</div>`;
}

function renderRecommendations(d: ReportData): string {
  if (!d.recommendationsBody.trim()) return '';
  return `<h2>Recommendations</h2><div class="rich">${richHtml(d.recommendationsBody)}</div>`;
}

function renderCharts(d: ReportData): string {
  const params = Object.keys(d.charts);
  if (params.length === 0) return '';
  let out = `<h2>Growth Charts</h2>`;
  for (const p of params) {
    out += `<div class="chart-block"><h3>${esc(p)}</h3>${d.charts[p]}</div>`;
  }
  return out;
}

// ── Public builder ─────────────────────────────────────────────────────────

/** Produce a full self-contained HTML document for the fetal report. */
export function buildReportHtml(d: ReportData): string {
  const inc = d.sectionInclude;
  const sections: string[] = [];

  if (inc.header   ?? true) sections.push(renderHeader(d));
  if (inc.patient  ?? true) sections.push(renderPatient(d));
  if (inc.dating   ?? true) sections.push(renderDating(d));
  if (inc.biometry ?? true) sections.push(renderBiometry(d));
  if (inc.structural ?? true) sections.push(renderStructural(d));
  if (inc.risk     ?? true) sections.push(renderRisk(d));
  if (inc.findings ?? true) sections.push(renderFindings(d));
  if (inc.intervention ?? true) sections.push(renderInterventions(d));
  if (inc.content  ?? true) sections.push(renderContent(d));
  if (inc.recommendations ?? true) sections.push(renderRecommendations(d));
  if (inc.charts   ?? true) sections.push(renderCharts(d));

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
    <div class="footer">Generated by Accurate Fetal Medicine Module · ${new Date().toLocaleDateString()}</div>
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
