/**
 * Cornerstone3D bootstrap — idempotent init for the volume viewer.
 *
 * This module lives in its OWN registry (`@cornerstonejs/core`) and never
 * touches the legacy `cornerstone-core@2.x` setup used by the 2D viewers.
 * It is dynamically imported only from the /volume-3d route so the cs3d
 * + vtk.js bundle is excluded from the 2D viewer windows.
 */
import * as cornerstone3D from '@cornerstonejs/core';
import * as cornerstone3DTools from '@cornerstonejs/tools';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import { dicomBaseUrl } from '@/lib/dicomLoader';

let initialized: Promise<void> | null = null;

/** Public re-exports so callers don't each import from the cs3d packages. */
export { cornerstone3D, cornerstone3DTools, cornerstoneDICOMImageLoader };

export async function initCornerstone3D(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    // ── Cap the device-pixel-ratio cs3d uses to size its WebGL canvas ──
    // On a Windows display set to 125%/150% scaling, window.devicePixelRatio
    // is 1.25/1.5, so cs3d allocates a canvas 1.5x larger per axis = ~2.25x
    // the pixels. The volume ray-caster then does 2.25x the work every frame,
    // which is why the packaged app stutters on an integrated GPU while the
    // exact same page is smooth in a DPR-1 browser. cs3d reads
    // `window.devicePixelRatio` directly when sizing, so we clamp it here.
    // The 3D viewer runs in its own dedicated Electron window, so this
    // override is scoped to that window and doesn't affect the rest of the UI.
    try {
      const realDpr = window.devicePixelRatio || 1;
      const cappedDpr = Math.min(realDpr, 1.0);
      if (cappedDpr < realDpr) {
        Object.defineProperty(window, 'devicePixelRatio', {
          configurable: true,
          get: () => cappedDpr,
        });
      }
    } catch { /* getter already overridden / locked — ignore */ }

    // Core renders volumes via vtk.js + WebGL2.
    await cornerstone3D.init();

    // Give the volume/image cache plenty of headroom (target ~16 GB RAM
    // machines). The default cache is small and can evict slices mid-load
    // on bigger series, forcing re-fetches and stutter. 2 GB is safe.
    try {
      (cornerstone3D as any).cache?.setMaxCacheSize?.(2 * 1024 * 1024 * 1024);
    } catch { /* older API — ignore */ }

    // dicom-image-loader 4.x exposes an init() that wires up its codec
    // web-workers. The package is built as ESM so Vite emits the worker
    // chunks into dist/assets at build time — no manual worker path needed
    // in the Electron loopback origin.
    //
    // Decode throughput scales with worker count. The old cap of 2 left
    // most CPU cores idle and made a 140-slice load feel slow. Use up to
    // (cores − 1), capped at 8, leaving one core for the render/UI thread.
    const cores = navigator.hardwareConcurrency || 4;
    await cornerstoneDICOMImageLoader.init({
      maxWebWorkers: Math.min(8, Math.max(cores - 1, 3)),
    });

    // Tools registry (CrosshairsTool, TrackballRotateTool, …).
    await cornerstone3DTools.init();

    // Register a one-time wadouri metadata helper that resolves to the
    // same serve-file.php URL the 2D viewers use. The loader itself is
    // already registered globally by `cornerstoneDICOMImageLoader.init()`,
    // so we don't need to call registerImageLoader manually.
    (window as any).__cs3dDicomBaseUrl = dicomBaseUrl();
  })();
  return initialized;
}

/** Build a cs3d-compatible wadouri imageId for a local DICOM file path.
 *  Mirrors `localFileToImageId` in `lib/dicomLoader.ts` but is exported
 *  separately so callers in the volume3d feature don't accidentally pull
 *  in the legacy cornerstone-core init. */
export function localFileToCs3dImageId(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(normalized);
  return `wadouri:${dicomBaseUrl()}/dicom/serve-file.php?path=${encodedPath}`;
}
