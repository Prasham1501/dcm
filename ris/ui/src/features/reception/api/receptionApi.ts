/** Thin fetch wrappers for the reception endpoints. */
import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

export interface Patient {
  id: number;
  mrn: string;
  dicom_patient_id: string | null;
  name_prefix: string | null;
  full_name: string;
  last_name: string | null;
  dob: string | null;
  age_years: number | null;
  sex: string | null;
  phone: string | null;
  alt_phone: string | null;
  patient_group?: string | null;
  email: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  city: string | null;
  state: string | null;
  husband_or_father_name: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  aadhaar_number: string | null;
  age_months?: number | null;
  age_days?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface NetworkInfo {
  lan_ips: string[];
  php_port: number;
  client_urls: string[];
  modality: { server_ip: string; ae_title: string; dicom_port: number; rest_port: number };
}

export interface Service {
  id: number;
  code: string;
  name: string;
  modality: string;
  body_part: string | null;
  department?: string | null;
  family?: string | null;
  lab_name?: string | null;
  sample_type?: string | null;
  tube_type?: string | null;
  tube_count?: number;
  barcode_label_count?: number;
  price: string;
  default_duration_min: number;
  is_active: number;
}

export interface ReferringDoctor {
  id: number;
  name: string;
  doctor_type?: 'gp' | 'consultant' | 'both';
  qualification?: string | null;
  phone: string | null;
  registration_no: string | null;
  clinic_name: string | null;
  commission_type: string;
  commission_value: string;
  is_active: number;
}

export interface Order {
  id: number;
  visit_id: number;
  patient_id: number;
  service_id: number | null;
  modality: string | null;
  accession_number: string;
  study_instance_uid: string | null;
  linked_study_uid?: string | null;
  room_title?: string | null;
  status: string;
  price: string;
}

export interface Visit {
  id: number;
  visit_no: string;
  patient_id: number;
  center_name?: string | null;
  consultant_doctor?: string | null;
  sample_collected_at?: string | null;
  ref_no?: string | null;
  urgent_report?: number | string | null;
  visit_comment?: string | null;
  phlebotomy_staff?: string | null;
  home_visit_area?: string | null;
  home_visit_amount?: string | null;
  home_visit_time?: string | null;
  home_visit?: number | string | null;
  dispatch_mode?: string | null;
  dispatch_note?: string | null;
  delivery_destination?: string | null;
  pro_name?: string | null;
  commission_amount?: string | null;
  regular_patient?: number | string | null;
  misc_charge?: string | null;
  print_barcode?: number | string | null;
  print_srs?: number | string | null;
  print_receipt?: number | string | null;
  print_bill_receipt?: number | string | null;
  send_to_printer?: number | string | null;
  prescription_path?: string | null;
  prescription_name?: string | null;
  net_amount: string;
  balance: string;
  status: string;
}

export interface RegisterResult {
  visit: Visit;
  orders: Order[];
}

export interface PatientHistoryVisit extends Visit {
  visit_datetime: string;
  total_amount: string;
  discount: string;
  paid_amount: string;
  refund_total?: string | number | null;
  orders: Array<Order & { service_name?: string | null }>;
  receipts: Array<{ id: number; receipt_no: string; print_url?: string; total: string; created_at?: string }>;
  payments: Array<{
    id: number;
    amount: string;
    mode: string;
    is_refund?: number | string | null;
    reference?: string | null;
    received_at?: string;
    payer_name?: string | null;
    payer_relation?: string | null;
    payer_mobile?: string | null;
    notes?: string | null;
    received_by_name?: string | null;
  }>;
}

export interface PatientHistory {
  patient: Patient;
  visits: PatientHistoryVisit[];
  duplicate_patient_ids?: number[];
}

export interface ReceptionVisitRow {
  id: number;
  visit_no: string;
  visit_datetime: string;
  center_name: string | null;
  total_amount: string;
  misc_charge: string | null;
  discount: string;
  net_amount: string;
  paid_amount: string;
  balance: string;
  status: string;
  consultant_doctor: string | null;
  ref_no: string | null;
  urgent_report: number | string | null;
  visit_comment: string | null;
  dispatch_mode: string | null;
  dispatch_note: string | null;
  delivery_destination: string | null;
  print_barcode: number | string | null;
  print_srs: number | string | null;
  print_receipt: number | string | null;
  print_bill_receipt: number | string | null;
  send_to_printer: number | string | null;
  phlebotomy_staff?: string | null;
  home_visit_area?: string | null;
  home_visit_amount?: string | number | null;
  home_visit_time?: string | null;
  home_visit?: number | string | null;
  prescription_path?: string | null;
  prescription_name?: string | null;
  refund_total: string | number | null;
  report_emailed_at: string | null;
  report_printed_at: string | null;
  order_count: number | string | null;
  results_ready_count: number | string | null;
  patient_id: number;
  mrn: string;
  full_name: string;
  phone: string | null;
  age_years: number | null;
  sex: string | null;
  patient_group: string | null;
  doctor_name: string | null;
  user_name: string | null;
  test_names: string | null;
  departments: string | null;
  groups: string | null;
}

export interface VisitTotals {
  records: number | string;
  total: number | string;
  others: number | string;
  discount: number | string;
  net: number | string;
  paid: number | string;
  balance: number | string;
  refund: number | string;
}

export interface ReceptionVisitsResult {
  rows: ReceptionVisitRow[];
  totals: VisitTotals;
  page?: number;
  page_size?: number;
}

const PATIENTS = '/api/reception/patients.php';
const NETWORK = '/api/system/network-info.php';
const SERVICES = '/api/reception/services.php';
const REFDOCS = '/api/reception/referring-doctors.php';
const REGISTER = '/api/reception/register.php';
const VISITS = '/api/reception/visits.php';
const DISPATCH = '/api/reception/dispatch.php';
const UPDATE_VISIT = '/api/reception/update-visit.php';
const MATCH_REPORTS = '/api/worklist/match-studies.php';
const GENERATE_WORKLIST = '/api/worklist/generate.php';
const UPDATE_ACCESSION = '/api/worklist/update-accession.php';
const UPDATE_DESTINATION = '/api/worklist/update-destination.php';
const UPLOAD_PRESCRIPTION = '/api/reception/upload-prescription.php';

/** Authenticated URL to view/download a visit's prescription attachment. */
export const prescriptionDownloadUrl = (visitId: number) =>
  `/api/reception/download-prescription.php?visit_id=${visitId}`;

/** Upload a prescription file (image/PDF) for a just-created visit. */
export async function apiUploadPrescription(visitId: number, file: File): Promise<{ visit_id: number; prescription_name: string }> {
  const form = new FormData();
  form.append('visit_id', String(visitId));
  form.append('prescription', file);
  // No Content-Type header — the browser sets the multipart boundary.
  const res = await fetch(UPLOAD_PRESCRIPTION, { method: 'POST', credentials: 'include', body: form });
  const data = (await readJson(res)) as { visit_id: number; prescription_name: string };
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/reception/patients.php?action=history');
  return data;
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    const cleaned = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    throw new Error(cleaned || `Request failed with HTTP ${res.status}`);
  }
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiSearchPatients(query: string, limit = 20): Promise<Patient[]> {
  const url = `${PATIENTS}?action=search&q=${encodeURIComponent(query)}&limit=${limit}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as Patient[]
  ), { ttlMs: 30_000 });
}

export async function apiUnvisitedPatients(query = '', limit = 50): Promise<Patient[]> {
  const url = `${PATIENTS}?action=unvisited&q=${encodeURIComponent(query)}&limit=${limit}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as Patient[]
  ), { ttlMs: 30_000 });
}

export async function apiPatientHistory(patientId: number): Promise<PatientHistory> {
  const url = `${PATIENTS}?action=history&id=${patientId}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as PatientHistory
  ), { ttlMs: 30_000 });
}

export async function apiReceptionVisits(filters: Record<string, string | boolean | number>): Promise<ReceptionVisitsResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== false) params.set(key, String(value));
  }
  const url = `${VISITS}?${params.toString()}`;
  const data = await cachedRequest(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 20_000 });
  // Back-compat: older response shape was a bare array.
  if (Array.isArray(data)) {
    return { rows: data as ReceptionVisitRow[], totals: { records: data.length, total: 0, others: 0, discount: 0, net: 0, paid: 0, balance: 0, refund: 0 } };
  }
  return data as ReceptionVisitsResult;
}

export async function apiUpdateDispatch(payload: {
  visit_id: number;
  dispatch_mode?: string;
  delivery_destination?: string;
  dispatch_note?: string;
}): Promise<Visit> {
  const res = await fetch(DISPATCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const visit = (await readJson(res)) as Visit;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/reception/patients.php?action=history');
  invalidateCache('GET /api/dashboard/');
  return visit;
}

export async function apiUpdateVisitDetails(payload: Record<string, unknown>): Promise<Visit> {
  const res = await fetch(UPDATE_VISIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const visit = (await readJson(res)) as Visit;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/reception/patients.php?action=history');
  invalidateCache('GET /api/dashboard/');
  return visit;
}

/** Targeted single/few-field patch (Others, Discount, Change Center, Invalidate). */
export async function apiQuickUpdateVisit(payload: { visit_id: number } & Record<string, unknown>): Promise<Visit> {
  const res = await fetch('/api/reception/quick-update.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const visit = (await readJson(res)) as Visit;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/reception/patients.php?action=history');
  invalidateCache('GET /api/dashboard/');
  return visit;
}

export async function apiSyncReturnedReports(): Promise<{
  matched: number;
  orders: Array<{ order_id: number; accession_number?: string | null; study_uid: string }>;
  synced?: { studies_added?: number; studies_updated?: number };
  unmatched?: unknown[];
}> {
  const result = (await readJson(await fetch(MATCH_REPORTS, { credentials: 'include' }))) as {
    matched: number;
    orders: Array<{ order_id: number; accession_number?: string | null; study_uid: string }>;
    synced?: { studies_added?: number; studies_updated?: number };
    unmatched?: unknown[];
  };
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/worklist/');
  invalidateCache('GET /api/dashboard/');
  return result;
}

export async function apiCreatePatient(payload: Record<string, unknown>): Promise<Patient> {
  const res = await fetch(PATIENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const patient = (await readJson(res)) as Patient;
  invalidateCache('GET /api/reception/patients.php');
  return patient;
}

export async function apiUpdatePatient(payload: Record<string, unknown> & { id: number }): Promise<Patient> {
  const res = await fetch(PATIENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'update', ...payload }),
  });
  const patient = (await readJson(res)) as Patient;
  invalidateCache('GET /api/reception/patients.php');
  invalidateCache('GET /api/reception/visits.php');
  return patient;
}

export async function apiGetNetworkInfo(): Promise<NetworkInfo> {
  return cachedRequest(`GET ${NETWORK}`, async () => (
    (await readJson(await fetch(NETWORK, { credentials: 'include' }))) as NetworkInfo
  ), { ttlMs: 5 * 60_000 });
}

export async function apiListServices(): Promise<Service[]> {
  const url = `${SERVICES}?active=1`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as Service[]
  ), { ttlMs: 60_000 });
}

export async function apiListReferringDoctors(query = ''): Promise<ReferringDoctor[]> {
  const url = query ? `${REFDOCS}?q=${encodeURIComponent(query)}` : REFDOCS;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as ReferringDoctor[]
  ), { ttlMs: 60_000 });
}

export async function apiCreateReferringDoctor(payload: Record<string, unknown>): Promise<ReferringDoctor> {
  const res = await fetch(REFDOCS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const doctor = (await readJson(res)) as ReferringDoctor;
  invalidateCache(`GET ${REFDOCS}`);
  invalidateCache('GET /api/settings/masters.php');
  return doctor;
}

export async function apiRegisterVisit(payload: object): Promise<RegisterResult> {
  const res = await fetch(REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const result = (await readJson(res)) as RegisterResult;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/reception/patients.php');
  invalidateCache('GET /api/worklist/');
  invalidateCache('GET /api/dashboard/');
  return result;
}

export async function apiGenerateWorklist(orderId?: number): Promise<{ generated: number }> {
  const result = (await readJson(await fetch(GENERATE_WORKLIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(orderId ? { order_id: orderId } : {}),
  }))) as { generated: number };
  invalidateCache('GET /api/worklist/');
  return result;
}

export async function apiUpdateAccession(orderId: number, accessionNumber: string): Promise<Order> {
  const res = await fetch(UPDATE_ACCESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ order_id: orderId, accession_number: accessionNumber }),
  });
  const order = (await readJson(res)) as Order;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/worklist/');
  return order;
}

export async function apiUpdateOrderDestination(orderId: number, nodeId: number): Promise<Order> {
  const res = await fetch(UPDATE_DESTINATION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ order_id: orderId, node_id: nodeId }),
  });
  const order = (await readJson(res)) as Order;
  invalidateCache('GET /api/reception/visits.php');
  invalidateCache('GET /api/worklist/');
  return order;
}
