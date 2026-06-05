/** Thin fetch wrappers for the reception endpoints. */

export interface Patient {
  id: number;
  mrn: string;
  dicom_patient_id: string | null;
  full_name: string;
  dob: string | null;
  age_years: number | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  husband_or_father_name: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
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
  price: string;
  default_duration_min: number;
  is_active: number;
}

export interface ReferringDoctor {
  id: number;
  name: string;
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
  status: string;
  price: string;
}

export interface Visit {
  id: number;
  visit_no: string;
  patient_id: number;
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
  orders: Array<Order & { service_name?: string | null }>;
  receipts: Array<{ id: number; receipt_no: string; print_url?: string; total: string; created_at?: string }>;
  payments: Array<{ id: number; amount: string; mode: string; reference?: string | null; received_at?: string }>;
}

export interface PatientHistory {
  patient: Patient;
  visits: PatientHistoryVisit[];
}

const PATIENTS = '/api/reception/patients.php';
const NETWORK = '/api/system/network-info.php';
const SERVICES = '/api/reception/services.php';
const REFDOCS = '/api/reception/referring-doctors.php';
const REGISTER = '/api/reception/register.php';
const GENERATE_WORKLIST = '/api/worklist/generate.php';
const UPDATE_ACCESSION = '/api/worklist/update-accession.php';

async function readJson(res: Response): Promise<any> {
  const json = await res.json();
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data;
}

export async function apiSearchPatients(query: string, limit = 20): Promise<Patient[]> {
  const url = `${PATIENTS}?action=search&q=${encodeURIComponent(query)}&limit=${limit}`;
  return (await readJson(await fetch(url, { credentials: 'include' }))) as Patient[];
}

export async function apiPatientHistory(patientId: number): Promise<PatientHistory> {
  const url = `${PATIENTS}?action=history&id=${patientId}`;
  return (await readJson(await fetch(url, { credentials: 'include' }))) as PatientHistory;
}

export async function apiCreatePatient(payload: Record<string, unknown>): Promise<Patient> {
  const res = await fetch(PATIENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return (await readJson(res)) as Patient;
}

export async function apiGetNetworkInfo(): Promise<NetworkInfo> {
  return (await readJson(await fetch(NETWORK, { credentials: 'include' }))) as NetworkInfo;
}

export async function apiListServices(): Promise<Service[]> {
  return (await readJson(await fetch(`${SERVICES}?active=1`, { credentials: 'include' }))) as Service[];
}

export async function apiListReferringDoctors(query = ''): Promise<ReferringDoctor[]> {
  const url = query ? `${REFDOCS}?q=${encodeURIComponent(query)}` : REFDOCS;
  return (await readJson(await fetch(url, { credentials: 'include' }))) as ReferringDoctor[];
}

export async function apiCreateReferringDoctor(payload: Record<string, unknown>): Promise<ReferringDoctor> {
  const res = await fetch(REFDOCS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return (await readJson(res)) as ReferringDoctor;
}

export async function apiRegisterVisit(payload: object): Promise<RegisterResult> {
  const res = await fetch(REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return (await readJson(res)) as RegisterResult;
}

export async function apiGenerateWorklist(): Promise<{ generated: number }> {
  return (await readJson(await fetch(GENERATE_WORKLIST, { method: 'POST', credentials: 'include' }))) as { generated: number };
}

export async function apiUpdateAccession(orderId: number, accessionNumber: string): Promise<Order> {
  const res = await fetch(UPDATE_ACCESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ order_id: orderId, accession_number: accessionNumber }),
  });
  return (await readJson(res)) as Order;
}
