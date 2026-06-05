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

export async function openVolume3D(input: OpenVolume3DInput, navigate?: (path: string) => void): Promise<boolean> {
  if (!input.filePaths || input.filePaths.length === 0) return false;

  const payload: Volume3DLaunch = {
    patientName: input.patientName ?? '',
    patientId: input.patientId ?? '',
    studyDate: input.studyDate ?? '',
    studyDescription: input.studyDescription ?? '',
    modality: input.modality ?? '',
    filePaths: input.filePaths,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(LAUNCH_KEY, JSON.stringify(payload));
  } catch {
    return false;
  }

  const api = (window as any).electronAPI;
  if (api?.openVolumeViewer) {
    try {
      await api.openVolumeViewer({ imageCount: input.filePaths.length });
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[openVolume3D] openVolumeViewer failed, falling back to in-app nav', e);
    }
  } else if (api?.invoke) {
    try {
      await api.invoke('open-volume-viewer', { imageCount: input.filePaths.length });
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[openVolume3D] electron invoke failed, falling back to in-app nav', e);
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
