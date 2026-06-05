/**
 * CT HU presets exposed in the 3D toolbar UI. The cs3d core ships a
 * `CONSTANTS.VIEWPORT_PRESETS` list with VTK transfer functions for the
 * common radiology presets — we map our friendly UI labels onto those
 * cs3d preset names so swapping engines later would only require this
 * table to change.
 *
 * The MIP entry is handled separately at the viewport blend-mode level
 * (set `BlendMode.MAXIMUM_INTENSITY_BLEND` on the volume actor).
 */

export type Volume3DPresetId =
  | 'ct-bone'
  | 'ct-soft-tissue'
  | 'ct-lung'
  | 'ct-angio'
  | 'mip';

export interface Volume3DPreset {
  id: Volume3DPresetId;
  label: string;
  description: string;
  /** Matching key in cs3d's `CONSTANTS.VIEWPORT_PRESETS`. Empty for MIP
   *  because MIP is not a transfer-function preset but a blend mode. */
  cs3dPresetName: string;
  /** Optional explicit window/level override applied via
   *  `viewport.setProperties({ voiRange })`. Values are in Hounsfield
   *  units (CT) — for non-CT modalities the viewport will fall back to
   *  the volume's intrinsic VOI. */
  voi?: { windowCenter: number; windowWidth: number };
  /** Set when this preset should switch the volume actor into MIP. */
  mip?: boolean;
}

export const VOLUME_3D_PRESETS: Volume3DPreset[] = [
  {
    id: 'ct-bone',
    label: 'Bone',
    description: 'Cortical bone — wide HU window centered on dense tissue.',
    cs3dPresetName: 'CT-Bone',
    voi: { windowCenter: 400, windowWidth: 2000 },
  },
  {
    id: 'ct-soft-tissue',
    label: 'Soft Tissue',
    description: 'Generic soft-tissue window — visceral organs, mediastinum.',
    cs3dPresetName: 'CT-Soft-Tissue',
    voi: { windowCenter: 40, windowWidth: 400 },
  },
  {
    id: 'ct-lung',
    label: 'Lung',
    description: 'Pulmonary parenchyma — narrow low-HU window.',
    cs3dPresetName: 'CT-Lung',
    voi: { windowCenter: -600, windowWidth: 1500 },
  },
  {
    id: 'ct-angio',
    label: 'Angio (CTA)',
    description: 'Vascular / contrast-enhanced angiography.',
    cs3dPresetName: 'CT-Cardiac',
    voi: { windowCenter: 100, windowWidth: 700 },
  },
  {
    id: 'mip',
    label: 'MIP',
    description: 'Maximum-intensity projection — vessels, bone surveys.',
    cs3dPresetName: '',
    mip: true,
  },
];

export function getPresetById(id: Volume3DPresetId): Volume3DPreset {
  const found = VOLUME_3D_PRESETS.find((p) => p.id === id);
  return found ?? VOLUME_3D_PRESETS[1]; // default → soft tissue
}

export const DEFAULT_PRESET_ID: Volume3DPresetId = 'ct-soft-tissue';
