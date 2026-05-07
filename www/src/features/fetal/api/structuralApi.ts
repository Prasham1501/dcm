import type { StructuralStatus } from '@/features/fetal/lib/anatomySchema';

export interface StructuralRow {
  system: string;
  anatomyKey: string;
  status: StructuralStatus;
  comments: string | null;
}

const BASE = '/api/fetal/structural.php';

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

export const structuralApi = {
  async load(examinationId: number): Promise<StructuralRow[]> {
    const res = await fetch(`${BASE}?examination_id=${examinationId}`, {
      credentials: 'include',
    });
    const json = await parseJson(res);
    return (json.data ?? []) as StructuralRow[];
  },

  async save(examinationId: number, rows: StructuralRow[]): Promise<void> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ examination_id: examinationId, rows }),
    });
    await parseJson(res);
  },
};
