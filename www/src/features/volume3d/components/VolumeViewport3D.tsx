/**
 * VolumeViewport3D — single GPU volume-rendered viewport.
 *
 * Wraps cs3d's VOLUME_3D viewport type and attaches the trackball
 * (rotate), zoom and pan tools. The volume itself is loaded by the
 * parent page (`Volume3DPage`) and passed in via `volumeId`.
 */
import { useEffect, useRef } from 'react';
import { cornerstone3D, cornerstone3DTools } from '../lib/cs3dInit';
import { useVolume3DStore } from '../stores/volume3DStore';

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

    return () => {
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

        if (mip) {
          const actorEntry = viewport.getActor(volumeId);
          const mapper = actorEntry?.actor?.getMapper?.();
          const Constants = (cornerstone3D as any).CONSTANTS;
          const BLEND = Constants?.BlendModes?.MAXIMUM_INTENSITY_BLEND ?? 1;
          if (mapper?.setBlendMode) mapper.setBlendMode(BLEND);
        } else if (presetName) {
          await viewport.setProperties({ preset: presetName });
        }
        viewport.render();
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[VolumeViewport3D] setVolumes failed', err);
        useVolume3DStore.getState().setStatus('error', err?.message || 'setVolumes failed');
      }
    })();

    return () => { cancelled = true; };
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
