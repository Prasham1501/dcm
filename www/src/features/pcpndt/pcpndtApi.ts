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
  if (!res.ok || !json || json.success === false || json.ok === false) {
    throw new Error((json && (json.error || json.message)) || `Request failed (HTTP ${res.status})`);
  }
  // Most viewer endpoints return { success, message, data }, but older PHP
  // copies of the PCPNDT endpoints returned the payload directly alongside
  // success/message. Accept both so the config tab does not crash when the
  // backend is one version ahead/behind the bundled UI.
  if (Object.prototype.hasOwnProperty.call(json, 'data')) return json.data;
  const { success: _success, message: _message, ...payload } = json;
  return payload;
}

const opts = (extra: RequestInit = {}): RequestInit => ({
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...extra,
});

/** fetch with a hard timeout so a wedged PHP request can't leave the Form F
 *  modal stuck on its loading spinner forever — it surfaces an error instead. */
async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('The PCPNDT backend did not respond in time. Is the local PHP server running?');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureDesktopSession(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout('/api/auth/desktop-login.php', opts({ method: 'POST' }));
    const json = await res.json().catch(() => null);
    return res.ok && !!json?.success;
  } catch {
    return false;
  }
}

async function pcpndtFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetchWithTimeout(url, opts(options));
  if (res.status !== 401) return res;

  // The desktop viewer starts with an app-level ADMIN state, while PHP still
  // needs a session cookie before protected PCPNDT endpoints can save. Reuse
  // the product-scoped desktop auto-login endpoint, then retry the original
  // request once. Networked installs keep returning 401/403 as before.
  if (await ensureDesktopSession()) {
    return fetchWithTimeout(url, opts(options));
  }
  return res;
}

export async function pcpndtPrefill(params: { studyUid?: string; patientId?: string; patientName?: string }): Promise<PcpndtPrefill> {
  const q = new URLSearchParams();
  if (params.studyUid) q.set('study_uid', params.studyUid);
  if (params.patientId) q.set('patient_id', params.patientId);
  if (params.patientName) q.set('patient_name', params.patientName);
  return (await readJson(await pcpndtFetch(`/api/pcpndt/prefill.php?${q.toString()}`))) as PcpndtPrefill;
}

export async function pcpndtSave(studyUid: string, fields: FormFFields): Promise<Record<string, any>> {
  return await readJson(await pcpndtFetch('/api/pcpndt/save.php', { method: 'POST', body: JSON.stringify({ ...fields, study_uid: studyUid }) }));
}

export async function pcpndtSetStatus(studyUid: string, status: string, portalAckNo?: string): Promise<Record<string, any>> {
  return await readJson(await pcpndtFetch('/api/pcpndt/submit-status.php', { method: 'POST', body: JSON.stringify({ study_uid: studyUid, status, portal_ack_no: portalAckNo }) }));
}

export async function pcpndtGetPortalCreds(state = 'maharashtra'): Promise<PortalCreds> {
  return (await readJson(await pcpndtFetch(`/api/pcpndt/portal-credentials.php?state=${encodeURIComponent(state)}`))) as PortalCreds;
}

export async function pcpndtSetPortalCreds(state: string, username: string, password: string): Promise<PortalCreds> {
  return (await readJson(await pcpndtFetch('/api/pcpndt/portal-credentials.php', { method: 'POST', body: JSON.stringify({ state_code: state, username, password }) }))) as PortalCreds;
}

export interface PcpndtConfig {
  settings: Record<string, string>;
  portal: { state_code: string; username: string; has_password: boolean };
}

export async function pcpndtGetConfig(): Promise<PcpndtConfig> {
  return (await readJson(await pcpndtFetch('/api/pcpndt/config.php'))) as PcpndtConfig;
}

export async function pcpndtSaveConfig(payload: Record<string, any>): Promise<PcpndtConfig> {
  return (await readJson(await pcpndtFetch('/api/pcpndt/config.php', { method: 'POST', body: JSON.stringify(payload) }))) as PcpndtConfig;
}

export function pcpndtFormHtmlUrl(studyUid: string): string {
  return `/api/pcpndt/form-html.php?study_uid=${encodeURIComponent(studyUid)}`;
}

/** Maharashtra PCPNDT portal (assisted submission — doctor reviews & submits). */
export const PCPNDT_PORTAL_URL = 'https://pcpndt.maharashtra.gov.in/';
