const BASE = '/api/fetal/interventions.php';

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export interface InterventionProcedure {
  id?:               number;
  examination_id?:   number;
  procedure_type:    string;
  procedure_date:    string | null;
  operator:          string | null;
  indication:        string | null;
  findings:          string | null;
  complications:     string | null;
  outcome:           string | null;
  include_in_report: number;
  created_at?:       string;
  updated_at?:       string;
}

export interface InterventionData {
  procedures:  InterventionProcedure[];
  counselling: string;
}

export const interventionsApi = {
  async load(examinationId: number): Promise<InterventionData> {
    const res = await fetch(`${BASE}?examination_id=${examinationId}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async create(examinationId: number, procedure: Partial<InterventionProcedure> & { procedure_type: string }): Promise<number> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ examination_id: examinationId, procedure }),
    });
    const json = await parseJson(res);
    return json.id;
  },

  async update(id: number, patch: Partial<InterventionProcedure>): Promise<void> {
    const res = await fetch(BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, ...patch }),
    });
    await parseJson(res);
  },

  async remove(id: number): Promise<void> {
    const res = await fetch(`${BASE}?id=${id}`, { method: 'DELETE', credentials: 'include' });
    await parseJson(res);
  },

  async saveCounselling(examinationId: number, notes: string): Promise<void> {
    const res = await fetch(`${BASE}?counselling=1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ examination_id: examinationId, notes }),
    });
    await parseJson(res);
  },
};
