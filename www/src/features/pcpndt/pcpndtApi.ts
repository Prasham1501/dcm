/**
 * PCPNDT Form F API.
 *
 * Uses same-origin relative URLs with credentialed cookies — the SPA is served
 * from the same origin that proxies /api to PHP (Electron static server / Apache),
 * so the session cookie is sent automatically. (We deliberately do NOT use the
 * shared `api` service: its base-URL handling doubles the `/api` prefix.)
 */

export type FormFFields = Record<string, any> & { indications?: string[]; procedures?: string[] };

export interface PcpndtOptions {
  indications: string[];
  procedures: string[];
  basis_of_diagnosis: string[];
}

export interface PcpndtPrefill {
  study_uid: string;        // resolved form key (StudyInstanceUID or PID:<id>)
  fields: FormFFields;
  missing: string[];
  options: PcpndtOptions;
  saved: boolean;
  status: string;
  ris_linked: boolean;
}

export interface PortalCreds {
  state_code: string;
  username: string;
  has_password: boolean;
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // The endpoint returned HTML (404 page, login redirect, proxy error…).
    throw new Error(
      res.status === 404
        ? 'PCPNDT API not found (HTTP 404). Is the PHP backend serving /api/pcpndt/?'
        : `PCPNDT API returned a non-JSON response (HTTP ${res.status}).`
    );
  }
  if (!json || json.success === false) {
    throw new Error((json && (json.error || json.message)) || `Request failed (HTTP ${res.status})`);
  }
  return json.data;
}

const opts = (extra: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...extra,
});

export async function pcpndtPrefill(params: { studyUid?: string; patientId?: string; patientName?: string }): Promise<PcpndtPrefill> {
  const q = new URLSearchParams();
  if (params.studyUid) q.set('study_uid', params.studyUid);
  if (params.patientId) q.set('patient_id', params.patientId);
  if (params.patientName) q.set('patient_name', params.patientName);
  return (await readJson(await fetch(`/api/pcpndt/prefill.php?${q.toString()}`, opts()))) as PcpndtPrefill;
}

export async function pcpndtSave(studyUid: string, fields: FormFFields): Promise<Record<string, any>> {
  return await readJson(await fetch('/api/pcpndt/save.php', opts({ method: 'POST', body: JSON.stringify({ ...fields, study_uid: studyUid }) })));
}

export async function pcpndtSetStatus(studyUid: string, status: string, portalAckNo?: string): Promise<Record<string, any>> {
  return await readJson(await fetch('/api/pcpndt/submit-status.php', opts({ method: 'POST', body: JSON.stringify({ study_uid: studyUid, status, portal_ack_no: portalAckNo }) })));
}

export async function pcpndtGetPortalCreds(state = 'maharashtra'): Promise<PortalCreds> {
  return (await readJson(await fetch(`/api/pcpndt/portal-credentials.php?state=${encodeURIComponent(state)}`, opts()))) as PortalCreds;
}

export async function pcpndtSetPortalCreds(state: string, username: string, password: string): Promise<PortalCreds> {
  return (await readJson(await fetch('/api/pcpndt/portal-credentials.php', opts({ method: 'POST', body: JSON.stringify({ state_code: state, username, password }) })))) as PortalCreds;
}

export interface PcpndtConfig {
  settings: Record<string, string>;
  portal: { state_code: string; username: string; has_password: boolean };
}

export async function pcpndtGetConfig(): Promise<PcpndtConfig> {
  return (await readJson(await fetch('/api/pcpndt/config.php', opts()))) as PcpndtConfig;
}

export async function pcpndtSaveConfig(payload: Record<string, any>): Promise<PcpndtConfig> {
  return (await readJson(await fetch('/api/pcpndt/config.php', opts({ method: 'POST', body: JSON.stringify(payload) })))) as PcpndtConfig;
}

export function pcpndtFormHtmlUrl(studyUid: string): string {
  return `/api/pcpndt/form-html.php?study_uid=${encodeURIComponent(studyUid)}`;
}

/** Maharashtra PCPNDT portal (assisted submission — doctor reviews & submits). */
export const PCPNDT_PORTAL_URL = 'https://pcpndt.maharashtra.gov.in/';
