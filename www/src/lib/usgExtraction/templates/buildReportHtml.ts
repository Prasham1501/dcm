import type { ReadingSet, TemplateKey, Reading } from '../types';
import {
  computeOBData, parseGAtoWeeks, formatGA, ordinal,
  percentileFlag, type OBComputedReading, type PercentileFlag,
} from '../obCalculations';
import { generateGrowthChartSVG, type GrowthChartPoint } from '../../../components/report/GrowthChart';

const SOURCE_LABELS: Record<string, string> = {
  'dicom-sr': 'DICOM SR',
  'pixel-ocr': 'OCR',
  'vision-llm': 'AI Vision',
  'manual': 'Manual',
};

// ── Flag colors for HTML (inline styles for print compatibility) ──
const FLAG_STYLES: Record<PercentileFlag, { color: string; bg: string }> = {
  'critical-low':  { color: '#dc2626', bg: '#fee2e2' },
  'low':           { color: '#d97706', bg: '#fef3c7' },
  'normal':        { color: '#16a34a', bg: '#f0fdf4' },
  'high':          { color: '#d97706', bg: '#fef3c7' },
  'critical-high': { color: '#dc2626', bg: '#fee2e2' },
};

const FLAG_SYMBOLS: Record<PercentileFlag, string> = {
  'critical-low': '↓↓', 'low': '↓', 'normal': '', 'high': '↑', 'critical-high': '↑↑',
};

function row(label: string, value: string | number, unit: string): string {
  const display = unit ? `${value} ${unit}` : `${value}`;
  return `<tr><td style="padding:3px 12px 3px 0;color:#666;min-width:200px">${label}</td><td style="padding:3px 0;font-weight:600">${display}</td></tr>`;
}

/** OB biometry row with GA estimate + percentile */
function obRow(r: OBComputedReading): string {
  const display = r.unit ? `${r.value} ${r.unit}` : `${r.value}`;
  const gaCell = r.estimatedGA ? `<td style="padding:3px 8px;color:#666;font-size:12px">${r.estimatedGA}</td>` : '<td></td>';

  let pctCell = '<td></td>';
  if (r.percentile !== null && r.percentile !== undefined) {
    const flag = r.flag || 'normal';
    const style = FLAG_STYLES[flag];
    const sym = FLAG_SYMBOLS[flag];
    pctCell = `<td style="padding:3px 8px;font-size:12px;color:${style.color};background:${style.bg};border-radius:3px;text-align:center;font-weight:600">${ordinal(r.percentile!)} ${sym}</td>`;
  }

  return `<tr>
    <td style="padding:3px 12px 3px 0;color:#666;min-width:160px">${r.label}</td>
    <td style="padding:3px 8px;font-weight:600">${display}</td>
    ${gaCell}
    ${pctCell}
  </tr>`;
}

function section(title: string, readings: Reading[]): string {
  if (readings.length === 0) return '';
  const rows = readings.map((r) => row(r.label, r.value, r.unit)).join('');
  return `
<h3 style="margin:14px 0 4px;font-size:13px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px">${title}</h3>
<table style="border-collapse:collapse;width:100%;font-size:13px">${rows}</table>`;
}

function byCategory(readings: Reading[], cat: TemplateKey) {
  return readings.filter((r) => r.category === cat);
}

/** Build structured OB report with Hadlock calculations */
function obstetricStructuredHtml(readings: Reading[], includeCharts = true): string {
  // Find machine-reported GA from readings
  const gaReading = readings.find(r => r.key === 'GA' || r.key.startsWith('GA_'));
  const machineGA = gaReading ? String(gaReading.value) : undefined;

  const obData = computeOBData(readings, machineGA);
  const obReadings = obData.readings.filter(r => r.category === 'obstetric');

  if (obReadings.length === 0) return '';

  // Separate biometry (BPD/HC/AC/FL/CRL) from other OB readings (GA/EDD/FHR/AFI/EFW)
  const biometryKeys = new Set(['BPD', 'HC', 'AC', 'FL', 'CRL', 'HL']);
  const biometry = obReadings.filter(r => biometryKeys.has(r.key.replace(/_\d+$/, '')));
  const otherOB = obReadings.filter(r => !biometryKeys.has(r.key.replace(/_\d+$/, '')));

  const parts: string[] = [];

  // ── Fetal Biometry table with GA + percentile columns ──
  if (biometry.length > 0) {
    parts.push(`<h3 style="margin:14px 0 4px;font-size:13px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px">Fetal Biometry</h3>`);
    parts.push(`<table style="border-collapse:collapse;width:100%;font-size:13px">`);
    parts.push(`<thead><tr style="border-bottom:1px solid #ccc">
      <th style="text-align:left;padding:3px 12px 3px 0;color:#999;font-weight:normal;font-size:11px">Parameter</th>
      <th style="text-align:left;padding:3px 8px;color:#999;font-weight:normal;font-size:11px">Value</th>
      <th style="text-align:left;padding:3px 8px;color:#999;font-weight:normal;font-size:11px">Est. GA</th>
      <th style="text-align:center;padding:3px 8px;color:#999;font-weight:normal;font-size:11px">Percentile</th>
    </tr></thead><tbody>`);
    parts.push(biometry.map(r => obRow(r)).join(''));
    parts.push(`</tbody></table>`);
  }

  // ── Composite GA ──
  if (obData.compositeGA) {
    const refLabel = machineGA
      ? `Machine GA: <strong>${machineGA}</strong> &nbsp;|&nbsp; Composite GA: <strong>${obData.compositeGA}</strong>`
      : `Composite GA (avg. biometry): <strong>${obData.compositeGA}</strong>`;
    parts.push(`<div style="margin:8px 0;padding:6px 10px;background:#f0f9ff;border-left:3px solid #3b82f6;font-size:12px;color:#1e40af">${refLabel}</div>`);
  }

  // ── Computed EFW (Hadlock) ──
  if (obData.computedEFW) {
    const efw = obData.computedEFW;
    let efwLine = `Estimated Fetal Weight (Hadlock): <strong>${efw.value} ${efw.unit}</strong>`;
    if (efw.percentile !== null && efw.percentile !== undefined) {
      const flag = efw.flag || 'normal';
      const style = FLAG_STYLES[flag];
      efwLine += ` &nbsp;<span style="color:${style.color};font-weight:600">(${ordinal(efw.percentile!)} percentile${FLAG_SYMBOLS[flag] ? ' ' + FLAG_SYMBOLS[flag] : ''})</span>`;
    }
    parts.push(`<div style="margin:4px 0;padding:6px 10px;background:#fefce8;border-left:3px solid #eab308;font-size:12px;color:#854d0e">${efwLine}</div>`);
  }

  // ── Machine-reported EFW (if different from computed) ──
  const machineEFW = readings.find(r => r.key === 'EFW' || r.key.startsWith('EFW_'));
  if (machineEFW && obData.computedEFW) {
    const machineVal = typeof machineEFW.value === 'number' ? machineEFW.value : parseFloat(String(machineEFW.value));
    if (!isNaN(machineVal) && Math.abs(machineVal - obData.computedEFW.value) > 50) {
      parts.push(`<div style="font-size:11px;color:#666;margin:2px 0 4px 10px">Machine EFW: ${machineEFW.value} ${machineEFW.unit}</div>`);
    }
  }

  // ── AFI ──
  if (obData.afiResult) {
    const afi = obData.afiResult;
    const isAbnormal = afi.interpretation !== 'Normal';
    const color = isAbnormal ? '#dc2626' : '#16a34a';
    parts.push(`<div style="margin:4px 0;padding:6px 10px;background:${isAbnormal ? '#fef2f2' : '#f0fdf4'};border-left:3px solid ${color};font-size:12px;color:${isAbnormal ? '#991b1b' : '#166534'}">
      AFI: <strong>${afi.value} ${afi.unit}</strong> — ${afi.interpretation} (${afi.percentile})
    </div>`);
  }

  // ── Other OB readings (GA, EDD, FHR, etc.) ──
  if (otherOB.length > 0) {
    parts.push(`<h3 style="margin:14px 0 4px;font-size:13px;color:#333;border-bottom:1px solid #ddd;padding-bottom:2px">Other Findings</h3>`);
    parts.push(`<table style="border-collapse:collapse;width:100%;font-size:13px">`);
    parts.push(otherOB.map(r => row(r.label, r.value, r.unit)).join(''));
    parts.push(`</table>`);
  }

  // ── Growth Charts (static SVG) ──
  if (includeCharts && obData.referenceGA) {
    const chartableKeys = ['BPD', 'HC', 'AC', 'FL'];
    const chartPoints: GrowthChartPoint[] = [];
    for (const r of obData.readings) {
      const base = r.key.replace(/_\d+$/, '');
      if (!chartableKeys.includes(base)) continue;
      if (chartPoints.some(p => p.key === base)) continue;
      const numVal = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
      if (isNaN(numVal)) continue;
      chartPoints.push({ key: base, value: numVal, gaWeeks: obData.referenceGA!, percentile: r.percentile });
    }
    if (obData.computedEFW && obData.computedEFW.percentile != null) {
      chartPoints.push({ key: 'EFW', value: obData.computedEFW.value, gaWeeks: obData.referenceGA!, percentile: obData.computedEFW.percentile });
    }
    const chartHtml = generateGrowthChartSVG(chartPoints);
    if (chartHtml) parts.push(chartHtml);
  }

  return parts.join('');
}

function abdominalHtml(readings: Reading[]): string {
  return section('Abdominal Findings', byCategory(readings, 'abdominal'));
}

function pelvicHtml(readings: Reading[]): string {
  return section('Pelvic Findings', byCategory(readings, 'pelvic'));
}

function smallPartsHtml(readings: Reading[]): string {
  return section('Small Parts', byCategory(readings, 'smallParts'));
}

function cardiacHtml(readings: Reading[]): string {
  return section('Cardiac Measurements', byCategory(readings, 'cardiac'));
}

function vascularHtml(readings: Reading[]): string {
  return section('Vascular Doppler', byCategory(readings, 'vascular'));
}

function genericHtml(readings: Reading[]): string {
  const generic = readings.filter((r) => r.category === 'generic' || !r.category);
  return section('Measurements', generic);
}

/** Build a full HTML fragment from a ReadingSet, ready to inject into the report contentEditable. */
export function buildReportHtml(readingSet: ReadingSet, studyDate?: string, options?: { includeCharts?: boolean }): string {
  const { readings, source, templateKey, warnings } = readingSet;
  if (readings.length === 0) return '';
  const includeCharts = options?.includeCharts ?? true;

  const sourceLabel = SOURCE_LABELS[source] ?? source;
  const dateStr = studyDate ? ` — ${studyDate}` : '';

  const parts: string[] = [
    `<div style="font-family:inherit;margin:12px 0;border:1px solid #e0e0e0;border-radius:4px;padding:10px 14px">`,
    `<div style="font-size:11px;color:#999;margin-bottom:8px">`,
    `USG Measurements${dateStr} &nbsp;·&nbsp; Source: <strong>${sourceLabel}</strong>`,
    `</div>`,
  ];

  // Render sections based on template
  switch (templateKey) {
    case 'obstetric':
      parts.push(obstetricStructuredHtml(readings, includeCharts));
      // also include any other categories found
      parts.push(abdominalHtml(readings), pelvicHtml(readings), vascularHtml(readings));
      break;
    case 'abdominal':
      parts.push(abdominalHtml(readings), pelvicHtml(readings));
      break;
    case 'pelvic':
      parts.push(pelvicHtml(readings), abdominalHtml(readings));
      break;
    case 'smallParts':
      parts.push(smallPartsHtml(readings));
      break;
    case 'cardiac':
      parts.push(cardiacHtml(readings));
      break;
    case 'vascular':
      parts.push(vascularHtml(readings), cardiacHtml(readings));
      break;
    default: {
      // generic: render all categories present; use structured OB if obstetric readings exist
      const hasOB = readings.some(r => r.category === 'obstetric');
      if (hasOB) parts.push(obstetricStructuredHtml(readings));
      else parts.push(genericHtml(readings));
      parts.push(abdominalHtml(readings), pelvicHtml(readings), smallPartsHtml(readings), cardiacHtml(readings), vascularHtml(readings));
    }
  }

  // Fallback for readings whose category didn't match the template branches
  const covered = new Set<TemplateKey>(['obstetric', 'abdominal', 'pelvic', 'smallParts', 'cardiac', 'vascular', 'generic']);
  const uncoveredReadings = readings.filter((r) => !covered.has(r.category));
  if (uncoveredReadings.length > 0) parts.push(section('Other', uncoveredReadings));

  if (warnings.length > 0) {
    // Filter out internal pipeline warnings that aren't useful to the reader
    const userWarnings = warnings.filter((w) =>
      !w.includes('No recognizable measurements found') &&
      !w.includes('No Orthanc IDs') &&
      !w.includes('Strategy') &&
      !w.includes('not available') &&
      !w.includes('Node OCR found no text')
    );
    if (userWarnings.length > 0) {
      parts.push(
        `<div style="font-size:11px;color:#b45309;margin-top:8px">${userWarnings.map((w) => `⚠ ${w}`).join('<br>')}</div>`
      );
    }
  }

  parts.push(`</div>`);
  return parts.filter(Boolean).join('');
}
