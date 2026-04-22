/**
 * CRViewport — Single DICOM viewport for the CR viewer.
 * - containerRef (w-full h-full relative): handles mouse events
 * - elementRef (absolute inset-0): Cornerstone render target
 * - COVER scale: image fills viewport with no black bars
 * - Draggable stamps
 */
import { useEffect, useRef, useCallback, memo } from 'react';
import { cornerstone } from '@/lib/cornerstoneSetup';
import { useCRViewerStore } from '@/stores/crViewerStore';


interface CRViewportProps {
  imageId: string | null;
  isSelected: boolean;
  viewportIndex: number;
  onClick: (e: React.MouseEvent) => void;
  spotNumber: number;
  showLogo: boolean;
}

function CRViewportInner({
  imageId,
  isSelected,
  viewportIndex,
  onClick,
  spotNumber,
  showLogo,
}: CRViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);
  const currentImageIdRef = useRef<string | null>(null);

  const { 
    isStampMode, activeStampId, placeStamp, stampPlacements, updateStampPlacement,
  } = useCRViewerStore();

  // Right-click W/L drag state
  const rightDragRef = useRef<{
    startX: number; startY: number; startWW: number; startWC: number;
  } | null>(null);

  // Stamp drag state
  const stampDragRef = useRef<{
    id: string; startX: number; startY: number;
    startXPct: number; startYPct: number;
  } | null>(null);

  // Enable cornerstone on mount
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    try {
      cornerstone.enable(el);
      enabledRef.current = true;
    } catch { /* may already be enabled */ }
    return () => {
      if (enabledRef.current && el) {
        try { cornerstone.disable(el); } catch { /* ignore */ }
        enabledRef.current = false;
      }
    };
  }, []);

  // Load image when imageId changes
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;

    if (!imageId) {
      currentImageIdRef.current = null;
      // Clear the canvas so no stale image shows behind the "No image" overlay
      try {
        const enabledEl = cornerstone.getEnabledElement(el);
        if (enabledEl?.canvas) {
          const ctx = enabledEl.canvas.getContext('2d');
          ctx?.clearRect(0, 0, enabledEl.canvas.width, enabledEl.canvas.height);
        }
      } catch { /* ignore */ }
      return;
    }

    if (imageId === currentImageIdRef.current) return;

    let cancelled = false;
    cornerstone.loadAndCacheImage(imageId).then((image: any) => {
      if (cancelled || !enabledRef.current) return;
      try {
        cornerstone.displayImage(el, image);
        cornerstone.resize(el, true);
        currentImageIdRef.current = imageId;
      } catch { /* ignore */ }
    }).catch(() => { /* ignore load failures */ });

    return () => { cancelled = true; };
  }, [imageId]);

  // Resize: refit image to window
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (enabledRef.current && currentImageIdRef.current) {
        try { cornerstone.resize(el, true); } catch { /* ignore */ }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---- MOUSE WHEEL = ZOOM (native, on container) ----
  useEffect(() => {
    const container = containerRef.current;
    const el = elementRef.current;
    if (!container || !el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabledRef.current) return;
      try {
        const vp = cornerstone.getViewport(el);
        if (!vp) return;
        const zoomDirection = e.deltaY > 0 ? -1 : 1;
        const zoomFactor = 1 + zoomDirection * 0.002 * Math.abs(e.deltaY);
        const newScale = Math.max(0.1, Math.min(10, vp.scale * zoomFactor));
        vp.scale = newScale;
        cornerstone.setViewport(el, vp);

        // Broadcast zoom sync to other selected viewports
        window.dispatchEvent(new CustomEvent('cr-viewport-sync', {
          detail: { type: 'scale', sourceIndex: viewportIndex, scale: newScale },
        }));
      } catch { /* ignore */ }
    };

    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handleWheel, true);
  }, []);

  // ---- GLOBAL MOUSE: W/L drag + stamp drag ----
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // W/L drag
      if (rightDragRef.current) {
        const el = elementRef.current;
        if (!el || !enabledRef.current) return;
        const dx = e.clientX - rightDragRef.current.startX;
        const dy = e.clientY - rightDragRef.current.startY;
        const newWW = Math.max(1, rightDragRef.current.startWW + dx * 3.0);
        const newWC = rightDragRef.current.startWC + dy * 2.0;
        try {
          const vp = cornerstone.getViewport(el);
          if (vp) {
            vp.voi = { windowWidth: newWW, windowCenter: newWC };
            cornerstone.setViewport(el, vp);

            // Broadcast W/L sync to other selected viewports
            window.dispatchEvent(new CustomEvent('cr-viewport-sync', {
              detail: { type: 'voi', sourceIndex: viewportIndex, windowWidth: newWW, windowCenter: newWC },
            }));
          }
        } catch { /* ignore */ }
        return;
      }

      // Stamp drag
      if (stampDragRef.current) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const dx = ((e.clientX - stampDragRef.current.startX) / rect.width) * 100;
        const dy = ((e.clientY - stampDragRef.current.startY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, stampDragRef.current.startXPct + dx));
        const newY = Math.max(0, Math.min(100, stampDragRef.current.startYPct + dy));
        updateStampPlacement(stampDragRef.current.id, newX, newY);
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        rightDragRef.current = null;
        document.body.style.cursor = '';
      }
      if (e.button === 0) {
        stampDragRef.current = null;
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [updateStampPlacement, viewportIndex]);

  // ---- RECEIVE SYNC EVENTS FROM OTHER SELECTED VIEWPORTS ----
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.sourceIndex === viewportIndex) return;
      const el = elementRef.current;
      if (!el || !enabledRef.current) return;
      // Only apply if this viewport is in the multi-select
      const { selectedViewportIndices } = useCRViewerStore.getState();
      if (!selectedViewportIndices.includes(viewportIndex)) return;
      try {
        const vp = cornerstone.getViewport(el);
        if (!vp) return;
        if (detail.type === 'scale') {
          vp.scale = detail.scale;
        } else if (detail.type === 'voi') {
          vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
        } else if (detail.type === 'translation') {
          vp.translation = detail.translation;
        } else if (detail.type === 'full') {
          vp.scale = detail.scale;
          vp.translation = detail.translation;
          if (detail.windowWidth != null && detail.windowCenter != null) {
            vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
          }
        }
        cornerstone.setViewport(el, vp);
      } catch { /* ignore */ }
    };
    window.addEventListener('cr-viewport-sync', handler);
    return () => window.removeEventListener('cr-viewport-sync', handler);
  }, [viewportIndex]);

  // ---- HANDLE RESET EVENTS (restore zoom, pan, W/L) ----
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // If viewportIndex is specified, only that one resets. Otherwise (Reset All), everyone resets.
      if (detail?.viewportIndex !== undefined && detail.viewportIndex !== viewportIndex) return;

      const el = elementRef.current;
      if (!el || !enabledRef.current) return;

      try {
        const enabledEl = cornerstone.getEnabledElement(el);
        const image = enabledEl?.image;
        if (image) {
          const wc = Array.isArray(image.windowCenter) ? image.windowCenter[0] : (image.windowCenter ?? 127);
          const ww = Array.isArray(image.windowWidth) ? image.windowWidth[0] : (image.windowWidth ?? 255);
          let defaultScale = 1;
          try {
            const defaultVp = cornerstone.getDefaultViewportForImage(el, image);
            if (defaultVp?.scale) defaultScale = defaultVp.scale;
          } catch { /* ignore */ }
          // Explicitly pass a fresh viewport so cornerstone cannot reuse the modified one
          cornerstone.displayImage(el, image, {
            scale: defaultScale,
            translation: { x: 0, y: 0 },
            voi: { windowCenter: wc, windowWidth: ww },
            rotation: 0,
            hflip: false,
            vflip: false,
            invert: false,
            pixelReplication: false,
            labelmap: false,
          });
        } else {
          cornerstone.resize(el, true);
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('cr-custom-reset', handler);
    return () => window.removeEventListener('cr-custom-reset', handler);
  }, [viewportIndex]);

  // ---- MOUSE DOWN on container (right-click = W/L drag) ----
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 2) return;
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;
    e.preventDefault();
    try {
      const vp = cornerstone.getViewport(el);
      if (vp?.voi) {
        rightDragRef.current = {
          startX: e.clientX, startY: e.clientY,
          startWW: vp.voi.windowWidth, startWC: vp.voi.windowCenter,
        };
        document.body.style.cursor = 'crosshair';
      }
    } catch { /* ignore */ }
  }, []);

  // Handle click — stamp placement or viewport selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    // If a stamp drag just happened, don't treat as click
    if (stampDragRef.current) return;
    if (isStampMode && activeStampId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        placeStamp(viewportIndex, xPercent, yPercent);
      }
      return;
    }
    onClick(e);
  }, [isStampMode, activeStampId, placeStamp, viewportIndex, onClick]);

  // Filter stamp placements for this viewport
  const viewportStamps = stampPlacements.filter(s => s.viewportIndex === viewportIndex);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative bg-black overflow-hidden ${isStampMode ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseDownCapture={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={handleClick}
    >
      {/* Cornerstone render target */}
      <div
        ref={elementRef}
        data-cr-viewport-index={viewportIndex}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Stamp overlays — draggable */}
      {viewportStamps.map((sp) => (
        <div
          key={sp.id}
          className="absolute z-10 select-none"
          style={{
            left: `${sp.xPercent}%`,
            top: `${sp.yPercent}%`,
            transform: 'translate(-50%, -50%)',
            color: sp.color,
            fontSize: `${sp.fontSize}px`,
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            cursor: 'grab',
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation(); // don't trigger W/L or viewport click
            stampDragRef.current = {
              id: sp.id,
              startX: e.clientX,
              startY: e.clientY,
              startXPct: sp.xPercent,
              startYPct: sp.yPercent,
            };
          }}
          onClick={(e) => e.stopPropagation()} // prevent re-placing stamp on click
        >
          {sp.text}
        </div>
      ))}

      {/* Spot number indicator */}
      <div className="absolute bottom-1 left-1 text-white text-xs font-bold opacity-60 select-none pointer-events-none z-10">
        {spotNumber}
      </div>

      {/* No image placeholder */}
      {!imageId && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs select-none pointer-events-none z-10">
          No image
        </div>
      )}
    </div>
  );
}

export const CRViewport = memo(CRViewportInner);
