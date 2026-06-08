/**
 * GPU capability detection for the 3D volume viewer.
 *
 * Volume ray-casting cost scales with the GPU. We read the WebGL renderer
 * string once and classify the GPU so the viewport can pick a sample-distance
 * multiplier that keeps interaction smooth:
 *   - dedicated (NVIDIA / AMD Radeon / Intel Arc) → full quality (1.0)
 *   - integrated (Intel Iris/UHD/HD, Apple, Mali, Adreno) → slightly coarser
 *   - software  (SwiftShader / llvmpipe / Microsoft Basic) → coarsest
 *
 * NOTE: we use `setSampleDistanceMultiplier` (the official cs3d API) rather
 * than poking the vtk mapper's max-samples-per-ray — the latter truncates
 * rays and produced "venetian-blind" striping. A modest multiplier only
 * changes the step size and stays artifact-free.
 */

export type GpuTier = 'dedicated' | 'integrated' | 'software';

export interface GpuInfo {
  tier: GpuTier;
  renderer: string;
  webgl2: boolean;
}

let cached: GpuInfo | null = null;

export function detectGpu(): GpuInfo {
  if (cached) return cached;
  let renderer = '';
  let webgl2 = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    webgl2 = !!canvas.getContext('webgl2');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String(
        (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) ||
          gl.getParameter(gl.RENDERER) ||
          '',
      );
    }
  } catch {
    /* ignore — fall back to integrated */
  }

  const s = renderer.toLowerCase();
  let tier: GpuTier;
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(s) || !renderer) {
    tier = 'software';
  } else if (/nvidia|geforce|quadro|radeon|\bamd\b|firepro|intel\(r\) arc|\barc\b/.test(s)) {
    tier = 'dedicated';
  } else {
    // Intel Iris/UHD/HD, Apple M-series, ARM Mali, Qualcomm Adreno, etc.
    tier = 'integrated';
  }

  cached = { tier, renderer, webgl2 };
  return cached;
}

/** Sample-distance multiplier per tier. 1.0 = finest (cs3d default).
 *  Higher = coarser steps = faster, but on CTs with 2-5 mm slice spacing a
 *  coarse multiplier steps past entire slices and shows them as detached
 *  horizontal bands. We pair this with an absolute `setSampleDistance` in
 *  the viewport (½ × smallest voxel spacing), so the relative multiplier
 *  only needs to keep weak GPUs responsive — never coarser than 1.0. */
export function sampleDistanceMultiplierForTier(tier: GpuTier): number {
  switch (tier) {
    case 'dedicated':
      return 1.0;
    case 'integrated':
      return 1.0;
    case 'software':
    default:
      return 1.2;
  }
}
