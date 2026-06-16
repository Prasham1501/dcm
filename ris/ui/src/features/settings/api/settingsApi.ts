import type { NetworkInfo } from '@/features/reception/api/receptionApi';
import type { Service } from '@/features/reception/api/receptionApi';
import { cachedRequest, invalidateCache } from '../../../lib/risDataCache';

export interface DicomNode {
  id: number;
  name: string;
  ae_title: string;
  host_name: string;
  port: number;
  is_default?: number;
}

export interface SendStudyResult {
  message: string;
  node: string;
  orthanc_id: string;
  details?: unknown;
}

export interface BrandingSettings {
  brand_name: string;
  brand_tagline: string;
  brand_phone: string;
  brand_email: string;
  brand_address: string;
  brand_website: string;
  brand_logo_image: string;
  receipt_header: string;
  receipt_footer: string;
  gst_number: string;
  default_tax_percentage: string;
  receipt_paper_size: string;
  receipt_signature_label: string;
  receipt_signature_image: string;
  receipt_stamp_image: string;
}

export interface CounterSettings {
  mrn?: { prefix: string; current_value: number; next_number: number };
  visit?: { prefix: string; current_value: number; next_number: number };
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(cleaned ? `Server returned HTML instead of JSON: ${cleaned.slice(0, 160)}` : 'Server returned an invalid JSON response');
  }
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || 'Request failed');
  }
  return json.data ?? json;
}

export async function apiNetworkInfo(): Promise<NetworkInfo> {
  const url = '/api/system/network-info.php';
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as NetworkInfo
  ), { ttlMs: 5 * 60_000 });
}

export async function apiDicomNodes(): Promise<DicomNode[]> {
  const url = '/api/system/nodes.php';
  const json = await cachedRequest<any>(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 60_000 });
  return (json.nodes ?? json.data?.nodes ?? []) as DicomNode[];
}

export async function apiSaveDicomNode(node: Partial<DicomNode>): Promise<{ id: number }> {
  const result = await readJson(await fetch('/api/system/nodes.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(node),
  }));
  invalidateCache('GET /api/system/nodes.php');
  return result;
}

export async function apiDeleteDicomNode(id: number): Promise<{ deleted: number }> {
  const result = await readJson(await fetch(`/api/system/nodes.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
  invalidateCache('GET /api/system/nodes.php');
  return result;
}

export async function apiEchoNode(node: DicomNode): Promise<{ time?: number }> {
  return await readJson(await fetch('/api/system/echo-node.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: node.name,
      ae_title: node.ae_title,
      host_name: node.host_name,
      port: Number(node.port),
    }),
  }));
}

export async function apiSendStudy(nodeId: number, studyUidOrOrthancId: string): Promise<SendStudyResult> {
  return await readJson(await fetch('/api/system/send-study.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ node_id: nodeId, study: studyUidOrOrthancId }),
  }));
}

export async function apiBranding(): Promise<BrandingSettings> {
  const url = '/api/settings/branding.php';
  return cachedRequest(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 60_000 });
}

export async function apiSaveBranding(settings: BrandingSettings): Promise<BrandingSettings> {
  const saved = await readJson(await fetch('/api/settings/branding.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings),
  }));
  invalidateCache('GET /api/settings/branding.php');
  return saved;
}

export async function apiCounters(): Promise<CounterSettings> {
  const url = '/api/system/counters.php';
  return cachedRequest(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 60_000 });
}

export async function apiSaveCounters(payload: {
  patient_prefix?: string;
  patient_start?: number | string;
  visit_prefix?: string;
  visit_start?: number | string;
}): Promise<CounterSettings> {
  const saved = await readJson(await fetch('/api/system/counters.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
  invalidateCache('GET /api/system/counters.php');
  return saved;
}

export interface IntegrationInfo { api_key: string; endpoint: string }

export async function apiIntegration(): Promise<IntegrationInfo> {
  const url = '/api/settings/integration.php';
  return cachedRequest(`GET ${url}`, async () => (
    await readJson(await fetch(url, { credentials: 'include' }))
  ), { ttlMs: 60_000 });
}

export async function apiRegenerateIntegrationKey(): Promise<{ api_key: string }> {
  const result = await readJson(await fetch('/api/settings/integration.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'regenerate' }),
  }));
  invalidateCache('GET /api/settings/integration.php');
  return result;
}

export async function apiResetRisData(confirm: string): Promise<{
  cleared: string[];
  counters_reset: string[];
  settings_removed?: number;
  worklist_files_removed?: number;
  asset_files_removed?: number;
  orthanc_patients_deleted?: number;
}> {
  const result = await readJson(await fetch('/api/system/reset-ris.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ confirm }),
  }));
  invalidateCache();
  return result;
}

export async function apiListAllServices(): Promise<Service[]> {
  const url = '/api/reception/services.php?active=0';
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as Service[]
  ), { ttlMs: 60_000 });
}

export async function apiSaveService(service: Partial<Service>): Promise<Service> {
  const saved = await readJson(await fetch('/api/reception/services.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(service),
  }));
  invalidateCache('GET /api/reception/services.php');
  invalidateCache('GET /api/reception/visits.php');
  return saved;
}

export async function apiDeleteService(id: number): Promise<{ deleted: number }> {
  const result = await readJson(await fetch(`/api/reception/services.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
  invalidateCache('GET /api/reception/services.php');
  invalidateCache('GET /api/reception/visits.php');
  return result;
}

export type ImportType =
  | 'patients' | 'referring_doctors' | 'consultants' | 'centers' | 'pros'
  | 'staff' | 'areas' | 'patient_groups' | 'dispatch_modes' | 'services' | 'test_parameters';

export async function apiImportCsv(type: ImportType, file: File): Promise<{ created: number; skipped: number; errors: string[] }> {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  const result = await readJson(await fetch('/api/reception/import-csv.php', {
    method: 'POST',
    credentials: 'include',
    body: form,
  }));
  invalidateCache();
  return result;
}

// ---------- Master data (centers / PROs / lookups) ----------

export interface Center {
  id: number;
  code: string;
  name: string;
  billing_type: 'credit' | 'debit';
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  discount_percent: string | number;
  is_active: number;
}

export interface Pro {
  id: number;
  name: string;
  phone: string | null;
  commission_type: 'none' | 'percent' | 'flat';
  commission_value: string | number;
  is_active: number;
}

export interface Lookup {
  id: number;
  category: string;
  value: string;
  sort_order: number;
  is_active: number;
}

export interface Staff {
  id: number;
  user_id: number | null;
  staff_code: string | null;
  full_name: string;
  value?: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  username: string | null;
  user_role: 'admin' | 'doctor' | 'receptionist' | 'viewer';
  can_login: number;
  is_active: number;
  login_active?: number;
}

export type MasterEntity = 'centers' | 'pros' | 'staff' | 'lookups';

export async function apiMasters<T = any>(entity: MasterEntity, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({ entity, ...params });
  const url = `/api/settings/masters.php?${qs.toString()}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as T[]
  ), { ttlMs: 60_000 });
}

export async function apiSaveMaster(entity: MasterEntity, payload: Record<string, unknown>): Promise<any> {
  const result = await readJson(await fetch('/api/settings/masters.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ entity, ...payload }),
  }));
  invalidateCache('GET /api/settings/masters.php');
  invalidateCache('GET /api/reception/visits.php');
  return result;
}

export async function apiDeleteMaster(entity: MasterEntity, id: number): Promise<{ id: number }> {
  const result = await readJson(await fetch(`/api/settings/masters.php?entity=${entity}&id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
  invalidateCache('GET /api/settings/masters.php');
  invalidateCache('GET /api/reception/visits.php');
  return result;
}

// ---------- Referring doctors / consultants ----------

export interface RisDoctor {
  id: number;
  name: string;
  doctor_type: 'gp' | 'consultant' | 'both';
  qualification: string | null;
  registration_no: string | null;
  phone: string | null;
  email: string | null;
  clinic_name: string | null;
  commission_type?: string;
  commission_value?: string | number;
  is_active: number;
}

export async function apiListDoctors(type?: 'gp' | 'consultant'): Promise<RisDoctor[]> {
  const qs = type ? `?type=${type}` : '';
  const url = `/api/reception/referring-doctors.php${qs}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as RisDoctor[]
  ), { ttlMs: 60_000 });
}

export async function apiSaveDoctor(payload: Partial<RisDoctor>): Promise<RisDoctor> {
  const saved = await readJson(await fetch('/api/reception/referring-doctors.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
  invalidateCache('GET /api/reception/referring-doctors.php');
  invalidateCache('GET /api/reception/visits.php');
  return saved;
}

export async function apiDeleteDoctor(id: number): Promise<{ id: number }> {
  const result = await readJson(await fetch(`/api/reception/referring-doctors.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
  invalidateCache('GET /api/reception/referring-doctors.php');
  invalidateCache('GET /api/reception/visits.php');
  return result;
}

// ---------- Patient master ----------

export interface PatientMaster {
  id: number;
  mrn: string;
  name_prefix: string | null;
  full_name: string;
  last_name: string | null;
  dob: string | null;
  age_years: number | null;
  age_months: number | null;
  age_days: number | null;
  sex: string | null;
  phone: string | null;
  alt_phone: string | null;
  patient_group: string | null;
  email: string | null;
  husband_or_father_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  aadhaar_number: string | null;
}

export async function apiListPatients(q = '', limit = 100): Promise<PatientMaster[]> {
  const qs = new URLSearchParams({ action: 'search', q, limit: String(limit) });
  const url = `/api/reception/patients.php?${qs.toString()}`;
  return cachedRequest(`GET ${url}`, async () => (
    (await readJson(await fetch(url, { credentials: 'include' }))) as PatientMaster[]
  ), { ttlMs: 30_000 });
}

export async function apiSavePatientMaster(payload: Partial<PatientMaster> & { action: 'create' | 'update' }): Promise<PatientMaster> {
  const saved = await readJson(await fetch('/api/reception/patients.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
  invalidateCache('GET /api/reception/patients.php');
  invalidateCache('GET /api/reception/visits.php');
  return saved;
}
