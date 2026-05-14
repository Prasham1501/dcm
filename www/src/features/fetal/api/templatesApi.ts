const BASE = '/api/fetal/templates.php';

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export interface TemplateSummary {
  id:            number;
  template_key:  string;
  template_name: string;
  exam_type:     string | null;
}

export interface TemplateDetail extends TemplateSummary {
  body: string;
}

export const templatesApi = {
  async list(examType?: string): Promise<TemplateSummary[]> {
    const qs = examType ? `?exam_type=${encodeURIComponent(examType)}` : '';
    const res = await fetch(`${BASE}${qs}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async get(id: number): Promise<TemplateDetail> {
    const res = await fetch(`${BASE}?id=${id}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async save(input: { template_key: string; template_name: string; exam_type?: string; body: string }): Promise<number> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const json = await parseJson(res);
    return json.id;
  },
};
