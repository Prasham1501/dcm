/** Thin fetch wrappers for the doctor worklist endpoints. */
import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

export interface WorklistOrder {
  id: number;
  visit_id: number;
  accession_number: string;
  token_no?: string | null;
  modality: string | null;
  status: string;
  patient_name: string | null;
  mrn: string | null;
  sex: string | null;
  age_years: number | null;
  service_name: string | null;
  linked_study_uid: string | null;
  study_instance_uid: string | null;
  report_id: number | null;
  scheduled_datetime: string | null;
  room_title?: string | null;
  visit_net_amount?: string | null;
  visit_paid_amount?: string | null;
  visit_balance?: string | null;
  visit_status?: string | null;
  urgent_report?: string | number | null;
  visit_comment?: string | null;
  attention_label?: string | null;
}

export type WorklistAction = 'claim' | 'report' | 'deliver';

export interface GraphAsset {
  id: number;
  order_id: number;
  title: string | null;
  asset_type: string;
  source_path: string;
  source_mtime?: string | null;
  view_url?: string;
}

export interface GraphFetchResult {
  assets: GraphAsset[];
  discovered: Array<{ path: string; title: string; source_mtime?: string | null }>;
}

export interface MatchResult {
  matched: number;
  synced?: {
    patients_processed: number;
    studies_added: number;
    studies_updated: number;
  };
  unmatched?: Array<{
    study_instance_uid: string;
    orthanc_id: string | null;
    patient_id: string | null;
    patient_name: string | null;
    study_description: string | null;
    accession_number: string | null;
    modality: string | null;
    series_count: number | null;
    instance_count: number | null;
    updated_at: string | null;
  }>;
}

const LIST = '/api/worklist/doctor-list.php';
const TRANSITION = '/api/worklist/transition.php';
const MATCH = '/api/worklist/match-studies.php';
const GRAPH_ASSETS = '/api/results/graph-assets.php';

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiDoctorList(status?: string, modality?: string): Promise<WorklistOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (modality) params.set('modality', modality);
  const url = params.toString() ? `${LIST}?${params}` : LIST;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as WorklistOrder[]
  ), { ttlMs: 15_000 });
}

export async function apiCollectionList(): Promise<WorklistOrder[]> {
  const url = `${LIST}?collection=1`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as WorklistOrder[]
  ), { ttlMs: 15_000 });
}

export async function apiTransition(orderId: number, action: WorklistAction, reportId?: number): Promise<void> {
  const res = await fetch(TRANSITION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ order_id: orderId, action, report_id: reportId }),
  });
  await readJson(res);
  invalidateCache('GET /api/worklist/');
  invalidateCache('GET /api/reception/visits.php');
}

export async function apiRunMatch(): Promise<MatchResult> {
  const result = (await readJson(await fetch(MATCH, { method: 'POST', credentials: 'include' }))) as MatchResult;
  invalidateCache('GET /api/worklist/');
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/dashboard/');
  return result;
}

export async function apiFetchGraphAssets(orderId: number, scan = false): Promise<GraphFetchResult> {
  const params = new URLSearchParams({ order_id: String(orderId) });
  if (scan) params.set('scan', '1');
  const url = `${GRAPH_ASSETS}?${params}`;
  const load = async () => (await readJson(await fetch(url, { credentials: 'include' }))) as GraphFetchResult;
  if (scan) return await load();
  return cachedRequest(`GET ${url}`, load, { ttlMs: 5_000 });
}
