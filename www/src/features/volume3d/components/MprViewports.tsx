/**
 * MprViewports — three orthographic viewports (axial / coronal / sagittal)
 * sharing the same volumeId as the VR viewport. cs3d reuses the GPU
 * texture across viewports so memory cost is ~free.
 *
 * The shared ToolGroup gives them linked CrosshairsTool, StackScrollTool,
 * WindowLevelTool, PanTool and ZoomTool.
 */
import { useEffect, useRef } from 'react';
import { cornerstone3D, cornerstone3DTools } from '../lib/cs3dInit';

interface MprPaneProps {
  renderingEngineId: string;
  viewportId: string;
  volumeId: string | null;
  toolGroupId: string;
  orientation: 'AXIAL' | 'CORONAL' | 'SAGITTAL';
  label: string;
}

/** Anatomical edge labels for each orientation. DICOM patient
 *  coordinate system: +X = Left, +Y = Posterior, +Z = Superior.
 *  These letters help the radiologist verify orientation at a glance —
 *  catching gantry-tilt or flipped acquisitions before they report. */
const EDGE_LABELS: Record<'AXIAL' | 'CORONAL' | 'SAGITTAL',
  { top: string; bottom: string; left: string; right: string }> = {
  AXIAL:    { top: 'A', bottom: 'P', left: 'R', right: 'L' },
  CORONAL:  { top: 'S', bottom: 'I', left: 'R', right: 'L' },
  SAGITTAL: { top: 'S', bottom: 'I', left: 'A', right: 'P' },
};

function MprPane({ renderingEngineId, viewportId, volumeId, toolGroupId, orientation, label }: MprPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const engine = cornerstone3D.getRenderingEngine(renderingEngineId);
    if (!engine) return;

    const orientationAxis = (cornerstone3D.Enums.OrientationAxis as any)[orientation];

    engine.enableElement({
      viewportId,
      type: cornerstone3D.Enums.ViewportType.ORTHOGRAPHIC,
      element: el,
      defaultOptions: {
        background: [0, 0, 0],
        orientation: orientationAxis,
      },
    });

    const toolGroup = cornerstone3DTools.ToolGroupManager.getToolGroup(toolGroupId);
    toolGroup?.addViewport(viewportId, renderingEngineId);

    return () => {
      try { toolGroup?.removeViewports(renderingEngineId, viewportId); } catch { /* ignore */ }
      try { engine.disableElement(viewportId); } catch { /* ignore */ }
    };
  }, [renderingEngineId, viewportId, toolGroupId, orientation]);

  useEffect(() => {
    if (!volumeId) return;
    const engine = cornerstone3D.getRenderingEngine(renderingEngineId);
    if (!engine) return;
    const vp = engine.getViewport(viewportId) as any;
    if (!vp) return;
    let cancelled = false;
    (async () => {
      try {
        await vp.setVolumes([{ volumeId }]);
        if (cancelled) return;
        vp.render();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[MprPane] setVolumes failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [renderingEngineId, viewportId, volumeId]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="absolute inset-0" onContextMenu={(e) => e.preventDefault()} />
      <div className="absolute top-1 left-2 text-[10px] font-bold text-app-accent uppercase pointer-events-none select-none">
        {label}
      </div>
      {/* Anatomical edge labels — verify orientation at a glance. */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-300/80 pointer-events-none select-none">
        {EDGE_LABELS[orientation].top}
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-300/80 pointer-events-none select-none">
        {EDGE_LABELS[orientation].bottom}
      </div>
      <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-300/80 pointer-events-none select-none">
        {EDGE_LABELS[orientation].left}
      </div>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-300/80 pointer-events-none select-none">
        {EDGE_LABELS[orientation].right}
      </div>
    </div>
  );
}

export interface MprViewportsProps {
  renderingEngineId: string;
  volumeId: string | null;
  toolGroupId: string;
}

export function MprViewports({ renderingEngineId, volumeId, toolGroupId }: MprViewportsProps) {
  return (
    <>
      <MprPane
        renderingEngineId={renderingEngineId}
        viewportId="cs3d-mpr-axial"
        volumeId={volumeId}
        toolGroupId={toolGroupId}
        orientation="AXIAL"
        label="Axial"
      />
      <MprPane
        renderingEngineId={renderingEngineId}
        viewportId="cs3d-mpr-coronal"
        volumeId={volumeId}
        toolGroupId={toolGroupId}
        orientation="CORONAL"
        label="Coronal"
      />
      <MprPane
        renderingEngineId={renderingEngineId}
        viewportId="cs3d-mpr-sagittal"
        volumeId={volumeId}
        toolGroupId={toolGroupId}
        orientation="SAGITTAL"
        label="Sagittal"
      />
    </>
  );
}

export const MPR_VIEWPORT_IDS = [
  'cs3d-mpr-axial',
  'cs3d-mpr-coronal',
  'cs3d-mpr-sagittal',
];
