/**
 * buildVolume — wraps cs3d's volume loader so the page component never
 * touches `@cornerstonejs/core` internals directly.
 *
 * Cornerstone3D handles slice sort (via ImagePositionPatient),
 * inter-slice spacing, orientation, RescaleSlope/Intercept → HU, gantry
 * tilt and progressive streaming. We just hand it a list of imageIds and
 * await the volume.
 */
import { cornerstone3D, localFileToCs3dImageId } from './cs3dInit';

export interface BuildVolumeInput {
  volumeId: string;
  filePaths: string[];
  onProgress?: (loaded: number, total: number) => void;
}

export interface BuildVolumeResult {
  volume: any;
  imageIds: string[];
  failedSlices: number;
}

/** Estimated upper bound on volume byte size. Used by the page to abort
 *  before allocating an absurd GPU texture. Conservative — assumes
 *  uint16 (2 bytes per voxel) and a typical 512x512 in-plane resolution
 *  when actual dimensions are unknown. */
export function estimateVolumeBytes(numSlices: number, rows = 512, cols = 512): number {
  return numSlices * rows * cols * 2;
}

/** Hard memory ceiling for the GPU volume. Beyond this we'll downsample
 *  in-plane or refuse to load. ~400 MB matches the budget the 2D viewer
 *  uses for cornerstone v2's image cache. */
export const MAX_VOLUME_BYTES = 400 * 1024 * 1024;

/** Inspect a candidate volume size and decide whether to load it as-is,
 *  warn that it's tight, or refuse outright. Used by the page before
 *  buildVolume so we can show a helpful error instead of an OOM crash. */
export function classifyVolumeSize(numSlices: number): 'ok' | 'tight' | 'too_large' {
  const bytes = estimateVolumeBytes(numSlices);
  if (bytes <= MAX_VOLUME_BYTES) return 'ok';
  if (bytes <= MAX_VOLUME_BYTES * 2) return 'tight';
  return 'too_large';
}

export async function buildVolume({ volumeId, filePaths, onProgress }: BuildVolumeInput): Promise<BuildVolumeResult> {
  if (!filePaths || filePaths.length === 0) {
    throw new Error('No DICOM file paths supplied');
  }

  const imageIds = filePaths.map(localFileToCs3dImageId);

  // Wire progress + failure callbacks so the UI can show
  // "loaded N/M slices" and surface the count of frames that failed.
  const { eventTarget, Enums } = cornerstone3D as any;
  let loaded = 0;
  let failed = 0;
  const onImage = () => {
    loaded = Math.min(loaded + 1, imageIds.length);
    onProgress?.(loaded, imageIds.length);
  };
  const onImageFailed = () => { failed += 1; };
  const IMAGE_LOADED = Enums?.Events?.IMAGE_LOADED;
  const IMAGE_LOAD_FAILED = Enums?.Events?.IMAGE_LOAD_FAILED;
  if (IMAGE_LOADED) eventTarget?.addEventListener(IMAGE_LOADED, onImage);
  if (IMAGE_LOAD_FAILED) eventTarget?.addEventListener(IMAGE_LOAD_FAILED, onImageFailed);

  try {
    // createAndCacheVolume is async in cs3d 4.x — it kicks off the
    // streaming load when `volume.load()` is called.
    const volume = await (cornerstone3D as any).volumeLoader.createAndCacheVolume(volumeId, { imageIds });
    await volume.load();
    onProgress?.(imageIds.length, imageIds.length);
    return { volume, imageIds, failedSlices: failed };
  } finally {
    if (IMAGE_LOADED) {
      try { eventTarget?.removeEventListener(IMAGE_LOADED, onImage); } catch { /* ignore */ }
    }
    if (IMAGE_LOAD_FAILED) {
      try { eventTarget?.removeEventListener(IMAGE_LOAD_FAILED, onImageFailed); } catch { /* ignore */ }
    }
  }
}

/** Convenience: deterministic volumeId for a given launch payload so
 *  reopening the same study skips the second load (cs3d's volume cache
 *  is keyed by id). */
export function makeVolumeId(filePaths: string[]): string {
  const first = filePaths[0] ?? '';
  return `cs3dVolume:${first}|${filePaths.length}`;
}

/** Drop a previously-cached volume from cs3d. Called on viewer unmount
 *  so a long-running Electron session doesn't accumulate GPU textures
 *  for every study the radiologist opens. */
export function disposeVolume(volumeId: string): void {
  try {
    const cache: any = (cornerstone3D as any).cache;
    cache?.removeVolumeLoadObject?.(volumeId);
  } catch { /* ignore — best-effort cleanup */ }
}
