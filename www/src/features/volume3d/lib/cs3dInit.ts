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
    // Core renders volumes via vtk.js + WebGL2.
    await cornerstone3D.init();

    // dicom-image-loader 4.x exposes an init() that wires up its codec
    // web-workers. The package is built as ESM so Vite emits the worker
    // chunks into dist/assets at build time — no manual worker path needed
    // in the Electron loopback origin.
    await cornerstoneDICOMImageLoader.init({
      maxWebWorkers: Math.min(2, Math.max(navigator.hardwareConcurrency ?? 2, 1)),
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
