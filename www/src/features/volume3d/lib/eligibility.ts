/**
 * Eligibility — pure helpers that decide whether the 3D viewer should be
 * offered for a given study. Kept dependency-free so they're trivially
 * unit-testable and safe to import from the 2D toolbars.
 */

export const MIN_SLICES_FOR_3D = 20;

/** Modality codes that benefit from volume rendering. CT is the primary
 *  target; MR is allowed because cs3d handles it identically and several
 *  client builds will want T1/T2 MPR. Other 2D modalities (CR/DX/US/MG)
 *  are excluded. */
const VOLUMETRIC_MODALITIES = new Set(['CT', 'MR']);

export interface Volume3DEligibilityInput {
  modality?: string;
  /** Number of frames/instances available — usually `images.length` or
   *  `filePaths.length` depending on the calling viewer. */
  imageCount?: number;
  /** Whether the user's GPU has been detected as supporting WebGL2. */
  webgl2Supported?: boolean;
}

export interface Volume3DEligibilityResult {
  eligible: boolean;
  reason?:
    | 'wrong_modality'
    | 'too_few_slices'
    | 'no_webgl2'
    | 'missing_data';
}

export function checkVolume3DEligibility(input: Volume3DEligibilityInput): Volume3DEligibilityResult {
  const modality = (input.modality ?? '').trim().toUpperCase();
  const count = input.imageCount ?? 0;
  if (!modality) return { eligible: false, reason: 'missing_data' };
  if (!VOLUMETRIC_MODALITIES.has(modality)) return { eligible: false, reason: 'wrong_modality' };
  if (count < MIN_SLICES_FOR_3D) return { eligible: false, reason: 'too_few_slices' };
  if (input.webgl2Supported === false) return { eligible: false, reason: 'no_webgl2' };
  return { eligible: true };
}

/** Human-readable tooltip for the disabled button states. */
export function describeIneligibility(reason: Volume3DEligibilityResult['reason']): string {
  switch (reason) {
    case 'wrong_modality': return '3D viewer is available for CT and MR studies only.';
    case 'too_few_slices': return `Need at least ${MIN_SLICES_FOR_3D} slices to reconstruct a volume.`;
    case 'no_webgl2':      return '3D rendering requires WebGL2 — your GPU does not support it.';
    case 'missing_data':   return 'Study modality is unknown — cannot determine 3D eligibility.';
    default:               return '3D viewer is not available for this study.';
  }
}

/** One-shot WebGL2 probe used by toolbars + the page itself. Memoized so
 *  the costly canvas creation only happens once per renderer process. */
let webgl2Cache: boolean | null = null;
export function isWebGL2Supported(): boolean {
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl2Cache = !!gl;
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}
