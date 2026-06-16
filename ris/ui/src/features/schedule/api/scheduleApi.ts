/** Fetch wrapper for the home-visit schedule agenda. */
import { cachedRequest } from '../../../lib/risDataCache';

export interface ScheduleRow {
  id: number;
  visit_no: string;
  visit_datetime: string | null;
  status: string;
  balance: string | number;
  net_amount: string | number;
  paid_amount: string | number;
  home_visit_area: string | null;
  home_visit_time: string | null;
  home_visit_amount: string | number | null;
  sample_collected_at: string | null;
  phlebotomy_staff: string | null;
  visit_comment: string | null;
  urgent_report: number | string | null;
  patient_id: number;
  mrn: string | null;
  full_name: string | null;
  phone: string | null;
  age_years: number | null;
  sex: string | null;
  address: string;
  doctor_name: string | null;
  test_names: string | null;
  order_count: number | string;
}

const ENDPOINT = '/api/schedule/agenda.php';

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiScheduleAgenda(from: string, to: string): Promise<ScheduleRow[]> {
  const url = `${ENDPOINT}?from=${from}&to=${to}`;
  return cachedRequest(`GET ${url}`, async () => (
    ((await readJson(await fetch(url, { credentials: 'include' }))).rows as ScheduleRow[]) || []
  ), { ttlMs: 15_000 });
}
