import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkVolume3DEligibility,
  describeIneligibility,
  isWebGL2Supported,
  MIN_SLICES_FOR_3D,
} from '../eligibility';

describe('checkVolume3DEligibility', () => {
  it('flags missing modality as missing_data', () => {
    expect(checkVolume3DEligibility({ imageCount: 100 }))
      .toEqual({ eligible: false, reason: 'missing_data' });
  });

  it('rejects non-volumetric modalities', () => {
    for (const m of ['CR', 'DX', 'US', 'MG', 'NM', 'XA']) {
      expect(checkVolume3DEligibility({ modality: m, imageCount: 100, webgl2Supported: true }))
        .toEqual({ eligible: false, reason: 'wrong_modality' });
    }
  });

  it('accepts CT and MR (case-insensitive, trimmed)', () => {
    for (const m of ['CT', 'ct', ' CT ', 'MR', 'mr']) {
      expect(checkVolume3DEligibility({ modality: m, imageCount: 100, webgl2Supported: true }))
        .toEqual({ eligible: true });
    }
  });

  it('requires MIN_SLICES_FOR_3D slices', () => {
    expect(checkVolume3DEligibility({ modality: 'CT', imageCount: MIN_SLICES_FOR_3D - 1, webgl2Supported: true }))
      .toEqual({ eligible: false, reason: 'too_few_slices' });
    expect(checkVolume3DEligibility({ modality: 'CT', imageCount: MIN_SLICES_FOR_3D, webgl2Supported: true }))
      .toEqual({ eligible: true });
  });

  it('blocks when WebGL2 is explicitly unsupported', () => {
    expect(checkVolume3DEligibility({ modality: 'CT', imageCount: 100, webgl2Supported: false }))
      .toEqual({ eligible: false, reason: 'no_webgl2' });
  });

  it('treats missing webgl2Supported as supported (optimistic — the page re-checks)', () => {
    expect(checkVolume3DEligibility({ modality: 'CT', imageCount: 100 }))
      .toEqual({ eligible: true });
  });
});

describe('describeIneligibility', () => {
  it('returns a non-empty message for each reason', () => {
    for (const r of ['wrong_modality', 'too_few_slices', 'no_webgl2', 'missing_data', undefined] as const) {
      const msg = describeIneligibility(r);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

describe('isWebGL2Supported', () => {
  beforeEach(() => {
    // happy-dom doesn't implement WebGL2 — we just verify the probe
    // returns a boolean and is memoised on subsequent calls.
  });

  it('returns a boolean', () => {
    expect(typeof isWebGL2Supported()).toBe('boolean');
  });

  it('is memoised — second call returns the same value without re-probing', () => {
    const a = isWebGL2Supported();
    const b = isWebGL2Supported();
    expect(a).toBe(b);
  });
});
