import type { ReadingSet, TemplateKey, Reading } from '../types';

const SOURCE_LABELS: Record<string, string> = {
  'dicom-sr': 'DICOM SR',
  'pixel-ocr': 'OCR',
  'vision-llm': 'AI Vision',
  'manual': 'Manual',
};

function row(label: string, value: string | number, unit: string): string {
  const display = unit ? `${value} ${unit}` : `${value}`;
  return `<tr><td style="padding:3px 12px 3px 0;color:#666;min-width:200px">${label}</td><td style="padding:3px 0;font-weight:600">${display}</td></tr>`;
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

function obstetricHtml(readings: Reading[]): string {
  const obs = readings.filter((r) => r.category === 'obstetric');
  if (obs.length === 0) return '';
  return section('Fetal Biometry', obs);
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
export function buildReportHtml(readingSet: ReadingSet, studyDate?: string): string {
  const { readings, source, templateKey, warnings } = readingSet;
  if (readings.length === 0) return '';

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
      parts.push(obstetricHtml(readings));
      // also include any other categories found
      parts.push(abdominalHtml(readings), pelvicHtml(readings));
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
      // generic: render all categories present
      const all = [obstetricHtml, abdominalHtml, pelvicHtml, smallPartsHtml, cardiacHtml, vascularHtml, genericHtml];
      all.forEach((fn) => parts.push(fn(readings)));
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
