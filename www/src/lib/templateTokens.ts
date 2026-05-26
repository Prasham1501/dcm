/**
 * Template token substitution.
 *
 *  Templates can contain `{{TOKEN}}` placeholders that get replaced with
 *  live values from the active study's readings + patient context.
 *
 *  Supported tokens (case-insensitive on the key):
 *    {{patient_name}}, {{patient_id}}, {{study_date}}, {{modality}}, {{title}}
 *    {{BPD}} {{HC}} {{AC}} {{FL}} {{GA}} {{EFW}}  …  any reading key
 *    {{BPD.value}} — just the value (no unit)
 *    {{BPD.unit}}  — just the unit
 *
 *  Unknown tokens are replaced with "—" so it's visually obvious that a
 *  value is missing rather than leaving stale literals from the template.
 */

import type { Reading } from './usgExtraction/types';

export interface TokenContext {
  patientName?: string;
  patientId?:   string;
  studyDate?:   string;
  modality?:    string;
  title?:       string;
  readings?:    Reading[];
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function substituteTemplateTokens(html: string, ctx: TokenContext): string {
  if (!html || html.indexOf('{{') === -1) return html;

  // Index readings by upper-cased key for case-insensitive matching.
  const byKey = new Map<string, Reading>();
  for (const r of ctx.readings ?? []) {
    byKey.set(r.key.toUpperCase(), r);
  }

  const PATIENT: Record<string, string> = {
    PATIENT_NAME: ctx.patientName ?? '',
    PATIENT_ID:   ctx.patientId   ?? '',
    STUDY_DATE:   ctx.studyDate   ?? '',
    MODALITY:     ctx.modality    ?? '',
    TITLE:        ctx.title       ?? '',
  };

  return html.replace(TOKEN_RE, (_match, raw: string) => {
    const [keyRaw, fieldRaw] = raw.split('.');
    const key = keyRaw.toUpperCase();
    const field = (fieldRaw ?? '').toLowerCase();

    if (key in PATIENT) return escapeHtml(PATIENT[key]) || '—';

    const reading = byKey.get(key);
    if (!reading) return '—';

    if (field === 'value') return escapeHtml(String(reading.value));
    if (field === 'unit')  return escapeHtml(reading.unit ?? '');
    if (field === 'label') return escapeHtml(reading.label ?? '');

    const unit = reading.unit ? ` ${reading.unit}` : '';
    return escapeHtml(`${reading.value}${unit}`);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
