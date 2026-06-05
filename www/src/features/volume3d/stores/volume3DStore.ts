/**
 * volume3DStore — Zustand state for the /volume-3d page.
 *
 * Persists the active launch payload (patient + DICOM file paths) plus the
 * UI selections (preset, layout, status). Mirrors the `viewer-launch`
 * consume pattern used by ViewerPage / CRViewerPage so a single window
 * can be reused across multiple study opens.
 */
import { create } from 'zustand';
import type { Volume3DPresetId } from '../lib/presets';
import { DEFAULT_PRESET_ID } from '../lib/presets';

export type Volume3DStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'error'
  | 'unsupported';

export type Volume3DLayout = 'vr-only' | 'quad';

export interface Volume3DLaunch {
  patientName: string;
  patientId: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  filePaths: string[];
  /** Pixel-spacing / safety budget — when this many bytes is exceeded
   *  the loader downsamples in-plane (handled in `buildVolume.ts`). */
  timestamp: number;
}

export interface Volume3DState {
  patientName: string;
  patientId: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  filePaths: string[];

  status: Volume3DStatus;
  error: string | null;
  loadedSlices: number;
  totalSlices: number;
  failedSlices: number;

  presetId: Volume3DPresetId;
  layout: Volume3DLayout;
  opacity: number;            // 0..1 — global volume opacity multiplier
  voiOverride: { center: number; width: number } | null;
  cineRotating: boolean;      // auto-rotate the VR camera around the Y axis

  /** Load (or refresh) state from the `volume-3d-launch` localStorage
   *  payload. Returns true when a fresh payload was consumed. */
  loadFromLaunch: () => boolean;
  setStatus: (s: Volume3DStatus, error?: string | null) => void;
  setProgress: (loaded: number, total: number) => void;
  setFailedSlices: (count: number) => void;
  setPreset: (id: Volume3DPresetId) => void;
  setLayout: (layout: Volume3DLayout) => void;
  setOpacity: (opacity: number) => void;
  setVoi: (voi: { center: number; width: number } | null) => void;
  setCineRotating: (rotating: boolean) => void;
  reset: () => void;
}

const LAUNCH_KEY = 'volume-3d-launch';
// First-window cs3d init + WASM-worker spin-up + a 140-slice CT load can take
// 30-60s on a cold start. The old 30 s ceiling caused the launch to be marked
// stale before the new BrowserWindow even finished mounting → blank screen.
const LAUNCH_MAX_AGE_MS = 5 * 60_000;

const initial = {
  patientName: '',
  patientId: '',
  studyDate: '',
  studyDescription: '',
  modality: '',
  filePaths: [] as string[],
  status: 'idle' as Volume3DStatus,
  error: null as string | null,
  loadedSlices: 0,
  totalSlices: 0,
  failedSlices: 0,
  presetId: DEFAULT_PRESET_ID,
  layout: 'quad' as Volume3DLayout,
  opacity: 1.0,
  voiOverride: null as { center: number; width: number } | null,
  cineRotating: false,
};

export const useVolume3DStore = create<Volume3DState>((set) => ({
  ...initial,

  loadFromLaunch: () => {
    try {
      const raw = localStorage.getItem(LAUNCH_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Volume3DLaunch;
      // Fresh payload only — stale launches (e.g. on page reload long after
      // the click) shouldn't kick off a heavy GPU load.
      if (!data || !Array.isArray(data.filePaths) || data.filePaths.length === 0) return false;
      if (typeof data.timestamp !== 'number' || Date.now() - data.timestamp > LAUNCH_MAX_AGE_MS) {
        localStorage.removeItem(LAUNCH_KEY);
        return false;
      }
      set({
        patientName: data.patientName ?? '',
        patientId: data.patientId ?? '',
        studyDate: data.studyDate ?? '',
        studyDescription: data.studyDescription ?? '',
        modality: data.modality ?? '',
        filePaths: data.filePaths,
        totalSlices: data.filePaths.length,
        loadedSlices: 0,
        failedSlices: 0,
        status: 'loading',
        error: null,
        // Keep UI selections across reloads so the radiologist's preset/
        // layout choice survives a quick re-open of the window.
      });
      localStorage.removeItem(LAUNCH_KEY);
      return true;
    } catch {
      return false;
    }
  },

  setStatus: (status, error = null) => set({ status, error: error ?? null }),
  setProgress: (loadedSlices, totalSlices) => set({ loadedSlices, totalSlices }),
  setFailedSlices: (failedSlices) => set({ failedSlices }),
  setPreset: (presetId) => set({ presetId }),
  setLayout: (layout) => set({ layout }),
  setOpacity: (opacity) => set({ opacity: Math.max(0, Math.min(1, opacity)) }),
  setVoi: (voiOverride) => set({ voiOverride }),
  setCineRotating: (cineRotating) => set({ cineRotating }),
  reset: () => set({ ...initial }),
}));
