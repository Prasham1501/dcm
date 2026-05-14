/**
 * Persistence client for the three risk calculators.
 * Inputs & results are stored as opaque JSON blobs — the calculator
 * modal owns the schema, the server only stores and returns them.
 */

const BASE = '/api/fetal/risk-results.php';

export type CalculatorId = 'aneuploidy' | 'preeclampsia' | 'preterm';

export interface RiskResultRow<I = unknown, R = unknown> {
  calculator:        CalculatorId;
  inputs:            I | null;
  results:           R | null;
  include_in_report: number;
  computed_at:       string;
}

async function parseJson(res: Response) {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    throw new Error(`Non-JSON response (status ${res.status}): ${text.slice(0, 120)}`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export const riskApi = {
  async loadAll(examinationId: number): Promise<RiskResultRow[]> {
    const res = await fetch(`${BASE}?examination_id=${examinationId}`, { credentials: 'include' });
    const json = await parseJson(res);
    return json.data;
  },

  async save<I, R>(examinationId: number, calculator: CalculatorId, inputs: I, results: R, includeInReport = true): Promise<void> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        examination_id: examinationId,
        calculator,
        inputs,
        results,
        include_in_report: includeInReport ? 1 : 0,
      }),
    });
    await parseJson(res);
  },

  async remove(examinationId: number, calculator: CalculatorId): Promise<void> {
    const qs = new URLSearchParams({ examination_id: String(examinationId), calculator });
    const res = await fetch(`${BASE}?${qs.toString()}`, { method: 'DELETE', credentials: 'include' });
    await parseJson(res);
  },
};
