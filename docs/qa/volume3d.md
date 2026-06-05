# 3D Volume Viewer — QA Checklist

> Route: `/volume-3d` (Electron window `volumeViewerWindow`, opened from
> the Viewer / CR / Dual toolbars via the **3D** button).

## Scope

Cornerstone3D-based GPU volume renderer (VR + synced MPR) added in
Phases 0–6 of the project plan. This document captures the manual smoke
tests a clinical reviewer should run before each release, plus the
known limitations and where to look when a study fails to load.

## Prerequisites

- Multi-slice **CT** series (≥ 20 slices, `Modality = CT`). MR is also
  accepted by the eligibility check but most QA is run on CT chest /
  abdomen.
- WebGL2-capable GPU. The renderer process logs the result of the
  WebGL2 probe in DevTools (`isWebGL2Supported()`).
- Electron build started (`npm run start` in `desktop-version/electron`
  or the full installer), or `npm run dev` in `www/` with PHP on
  `http://localhost:8080`.

## Launch flow

| Step | Expected |
|------|----------|
| 1. Open a CT study in the main Viewer. | `3D` button (cube icon) appears in the header toolbar next to `Form F`. |
| 2. Hover the disabled `3D` button on a CR/US study. | Button is **hidden**, not greyed out. |
| 3. Open a CT with `< 20` slices. | Button is greyed out with tooltip *"Need at least 20 slices to reconstruct a volume."* |
| 4. Click `3D` on a valid CT. | New `volumeViewerWindow` opens at `/volume-3d`. |
| 5. Trigger again from the same study. | Existing window is focused (no second window) and reloads the launch payload. |
| 6. Trigger from CR Viewer + Dual Viewer toolbars. | Same flow; Dual uses the **active panel's** patient/modality. |

## Loading

| Step | Expected |
|------|----------|
| Volume3DPage mounts. | Status overlay: *"Loading volume… N% (X / Y slices)"* with spinner. |
| Load completes. | Overlay disappears; VR pane on the left, MPR axial/coronal/sagittal panes on the right (quad layout). |
| Some slices fail to decode. | Amber pill in the **top-right** corner: *"N slices failed to load"*. Volume still renders. |
| Series > ~1600 slices (≈ 800 MB est.). | Status overlay shows error: *"Volume too large (~XXX MB)…"*. |
| Study modality changes mid-session via reload-launch. | Page resets, runs eligibility, loads new volume. |

## Tools (default bindings)

| Mouse / key | Action |
|-------------|--------|
| Left-drag (VR pane) | Trackball rotate. |
| Left-drag (MPR pane) | Crosshair scrub — all three MPR panes follow. |
| Middle-drag | Pan. |
| Right-drag | Zoom. |
| Wheel | Stack scroll (slice through volume). |
| `R` | Reset cameras + clear VOI override + opacity = 100%. |
| `1` … `5` | Switch preset: Bone / Soft-Tissue / Lung / Angio / MIP. |

## Toolbar

| Control | Expected |
|---------|----------|
| **Preset** dropdown | Bone / Soft-Tissue / Lung / Angio / MIP. Switching MIP toggles `MAXIMUM_INTENSITY_BLEND` on the VR actor. |
| **W/L** numeric inputs | Override the preset's window centre / width in HU. Applies to VR + all three MPR panes. |
| **Opacity** slider | 0–100% — adjusts `scalarOpacityUnitDistance` on the volume actor (lower distance → more opaque). |
| **Layout** toggle | Quad ↔ VR-only. VR-only hides the MPR column. |
| **Orbit** toggle | Auto-rotates the VR camera around the view-up axis at ~30°/sec. Cleanly cancels via the same button or on layout change. |
| **Reset** | Resets all viewport cameras + clears VOI override + opacity = 100%. |
| **Capture** | Downloads the current VR canvas as `volume3d_<patientId>_<patientName>_<ISO-stamp>.png`. |

## Orientation labels

Each MPR pane shows amber edge letters:

| Plane    | Top | Bottom | Left | Right |
|----------|-----|--------|------|-------|
| Axial    | A   | P      | R    | L     |
| Coronal  | S   | I      | R    | L     |
| Sagittal | S   | I      | A    | P     |

If any of these contradict the underlying acquisition, **do not report**
from the 3D viewer — fall back to the 2D viewer and raise a ticket.

## Disposal / memory

- Closing the volume window destroys the `RenderingEngine`, removes the
  ToolGroup, and drops the volume from cs3d's cache (`disposeVolume`).
- A long-running Electron session opening many studies should not see
  GPU memory creep — verify with Task Manager (GPU column) over a
  30-minute walkthrough.

## Known limitations

- **No orientation cube widget** — only flat edge labels (see table
  above). vtk.js orientation marker widget is a future-Phase polish item.
- **No interactive crop / clip plane.** Use stack-scroll on the MPR
  panes for now.
- **Capture goes to a downloaded PNG**, not directly into the print
  service. Drag-drop the downloaded file into the report editor.
- **CT/MR only** — the eligibility check intentionally excludes US,
  CR, DX, MG, NM, XA, even though cs3d can render any volume.
- **Single-frame multi-frame DICOM** is loaded as-is — the wadouri
  loader extracts frames via cs3d's standard pipeline; no special
  handling for enhanced multi-frame DICOM yet.

## Test data

Place reference CT series at:

```
test-dicom-samples/ct-series/
  ├── 0001.dcm
  ├── 0002.dcm
  └── ...
```

LIDC-IDRI or the TCIA chest CT subset (≈ 100–500 slices) is a good
fit. Subjects should be fully de-identified before checking in.

## Automated tests

```
cd www
npm test            # one-shot
npm run test:watch  # development
```

Coverage today (`src/features/volume3d/lib/__tests__/`):

- `eligibility.test.ts` — modality / slice / WebGL2 guard logic.
- `presets.test.ts` — HU window ranges + fallback behaviour.
- `buildVolume.test.ts` — byte estimator + cache-key derivation.

cs3d-dependent code (`Volume3DPage`, `VolumeViewport3D`, `MprViewports`)
is exercised by the manual flow above; an end-to-end Playwright run
against `/volume-3d` with a launch payload is a future addition.

## Diagnostics

When the page errors out, open DevTools (`F12`) in the
`volumeViewerWindow` and grep for:

- `[Volume3DPage]` — page-level lifecycle / capture failures.
- `[MprPane]` — per-pane setVolumes errors.
- `[openVolume3D]` — Electron IPC fallback path.

The launch payload itself lives in `localStorage['volume-3d-launch']`
for up to 30 seconds and is consumed exactly once.
