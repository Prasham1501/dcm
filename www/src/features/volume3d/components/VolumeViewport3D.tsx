/**
 * VolumeViewport3D — single GPU volume-rendered viewport.
 *
 * Wraps cs3d's VOLUME_3D viewport type and attaches the trackball
 * (rotate), zoom and pan tools. The volume itself is loaded by the
 * parent page (`Volume3DPage`) and passed in via `volumeId`.
 */
import { useEffect, useRef } from 'react';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import { cornerstone3D, cornerstone3DTools } from '../lib/cs3dInit';
import { useVolume3DStore } from '../stores/volume3DStore';
import { detectGpu, sampleDistanceMultiplierForTier } from '../lib/gpu';

export interface VolumeViewport3DProps {
  renderingEngineId: string;
  viewportId: string;
  volumeId: string | null;
  toolGroupId: string;
  /** Active cs3d preset name; '' means leave default. */
  presetName?: string;
  /** Whether MIP blend mode should be active. */
  mip?: boolean;
}

export function VolumeViewport3D({
  renderingEngineId, viewportId, volumeId, toolGroupId, presetName, mip,
}: VolumeViewport3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Wire the viewport into the engine once the container is mounted.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const engine = cornerstone3D.getRenderingEngine(renderingEngineId);
    if (!engine) return;

    engine.enableElement({
      viewportId,
      type: cornerstone3D.Enums.ViewportType.VOLUME_3D,
      element: el,
      defaultOptions: {
        background: [0, 0, 0],
        orientation: cornerstone3D.Enums.OrientationAxis.CORONAL,
      },
    });

    // Add this viewport to the shared tool group so trackball / zoom /
    // pan all act on it.
    const toolGroup = cornerstone3DTools.ToolGroupManager.getToolGroup(toolGroupId);
    toolGroup?.addViewport(viewportId, renderingEngineId);

    // Mouse-wheel = zoom. cs3d's wheel binding drives slice-scroll (only
    // meaningful for MPR), and the ZoomTool is a click-drag tool — neither
    // gives "scroll to zoom" on a 3D volume. So we dolly the camera
    // ourselves: scroll up → move toward the focal point (zoom in),
    // scroll down → move away (zoom out).
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return;
      // Only handle wheels that happen over THIS viewport's element.
      if (!el.contains(e.target as Node)) return;
      // Stop cs3d's own wheel handling AND the page from scrolling.
      e.preventDefault();
      e.stopPropagation();
      const vp = engine.getViewport(viewportId) as any;
      if (!vp?.getCamera || !vp?.setCamera) return;
      const cam = vp.getCamera();
      const focal = cam.focalPoint as [number, number, number];
      const pos = cam.position as [number, number, number];
      // 10% per wheel notch; scrolling down (deltaY > 0) zooms out.
      const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const np: [number, number, number] = [
        focal[0] + (pos[0] - focal[0]) * factor,
        focal[1] + (pos[1] - focal[1]) * factor,
        focal[2] + (pos[2] - focal[2]) * factor,
      ];
      vp.setCamera({ ...cam, position: np });
      vp.render();
    };
    // Attach at the DOCUMENT level in the capture phase. cs3d registers its
    // own wheel listener on the canvas and can stopPropagation before a
    // listener on our container ever fires (this is why scroll-to-zoom
    // worked via synthetic events in dev but not in packaged Electron).
    // Document-capture runs before any of cs3d's listeners.
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });

    // Keep the cs3d canvas matched to the container size. The viewport is
    // enabled before the flex/absolute layout settles, so without this the
    // canvas can stick at its 300x150 default. Also handles the Electron
    // window (85% of screen) and later resizes.
    //
    // IMPORTANT: only reset the camera on the FIRST sizing. Resetting on
    // every resize would throw away the user's zoom/rotation whenever the
    // window changed size by even a pixel.
    let rafId = 0;
    let firstSize = true;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          // resize(immediate, keepCamera) — keep the user's camera on every
          // resize; only the first sizing explicitly resets/centres it.
          engine.resize(true, true);
          if (firstSize) {
            firstSize = false;
            const vp = engine.getViewport(viewportId) as any;
            vp?.resetCamera?.();
            vp?.render?.();
          }
        } catch { /* ignore */ }
      });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      try { ro.disconnect(); } catch { /* ignore */ }
      document.removeEventListener('wheel', onWheel, { capture: true } as any);
      try {
        toolGroup?.removeViewports(renderingEngineId, viewportId);
      } catch { /* ignore */ }
      try { engine.disableElement(viewportId); } catch { /* ignore */ }
    };
  }, [renderingEngineId, viewportId, toolGroupId]);

  // Re-attach the volume + preset whenever they change.
  useEffect(() => {
    if (!volumeId) return;
    const engine = cornerstone3D.getRenderingEngine(renderingEngineId);
    if (!engine) return;
    const vp = engine.getViewport(viewportId) as any;
    if (!vp) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // Race-safe: the page-level effect may set `volumeId` before this
    // component's enableElement effect has finished registering the
    // viewport. Poll up to ~1.5 s for the viewport to appear before
    // giving up — keeps the cs3d/React render orders decoupled.
    (async () => {
      let viewport: any = vp;
      for (let i = 0; i < 30 && !viewport; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
        viewport = engine.getViewport(viewportId);
      }
      if (!viewport) {
        useVolume3DStore.getState().setStatus('error', 'Failed to attach volume — viewport not ready');
        return;
      }
      try {
        await viewport.setVolumes([{ volumeId }]);
        if (cancelled) return;

        // Always apply the transfer-function preset first (CT-Bone,
        // CT-Soft-Tissue, …, or CT-MIP for the MIP entry). A VOLUME_3D
        // viewport renders BLACK without an opacity/colour transfer
        // function — this must run for MIP too (previously it was skipped,
        // which is why selecting MIP produced a black viewport).
        if (presetName) {
          await viewport.setProperties({ preset: presetName });
        }

        const Enums = (cornerstone3D as any).Enums;
        const BlendModes = Enums?.BlendModes
          ?? (cornerstone3D as any).CONSTANTS?.BlendModes
          ?? {};
        const targetBlend = mip
          ? (BlendModes.MAXIMUM_INTENSITY_BLEND ?? 1)
          : (BlendModes.COMPOSITE ?? 0);
        const sampleMult = sampleDistanceMultiplierForTier(detectGpu().tier);
        // Resolve the volume actor + mapper. `getActor(volumeId)` only works when the
        // actor UID equals our volumeId, which is NOT guaranteed — in the
        // packaged build it returned null, so autoAdjust never got disabled
        // and the volume stayed coarse/striped. Fall back to the first actor.
        const getActor = () =>
          (viewport.getActor?.(volumeId)?.actor || viewport.getActors?.()?.[0]?.actor);
        const getMapper = () => getActor()?.getMapper?.();

        // ── Force SOLID, full-quality rendering ──────────────────────────
        // cs3d defaults to autoAdjustSampleDistances = true: it renders a
        // COARSE pass while the camera moves and is supposed to refine to
        // full quality once it settles. In packaged Electron that refine
        // pass doesn't reliably fire, so the coarse (striped/"venetian
        // blind") frame stays on screen. We:
        //   1. set blend mode (MIP vs composite),
        //   2. turn auto-adjust OFF so every frame is full sample distance,
        //   3. force LINEAR voxel interpolation (NEAREST shows each slice as
        //      a flat slab with empty gaps between them on CT volumes whose
        //      slice spacing > slice thickness),
        //   4. set an absolute sample distance = ½ × smallest voxel spacing.
        //      A relative multiplier alone can step *past* a slice on CTs
        //      with 2-5 mm spacing, producing visible empty bands between
        //      slices ("stack of disconnected layers" complaint).
        // All wrapped so it can be re-asserted later (see CAMERA_MODIFIED).
        const applyCrisp = (): boolean => {
          const actor = getActor();
          const m = actor?.getMapper?.();
          if (!m) return false;
          try {
            if (typeof viewport.setBlendMode === 'function') viewport.setBlendMode(targetBlend);
            else if (m.setBlendMode) m.setBlendMode(targetBlend);
          } catch { /* ignore */ }
          try { if (m.setAutoAdjustSampleDistances) m.setAutoAdjustSampleDistances(false); } catch { /* ignore */ }
          // Trilinear voxel interpolation on the actor's image property —
          // VTK defaults to LINEAR but cs3d/some presets flip it to NEAREST,
          // which renders each slice as a hard slab and gives the
          // "disconnected horizontal bands" appearance on coarse-spaced CTs.
          try {
            const prop = actor?.getProperty?.();
            if (prop?.setInterpolationTypeToLinear) prop.setInterpolationTypeToLinear();
            else if (prop?.setInterpolationType) prop.setInterpolationType(1); // 1 == LINEAR in vtk
          } catch { /* ignore */ }
          try { if (!mip) suppressSlicePlaneOpacity(actor, presetName); } catch { /* ignore */ }
          // Absolute sample distance — derive from the volume's smallest
          // axis spacing so each ray step is guaranteed finer than the
          // inter-slice gap. Falls back to the relative multiplier API
          // when the mapper doesn't expose setSampleDistance.
          try {
            const img = m.getInputData?.();
            const spacing = img?.getSpacing?.() as number[] | undefined;
            if (spacing && spacing.length === 3) {
              const minSp = Math.min(spacing[0], spacing[1], spacing[2]);
              if (Number.isFinite(minSp) && minSp > 0 && m.setSampleDistance) {
                m.setSampleDistance(minSp * 0.5);
              }
            }
          } catch { /* ignore */ }
          try {
            if (typeof viewport.setSampleDistanceMultiplier === 'function') {
              viewport.setSampleDistanceMultiplier(sampleMult);
            }
          } catch { /* ignore */ }
          return true;
        };

        // Retry until the actor/mapper exists. In Electron the actor can be
        // momentarily unavailable right after setVolumes — that timing gap is
        // exactly why the striping fix worked in the dev browser but not in
        // the packaged build.
        for (let i = 0; i < 25 && !applyCrisp(); i++) {
          await new Promise((r) => setTimeout(r, 40));
          if (cancelled) return;
        }

        // Re-assert crisp rendering when interaction settles. Debounced so
        // the expensive full-quality re-render only happens once motion stops.
        // Triggered by cs3d's CAMERA_MODIFIED AND raw pointerup/wheel (so it
        // works even if the cs3d event name differs across versions).
        const CAMERA_MODIFIED = Enums?.Events?.CAMERA_MODIFIED ?? 'CORNERSTONE_CAMERA_MODIFIED';
        let settleTimer: any = 0;
        const settle = () => {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(() => {
            applyCrisp();
            try { viewport.render(); } catch { /* ignore */ }
          }, 130);
        };
        const el2 = viewport.element as HTMLElement | undefined;
        try { el2?.addEventListener(CAMERA_MODIFIED, settle); } catch { /* ignore */ }
        try { el2?.addEventListener('pointerup', settle); } catch { /* ignore */ }
        try { el2?.addEventListener('wheel', settle, { passive: true }); } catch { /* ignore */ }
        cleanup = () => {
          clearTimeout(settleTimer);
          try { el2?.removeEventListener(CAMERA_MODIFIED, settle); } catch { /* ignore */ }
          try { el2?.removeEventListener('pointerup', settle); } catch { /* ignore */ }
          try { el2?.removeEventListener('wheel', settle); } catch { /* ignore */ }
        };

        // ── "Ready" signal: only mark the viewer usable once the FIRST
        // frame has actually been drawn (GPU upload + ray cast done), not
        // when setVolumes resolves. Keeps the progress UI up until the
        // image is really on screen. Attach the listener BEFORE render so
        // we can't miss the event; a timeout fallback guarantees it can
        // never get stuck if the event name differs across cs3d versions.
        const EventsNS = (cornerstone3D as any).Enums?.Events;
        const RENDERED = EventsNS?.IMAGE_RENDERED ?? 'CORNERSTONE_IMAGE_RENDERED';
        let done = false;
        const markReady = () => {
          if (done) return;
          done = true;
          try { viewport.element?.removeEventListener(RENDERED, markReady); } catch { /* ignore */ }
          // CRUCIAL: re-assert crisp rendering HERE. cs3d sets
          // autoAdjustSampleDistances=true during its own actor init, which
          // runs AFTER the early applyCrisp() above — so the early call gets
          // clobbered (verified via CDP: autoAdjust read `true` at rest).
          // Re-applying after the first render makes it stick, so the volume
          // stays solid even on a slower GPU / larger window where auto-adjust
          // would otherwise pick a coarse (striped) sample distance at rest.
          applyCrisp();
          try { viewport.render(); } catch { /* ignore */ }
          if (useVolume3DStore.getState().status === 'rendering') {
            useVolume3DStore.getState().setStatus('loaded');
          }
        };
        try { viewport.element?.addEventListener(RENDERED, markReady); } catch { /* ignore */ }
        setTimeout(markReady, 2500);

        viewport.render();
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[VolumeViewport3D] setVolumes failed', err);
        useVolume3DStore.getState().setStatus('error', err?.message || 'setVolumes failed');
      }
    })();

    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, [renderingEngineId, viewportId, volumeId, presetName, mip]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black"
      // cs3d / vtk.js needs the canvas to fill the parent — the parent
      // (grid cell) controls actual size.
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

interface OpacityNode {
  x: number;
  y: number;
  midpoint: number;
  sharpness: number;
}

interface OpacityMaskConfig {
  cutoff: number;
  rampEnd: number;
}

interface CachedOpacityCurve {
  presetName: string;
  rangeKey: string;
  nodes: OpacityNode[];
}

/**
 * The stock CT-Bone preset leaves a faint opacity ramp for low/background
 * values. Across a stack that becomes visible as rectangular slice sheets
 * around the skull. Keep the preset color/shading, but force those background
 * values fully transparent before ramping into anatomy.
 */
function suppressSlicePlaneOpacity(actor: any, presetName?: string): void {
  const property = actor?.getProperty?.();
  const opacity = property?.getScalarOpacity?.(0);
  if (!property || !opacity) return;

  const scalarRange = getScalarRange(actor);
  const rangeKey = scalarRange ? `${roundKey(scalarRange[0])}:${roundKey(scalarRange[1])}` : 'unknown';
  const cacheKey = '__oneClickzVolume3DBaseOpacity';
  let cached = actor[cacheKey] as CachedOpacityCurve | undefined;

  if (!cached || cached.presetName !== (presetName ?? '') || cached.rangeKey !== rangeKey) {
    const nodes = readOpacityNodes(opacity);
    if (nodes.length < 2) return;
    cached = { presetName: presetName ?? '', rangeKey, nodes };
    actor[cacheKey] = cached;
  }

  const config = getOpacityMaskConfig(presetName, scalarRange, cached.nodes);
  if (!config || config.rampEnd <= config.cutoff) return;

  const masked = vtkPiecewiseFunction.newInstance();
  for (const x of buildOpacitySamplePoints(cached.nodes, config)) {
    const baseOpacity = evaluateOpacity(cached.nodes, x);
    masked.addPoint(x, baseOpacity * opacityMask(x, config));
  }
  property.setScalarOpacity(0, masked);
  property.setUseGradientOpacity?.(0, true);
}

function readOpacityNodes(opacity: any): OpacityNode[] {
  const size = opacity.getSize?.() ?? 0;
  const nodes: OpacityNode[] = [];
  for (let i = 0; i < size; i += 1) {
    const node = [0, 0, 0.5, 0];
    opacity.getNodeValue?.(i, node);
    if (Number.isFinite(node[0]) && Number.isFinite(node[1])) {
      nodes.push({ x: node[0], y: node[1], midpoint: node[2] ?? 0.5, sharpness: node[3] ?? 0 });
    }
  }
  return nodes.sort((a, b) => a.x - b.x);
}

function getScalarRange(actor: any): [number, number] | null {
  const range = actor
    ?.getMapper?.()
    ?.getInputData?.()
    ?.getPointData?.()
    ?.getScalars?.()
    ?.getRange?.();
  if (!Array.isArray(range) || range.length < 2) return null;
  const min = Number(range[0]);
  const max = Number(range[1]);
  return Number.isFinite(min) && Number.isFinite(max) && max > min ? [min, max] : null;
}

function getOpacityMaskConfig(
  presetName: string | undefined,
  scalarRange: [number, number] | null,
  nodes: OpacityNode[],
): OpacityMaskConfig | null {
  const nodeMin = nodes[0]?.x;
  const nodeMax = nodes[nodes.length - 1]?.x;
  if (!Number.isFinite(nodeMin) || !Number.isFinite(nodeMax) || nodeMax <= nodeMin) return null;

  const min = scalarRange?.[0] ?? nodeMin;
  const max = scalarRange?.[1] ?? nodeMax;
  const width = max - min;
  const looksLikeHu = min < -500;
  const looksLikeRawCt = min >= 0 && max > 1000;

  if (presetName === 'CT-Bone') {
    if (looksLikeRawCt) {
      return { cutoff: min + width * 0.24, rampEnd: min + width * 0.44 };
    }
    return looksLikeHu
      ? { cutoff: 420, rampEnd: 680 }
      : { cutoff: min + width * 0.36, rampEnd: min + width * 0.52 };
  }

  if (presetName === 'CT-Cardiac' || presetName === 'CT-MIP') {
    return looksLikeHu
      ? { cutoff: 50, rampEnd: 180 }
      : { cutoff: min + width * 0.08, rampEnd: min + width * 0.18 };
  }

  if (presetName === 'CT-Lung') {
    return looksLikeHu
      ? { cutoff: -980, rampEnd: -820 }
      : { cutoff: min + width * 0.01, rampEnd: min + width * 0.08 };
  }

  return looksLikeHu
    ? { cutoff: -260, rampEnd: -80 }
    : { cutoff: min + width * 0.04, rampEnd: min + width * 0.14 };
}

function buildOpacitySamplePoints(nodes: OpacityNode[], config: OpacityMaskConfig): number[] {
  const first = nodes[0].x;
  const last = nodes[nodes.length - 1].x;
  const points = [
    first,
    ...nodes.map((node) => node.x),
    config.cutoff,
    config.rampEnd,
    last,
  ].filter((x) => Number.isFinite(x) && x >= first && x <= last);
  return Array.from(new Set(points.map(roundKey))).sort((a, b) => a - b);
}

function evaluateOpacity(nodes: OpacityNode[], x: number): number {
  if (x <= nodes[0].x) return nodes[0].y;
  for (let i = 1; i < nodes.length; i += 1) {
    const left = nodes[i - 1];
    const right = nodes[i];
    if (x <= right.x) {
      const span = right.x - left.x;
      const t = span > 0 ? (x - left.x) / span : 0;
      return left.y + (right.y - left.y) * t;
    }
  }
  return nodes[nodes.length - 1].y;
}

function opacityMask(x: number, config: OpacityMaskConfig): number {
  if (x <= config.cutoff) return 0;
  if (x >= config.rampEnd) return 1;
  return (x - config.cutoff) / (config.rampEnd - config.cutoff);
}

function roundKey(value: number): number {
  return Math.round(value * 1000) / 1000;
}
