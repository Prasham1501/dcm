/**
 * openVolume3D — toolbar-side helper that writes the launch payload and
 * opens (or refocuses) the dedicated 3D viewer window.
 *
 * Mirrors the openViewer / openCRViewer pattern in `main.js`:
 *   1. Write a fresh `volume-3d-launch` payload to localStorage so the
 *      target page can hydrate from it.
 *   2. Ask the Electron main process to spin up (or refocus) the
 *      dedicated `BrowserWindow` for /volume-3d.
 *   3. Fall back to in-app navigation when not in Electron — useful for
 *      local development with `npm run dev`.
 */
import type { Volume3DLaunch } from './stores/volume3DStore';

export interface OpenVolume3DInput {
  patientName?: string;
  patientId?: string;
  studyDate?: string;
  studyDescription?: string;
  modality?: string;
  filePaths: string[];
}

const LAUNCH_KEY = 'volume-3d-launch';

function buildPayload(input: OpenVolume3DInput): Volume3DLaunch {
  return {
    patientName: input.patientName ?? '',
    patientId: input.patientId ?? '',
    studyDate: input.studyDate ?? '',
    studyDescription: input.studyDescription ?? '',
    modality: input.modality ?? '',
    filePaths: input.filePaths,
    timestamp: Date.now(),
  };
}

/** Open the 3D viewer in the system default browser (uses the OS browser's
 *  GPU pipeline). Works offline: the payload is handed to the main process,
 *  which writes a temp file and opens the browser at /volume-3d?launchFile=…
 *  Falls back to a new browser tab when not running in Electron. */
export async function openVolume3DInBrowser(input: OpenVolume3DInput): Promise<boolean> {
  if (!input.filePaths || input.filePaths.length === 0) return false;
  const payload = buildPayload(input);
  const api = (window as any).electronAPI;
  if (api?.openVolumeInBrowser) {
    try {
      const res = await api.openVolumeInBrowser(payload);
      return !!res?.success;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[openVolume3DInBrowser] failed', e);
    }
  }
  // Non-Electron fallback: stash in localStorage + open a new tab.
  try { localStorage.setItem(LAUNCH_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  window.open('/volume-3d', '_blank');
  return true;
}

export async function openVolume3D(input: OpenVolume3DInput, navigate?: (path: string) => void): Promise<boolean> {
  if (!input.filePaths || input.filePaths.length === 0) return false;

  const payload = buildPayload(input);
  const launchParams = { imageCount: input.filePaths.length, payload };

  try {
    localStorage.setItem(LAUNCH_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }

  const api = (window as any).electronAPI;
  if (api?.openVolumeViewer) {
    try {
      await api.openVolumeViewer(launchParams);
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[openVolume3D] openVolumeViewer failed, falling back to in-app nav', e);
    }
  }

  if (navigate) {
    navigate('/volume-3d');
    return true;
  }

  // Browser fallback: open in a new tab so the engine has its own GL context.
  window.open('/volume-3d', '_blank');
  return true;
}
