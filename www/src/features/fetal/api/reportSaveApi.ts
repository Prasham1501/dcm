const BASE = '/api/fetal/save-report.php';

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export interface SaveReportInput {
  examination_id:        number;
  status:                'draft' | 'final';
  html:                  string;
  patient_id:            string;
  patient_name?:         string;
  study_date?:           string;
  modality?:             string;
  recommendations_text?: string;
}

export const reportSaveApi = {
  async save(input: SaveReportInput): Promise<{ id: number; status: 'draft' | 'final' }> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const json = await parseJson(res);
    return { id: json.id, status: json.status };
  },

  async load(examinationId: number): Promise<any | null> {
    const res = await fetch(`${BASE}?examination_id=${examinationId}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },
};
