/**
 * Client for the examination DST (selections) API.
 * DST = "Decision Support Tree" — the per-examination selections of
 * findings, syndromes, genes, and investigations.
 */

const BASE = '/api/fetal/examination-dst.php';

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}

export type DstKind = 'finding' | 'syndrome' | 'gene' | 'investigation';

export interface ExamFinding       { id: number; name: string; system: string | null; description: string | null; include_in_report: number; }
export interface ExamSyndrome      { id: number; name: string; omim_id: string | null; description: string | null;
                                     match_score_num: number | null; match_score_den: number | null;
                                     include_in_report: number; }
export interface ExamGene          { id: number; symbol: string; full_name: string | null; description: string | null; include_in_report: number; }
export interface ExamInvestigation { id: number; name: string; description: string | null; catalog_category: string;
                                     category: 'basic' | 'specific'; include_in_report: number; }

export interface DstBundle {
  findings:       ExamFinding[];
  syndromes:      ExamSyndrome[];
  genes:          ExamGene[];
  investigations: ExamInvestigation[];
}

export const dstApi = {
  async load(examinationId: number): Promise<DstBundle> {
    const res = await fetch(`${BASE}?examination_id=${examinationId}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data as DstBundle;
  },

  async add(examinationId: number, kind: DstKind, id: number, opts?: {
    include_in_report?: 0 | 1;
    category?: 'basic' | 'specific';
    match_score_num?: number;
    match_score_den?: number;
  }): Promise<void> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ examination_id: examinationId, kind, id, ...opts }),
    });
    await parseJson(res);
  },

  async toggleInclude(examinationId: number, kind: DstKind, id: number, include: boolean): Promise<void> {
    const res = await fetch(BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ examination_id: examinationId, kind, id, include_in_report: include ? 1 : 0 }),
    });
    await parseJson(res);
  },

  async remove(examinationId: number, kind: DstKind, id: number): Promise<void> {
    const qs = new URLSearchParams({
      examination_id: String(examinationId), kind, id: String(id),
    });
    const res = await fetch(`${BASE}?${qs.toString()}`, { method: 'DELETE', credentials: 'include' });
    await parseJson(res);
  },
};
