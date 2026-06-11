import type { NetworkInfo } from '@/features/reception/api/receptionApi';
import type { Service } from '@/features/reception/api/receptionApi';

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
  accession?: { prefix: string; current_value: number; next_number: number };
  token?: { prefix: string; current_value: number; next_number: number };
}

export interface AnalyzerGraphSettings {
  analyzer_graph_source_dirs: string;
  analyzer_graph_extensions: string;
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
  return (await readJson(await fetch('/api/system/network-info.php', { credentials: 'include' }))) as NetworkInfo;
}

export async function apiDicomNodes(): Promise<DicomNode[]> {
  const json = await readJson(await fetch('/api/system/nodes.php', { credentials: 'include' }));
  return (json.nodes ?? json.data?.nodes ?? []) as DicomNode[];
}

export async function apiSaveDicomNode(node: Partial<DicomNode>): Promise<{ id: number }> {
  return await readJson(await fetch('/api/system/nodes.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(node),
  }));
}

export async function apiDeleteDicomNode(id: number): Promise<{ deleted: number }> {
  return await readJson(await fetch(`/api/system/nodes.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
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
  return await readJson(await fetch('/api/settings/branding.php', { credentials: 'include' }));
}

export async function apiSaveBranding(settings: BrandingSettings): Promise<BrandingSettings> {
  return await readJson(await fetch('/api/settings/branding.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings),
  }));
}

export async function apiAnalyzerGraphs(): Promise<AnalyzerGraphSettings> {
  return await readJson(await fetch('/api/settings/analyzer-graphs.php', { credentials: 'include' }));
}

export async function apiSaveAnalyzerGraphs(settings: AnalyzerGraphSettings): Promise<AnalyzerGraphSettings> {
  return await readJson(await fetch('/api/settings/analyzer-graphs.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings),
  }));
}

export async function apiCounters(): Promise<CounterSettings> {
  return await readJson(await fetch('/api/system/counters.php', { credentials: 'include' }));
}

export async function apiSaveCounters(payload: {
  accession_prefix?: string;
  accession_start?: number | string;
  token_prefix?: string;
  token_start?: number | string;
}): Promise<CounterSettings> {
  return await readJson(await fetch('/api/system/counters.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
}

export interface IntegrationInfo { api_key: string; endpoint: string }

export async function apiIntegration(): Promise<IntegrationInfo> {
  return await readJson(await fetch('/api/settings/integration.php', { credentials: 'include' }));
}

export async function apiRegenerateIntegrationKey(): Promise<{ api_key: string }> {
  return await readJson(await fetch('/api/settings/integration.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action: 'regenerate' }),
  }));
}

export async function apiResetRisData(confirm: string): Promise<{ cleared: string[]; counters_reset: string[]; worklist_files_removed?: number }> {
  return await readJson(await fetch('/api/system/reset-ris.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ confirm }),
  }));
}

export async function apiListAllServices(): Promise<Service[]> {
  return (await readJson(await fetch('/api/reception/services.php?active=0', { credentials: 'include' }))) as Service[];
}

export async function apiSaveService(service: Partial<Service>): Promise<Service> {
  return await readJson(await fetch('/api/reception/services.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(service),
  }));
}

export async function apiDeleteService(id: number): Promise<{ deleted: number }> {
  return await readJson(await fetch(`/api/reception/services.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
}

export type ImportType =
  | 'patients' | 'referring_doctors' | 'consultants' | 'centers' | 'pros'
  | 'staff' | 'areas' | 'patient_groups' | 'dispatch_modes' | 'services' | 'test_parameters';

export async function apiImportCsv(type: ImportType, file: File): Promise<{ created: number; skipped: number; errors: string[] }> {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  return await readJson(await fetch('/api/reception/import-csv.php', {
    method: 'POST',
    credentials: 'include',
    body: form,
  }));
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

export type MasterEntity = 'centers' | 'pros' | 'lookups';

export async function apiMasters<T = any>(entity: MasterEntity, params: Record<string, string> = {}): Promise<T[]> {
  const qs = new URLSearchParams({ entity, ...params });
  return (await readJson(await fetch(`/api/settings/masters.php?${qs.toString()}`, { credentials: 'include' }))) as T[];
}

export async function apiSaveMaster(entity: MasterEntity, payload: Record<string, unknown>): Promise<any> {
  return await readJson(await fetch('/api/settings/masters.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ entity, ...payload }),
  }));
}

export async function apiDeleteMaster(entity: MasterEntity, id: number): Promise<{ id: number }> {
  return await readJson(await fetch(`/api/settings/masters.php?entity=${entity}&id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
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
  return (await readJson(await fetch(`/api/reception/referring-doctors.php${qs}`, { credentials: 'include' }))) as RisDoctor[];
}

export async function apiSaveDoctor(payload: Partial<RisDoctor>): Promise<RisDoctor> {
  return await readJson(await fetch('/api/reception/referring-doctors.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
}

export async function apiDeleteDoctor(id: number): Promise<{ id: number }> {
  return await readJson(await fetch(`/api/reception/referring-doctors.php?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }));
}

// ---------- Patient master ----------

export interface PatientMaster {
  id: number;
  mrn: string;
  name_prefix: string | null;
  full_name: string;
  last_name: string | null;
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
  return (await readJson(await fetch(`/api/reception/patients.php?${qs.toString()}`, { credentials: 'include' }))) as PatientMaster[];
}

export async function apiSavePatientMaster(payload: Partial<PatientMaster> & { action: 'create' | 'update' }): Promise<PatientMaster> {
  return await readJson(await fetch('/api/reception/patients.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }));
}
