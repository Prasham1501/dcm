/** Thin fetch wrappers for the commission endpoints. */

import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

export interface CommissionReportRow {
  referring_doctor_id: number;
  name: string | null;
  total: string;
  entries: number;
}
export interface CommissionEntry {
  id: number;
  order_id: number;
  commission_amount: string;
  base_amount: string;
  rate_type: string;
  rate_value: string;
  status: string;
  period_ym: string | null;
}
export interface Statement { entries: CommissionEntry[]; total: number; }
export interface Payout {
  id: number;
  referring_doctor_id: number;
  total_amount: string;
  status: string;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

const REPORT = '/api/commission/report.php';
const STATEMENT = '/api/commission/statement.php';
const PAYOUTS = '/api/commission/payouts.php';
const SETTINGS = '/api/commission/settings.php';

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}
function post(url: string, body: object) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
}

export async function apiCommissionReport(from?: string, to?: string): Promise<{ from: string; to: string; rows: CommissionReportRow[] }> {
  const p = new URLSearchParams();
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  const url = p.toString() ? `${REPORT}?${p}` : REPORT;
  return cachedRequest(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 30_000 });
}
export async function apiCommissionStatement(doctorId: number, period?: string): Promise<Statement> {
  const p = new URLSearchParams({ doctor_id: String(doctorId) });
  if (period) p.set('period', period);
  const url = `${STATEMENT}?${p}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as Statement
  ), { ttlMs: 30_000 });
}
export async function apiCreatePayout(doctorId: number, from: string, to: string): Promise<Payout> {
  const payout = (await readJson(await post(PAYOUTS, { action: 'create', doctor_id: doctorId, from, to }))) as Payout;
  invalidateCache('GET /api/commission/');
  return payout;
}
export async function apiPayPayout(payoutId: number): Promise<Payout> {
  const payout = (await readJson(await post(PAYOUTS, { action: 'pay', payout_id: payoutId }))) as Payout;
  invalidateCache('GET /api/commission/');
  return payout;
}
export async function apiGetCommissionEnabled(): Promise<boolean> {
  return cachedRequest(`GET ${SETTINGS}`, async () => (
    (await readJson(await fetch(SETTINGS, { credentials: 'include' }))).enabled
  ), { ttlMs: 60_000 });
}
export async function apiSetCommissionEnabled(enabled: boolean): Promise<boolean> {
  const next = (await readJson(await post(SETTINGS, { enabled }))).enabled;
  invalidateCache('GET /api/commission/');
  return next;
}
