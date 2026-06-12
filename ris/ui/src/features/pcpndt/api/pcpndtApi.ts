import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

export interface PcpndtOrder {
  id: number;
  visit_id: number;
  patient_id: number;
  accession_number: string;
  study_instance_uid: string;
  linked_study_uid: string | null;
  modality: string | null;
  status: string;
  scheduled_datetime: string | null;
  token_no: string | null;
  room_title: string | null;
  price: string | number | null;
  mrn: string | null;
  patient_name: string | null;
  sex: string | null;
  age_years: number | string | null;
  phone: string | null;
  service_name: string | null;
  visit_no: string | null;
  visit_datetime: string | null;
  net_amount: string | number | null;
  paid_amount: string | number | null;
  balance: string | number | null;
  referring_doctor: string | null;
  form_status: string | null;
  form_updated_at: string | null;
}

export interface FormFFields {
  ref_no?: string | null;
  clinic_name?: string | null;
  clinic_registration_no?: string | null;
  clinic_address?: string | null;
  patient_name?: string | null;
  patient_age?: string | null;
  husband_or_father_name?: string | null;
  full_address?: string | null;
  phone?: string | null;
  id_proof_type?: string | null;
  id_proof_number?: string | null;
  num_living_children?: string | null;
  children_details?: string | null;
  referring_doctor?: string | null;
  referring_doctor_address?: string | null;
  referring_doctor_reg_no?: string | null;
  lmp_date?: string | null;
  gestational_age?: string | null;
  edd?: string | null;
  family_history?: string | null;
  basis_of_diagnosis?: string | null;
  indications?: string[];
  procedure_type?: string | null;
  procedures?: string[];
  procedure_date?: string | null;
  complications?: string | null;
  result?: string | null;
  result_conveyed?: string | null;
  performing_doctor?: string | null;
  performing_doctor_qualification?: string | null;
  performing_doctor_reg_no?: string | null;
  order_id?: number;
  visit_id?: number;
  patient_id?: number;
}

export interface PcpndtPrefill {
  study_uid: string;
  fields: FormFFields;
  missing: string[];
  options: {
    indications: string[];
    procedures: string[];
    basis_of_diagnosis: string[];
  };
  saved: boolean;
  status: string;
  ris_linked: boolean;
}

async function readJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data as T;
}

export async function apiPcpndtOrders(q = ''): Promise<PcpndtOrder[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('limit', '100');
  const url = `/api/pcpndt/orders.php?${params}`;
  return cachedRequest(`GET ${url}`, async () => (
    readJson<PcpndtOrder[]>(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 20_000 });
}

export async function apiPcpndtPrefill(order: PcpndtOrder): Promise<PcpndtPrefill> {
  const params = new URLSearchParams();
  params.set('study_uid', order.linked_study_uid || order.study_instance_uid);
  params.set('patient_id', String(order.patient_id));
  if (order.patient_name) params.set('patient_name', order.patient_name);
  const url = `/api/pcpndt/prefill.php?${params}`;
  return cachedRequest(`GET ${url}`, async () => (
    readJson<PcpndtPrefill>(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 30_000 });
}

export async function apiPcpndtSave(studyUid: string, fields: FormFFields): Promise<FormFFields> {
  const saved = await readJson<FormFFields>(await fetch('/api/pcpndt/save.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ study_uid: studyUid, ...fields }),
  }));
  invalidateCache('GET /api/pcpndt/');
  return saved;
}

export async function apiPcpndtSetStatus(studyUid: string, status: string, portalAckNo?: string): Promise<FormFFields> {
  const updated = await readJson<FormFFields>(await fetch('/api/pcpndt/submit-status.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ study_uid: studyUid, status, portal_ack_no: portalAckNo || undefined }),
  }));
  invalidateCache('GET /api/pcpndt/');
  return updated;
}

export function pcpndtFormHtmlUrl(studyUid: string) {
  return `/api/pcpndt/form-html.php?study_uid=${encodeURIComponent(studyUid)}`;
}
