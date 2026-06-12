import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {
    const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(cleaned || `Request failed with HTTP ${res.status}`);
  }
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export type ResultStatus = 'registered' | 'pending' | 'complete' | 'authenticated' | 'printed';

export interface ResultParameter {
  id: number;
  name: string;
  unit: string | null;
  input_type: 'numeric' | 'text' | 'select';
  options: string | null;
  decimals: number;
  formula: string | null;
  is_heading: number | string;
  value: string;
  flag: '' | 'L' | 'N' | 'H';
  range_text: string;
}

export interface ResultOrder {
  id: number;
  service_id: number;
  service_name: string | null;
  lab_name: string | null;
  price: string;
  accession_number: string;
  result_status: ResultStatus;
  result_remark: string | null;
  result_advice: string | null;
  result_note: string | null;
  authenticated_at: string | null;
  report_printed_at: string | null;
  report_emailed_at: string | null;
  parameters: ResultParameter[];
}

export interface ResultVisit {
  id: number;
  visit_no: string;
  visit_datetime: string;
  patient_id: number;
  mrn: string;
  full_name: string;
  name_prefix: string | null;
  sex: string | null;
  age_years: number | null;
  doctor_name: string | null;
}

export interface ResultSheet {
  visit: ResultVisit | null;
  orders: ResultOrder[];
  nav: { prev_visit_id: number | null; next_visit_id: number | null };
}

const ENTRY = '/api/results/entry.php';

export async function apiResultSheet(params: { visitId?: number; visitNo?: string }): Promise<ResultSheet> {
  const qs = new URLSearchParams();
  if (params.visitId) qs.set('visit_id', String(params.visitId));
  if (params.visitNo) qs.set('visit_no', params.visitNo);
  const url = `${ENTRY}?${qs.toString()}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as ResultSheet
  ), { ttlMs: 15_000 });
}

export async function apiSaveResults(payload: {
  order_id: number;
  results: Array<{ parameter_id: number; value: string }>;
  remark?: string;
  advice?: string;
  note?: string;
}): Promise<ResultSheet> {
  const saved = (await readJson(await fetch(ENTRY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'save', ...payload }),
  }))) as ResultSheet;
  invalidateCache(`GET ${ENTRY}`);
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/dashboard/');
  return saved;
}

export async function apiSetResultStatus(orderId: number, status: ResultStatus): Promise<{ order_id: number; result_status: ResultStatus }> {
  const updated = await readJson(await fetch(ENTRY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'status', order_id: orderId, status }),
  }));
  invalidateCache(`GET ${ENTRY}`);
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/dashboard/');
  return updated;
}

export interface TrendPoint { visit_date: string; value: string; flag: string }

export async function apiResultTrend(patientId: number, parameterId: number): Promise<TrendPoint[]> {
  const qs = new URLSearchParams({ trend: '1', patient_id: String(patientId), parameter_id: String(parameterId) });
  const url = `${ENTRY}?${qs.toString()}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as TrendPoint[]
  ), { ttlMs: 30_000 });
}

export function reportPrintUrl(orderId: number, opts: { header?: boolean; preview?: boolean } = {}): string {
  const qs = new URLSearchParams({ order_id: String(orderId) });
  qs.set('header', opts.header === false ? '0' : '1');
  if (opts.preview) qs.set('preview', '1');
  return `/api/results/report-print.php?${qs.toString()}`;
}

// ---- Test parameter master ----

export interface RefRange {
  id?: number;
  sex: 'any' | 'male' | 'female';
  age_min_days: number;
  age_max_days: number;
  low: string | null;
  high: string | null;
  normal_text: string | null;
}

export interface TestParameter {
  id: number;
  service_id: number;
  name: string;
  unit: string | null;
  input_type: 'numeric' | 'text' | 'select';
  decimals: number;
  formula: string | null;
  default_value: string | null;
  sort_order: number;
  is_heading: number | string;
  ranges: RefRange[];
}

const PARAMS = '/api/settings/test-parameters.php';

export async function apiListParameters(serviceId: number): Promise<TestParameter[]> {
  const url = `${PARAMS}?service_id=${serviceId}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as TestParameter[]
  ), { ttlMs: 60_000 });
}

export async function apiSaveParameter(payload: Partial<TestParameter> & { service_id: number; name: string }): Promise<TestParameter> {
  const saved = (await readJson(await fetch(PARAMS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }))) as TestParameter;
  invalidateCache(`GET ${PARAMS}`);
  invalidateCache(`GET ${ENTRY}`);
  return saved;
}

export async function apiDeleteParameter(id: number): Promise<{ id: number }> {
  const deleted = await readJson(await fetch(`${PARAMS}?id=${id}`, { method: 'DELETE', credentials: 'include' }));
  invalidateCache(`GET ${PARAMS}`);
  invalidateCache(`GET ${ENTRY}`);
  return deleted;
}

// ---- Machine graphs / attachments ----

export interface ResultAsset {
  id: number;
  order_id: number;
  asset_type: 'graph' | 'image' | 'pdf' | 'other';
  title: string | null;
  view_url: string;
}

export async function apiResultGraphs(orderId: number, scan = false): Promise<{ assets: ResultAsset[]; discovered: any[] }> {
  const qs = new URLSearchParams({ order_id: String(orderId) });
  if (scan) qs.set('scan', '1');
  const url = `/api/results/graph-assets.php?${qs.toString()}`;
  const load = async () => await readJson(await fetch(url, { credentials: 'include' }));
  if (scan) return await load();
  return cachedRequest(`GET ${url}`, load, { ttlMs: 5_000 });
}

export function graphFileUrl(assetId: number): string {
  return `/api/results/graph-file.php?id=${assetId}`;
}
