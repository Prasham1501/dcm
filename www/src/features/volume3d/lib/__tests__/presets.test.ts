import { describe, it, expect } from 'vitest';
import {
  VOLUME_3D_PRESETS,
  getPresetById,
  DEFAULT_PRESET_ID,
} from '../presets';

describe('VOLUME_3D_PRESETS', () => {
  it('contains the five canonical presets in the expected order', () => {
    expect(VOLUME_3D_PRESETS.map((p) => p.id)).toEqual([
      'ct-bone',
      'ct-soft-tissue',
      'ct-lung',
      'ct-angio',
      'mip',
    ]);
  });

  it('exposes a non-empty label + description for every preset', () => {
    for (const p of VOLUME_3D_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it('CT presets carry a HU window/level pair; MIP is the only blend-mode entry', () => {
    for (const p of VOLUME_3D_PRESETS) {
      if (p.id === 'mip') {
        expect(p.mip).toBe(true);
        expect(p.cs3dPresetName).toBe('');
      } else {
        expect(p.voi?.windowCenter).toBeTypeOf('number');
        expect(p.voi?.windowWidth).toBeGreaterThan(0);
        expect(p.cs3dPresetName.length).toBeGreaterThan(0);
        expect(p.mip).toBeFalsy();
      }
    }
  });

  it('default preset id resolves to soft-tissue', () => {
    expect(DEFAULT_PRESET_ID).toBe('ct-soft-tissue');
    const def = getPresetById(DEFAULT_PRESET_ID);
    expect(def.id).toBe('ct-soft-tissue');
  });

  it('getPresetById falls back to soft-tissue for unknown ids', () => {
    // Cast through `any` so the test exercises the runtime fallback path
    // that the toolbar dropdown could trigger via a corrupted localStorage.
    const fallback = getPresetById('not-a-preset' as any);
    expect(fallback.id).toBe('ct-soft-tissue');
  });

  it('Bone preset uses a wide window centred above 0 HU (cortical bone range)', () => {
    const bone = getPresetById('ct-bone');
    expect(bone.voi!.windowCenter).toBeGreaterThan(0);
    expect(bone.voi!.windowWidth).toBeGreaterThanOrEqual(1500);
  });

  it('Lung preset uses a sub-zero centre (air-filled parenchyma)', () => {
    const lung = getPresetById('ct-lung');
    expect(lung.voi!.windowCenter).toBeLessThan(0);
  });
});
