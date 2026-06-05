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
  receipt_header: string;
  receipt_footer: string;
  gst_number: string;
  default_tax_percentage: string;
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
