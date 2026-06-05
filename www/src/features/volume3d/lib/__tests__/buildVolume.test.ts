import { describe, it, expect, vi } from 'vitest';

// `buildVolume.ts` imports `./cs3dInit`, which in turn loads
// @cornerstonejs/core — a heavy bundle that drags vtk.js in. The
// functions exercised in this file are pure (no cs3d calls), so we
// stub the side-effecting module out and keep the test fast/offline.
vi.mock('../cs3dInit', () => ({
  cornerstone3D: {},
  localFileToCs3dImageId: (p: string) => `wadouri:test://${p}`,
}));

import {
  estimateVolumeBytes,
  classifyVolumeSize,
  makeVolumeId,
  MAX_VOLUME_BYTES,
} from '../buildVolume';

describe('estimateVolumeBytes', () => {
  it('uses 2 bytes/voxel and 512x512 in-plane by default', () => {
    // 100 slices * 512 * 512 * 2 = 52428800 bytes
    expect(estimateVolumeBytes(100)).toBe(100 * 512 * 512 * 2);
  });

  it('honours custom rows/cols', () => {
    expect(estimateVolumeBytes(50, 256, 256)).toBe(50 * 256 * 256 * 2);
  });

  it('scales linearly with slice count', () => {
    const a = estimateVolumeBytes(100);
    const b = estimateVolumeBytes(200);
    expect(b).toBe(a * 2);
  });
});

describe('classifyVolumeSize', () => {
  // The size buckets are anchored to the 400MB MAX_VOLUME_BYTES budget.
  // Boundary maths: 1 MB = 1024*1024 bytes.
  it('ok when below the budget', () => {
    // 400 MB / (512*512*2 bytes per slice) ≈ 800 slices
    expect(classifyVolumeSize(500)).toBe('ok');
    expect(classifyVolumeSize(1)).toBe('ok');
  });

  it('tight when between 1x and 2x the budget', () => {
    // ~1000 slices → ~500 MB > 400 MB but < 800 MB
    expect(classifyVolumeSize(1000)).toBe('tight');
  });

  it('too_large beyond 2x the budget', () => {
    // 2000 slices → ~1000 MB > 800 MB
    expect(classifyVolumeSize(2000)).toBe('too_large');
  });

  it('MAX_VOLUME_BYTES is the published 400MB ceiling', () => {
    expect(MAX_VOLUME_BYTES).toBe(400 * 1024 * 1024);
  });
});

describe('makeVolumeId', () => {
  it('is deterministic for the same file list', () => {
    const files = ['/a/b/0.dcm', '/a/b/1.dcm', '/a/b/2.dcm'];
    expect(makeVolumeId(files)).toBe(makeVolumeId(files));
  });

  it('changes when the first file or slice count changes', () => {
    const base = ['/a/0.dcm', '/a/1.dcm'];
    expect(makeVolumeId(base)).not.toBe(makeVolumeId(['/a/0.dcm', '/a/1.dcm', '/a/2.dcm']));
    expect(makeVolumeId(base)).not.toBe(makeVolumeId(['/b/0.dcm', '/a/1.dcm']));
  });

  it('encodes file count in the id (so cs3d cache hits reflect series size)', () => {
    expect(makeVolumeId(['x.dcm', 'y.dcm'])).toContain('|2');
  });

  it('handles empty input without crashing (returns a fallback id)', () => {
    const id = makeVolumeId([]);
    expect(typeof id).toBe('string');
    expect(id).toContain('|0');
  });
});
