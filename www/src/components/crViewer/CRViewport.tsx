/**
 * CRViewport — Single DICOM viewport for the CR viewer.
 * - containerRef (w-full h-full relative): handles mouse events
 * - elementRef (absolute inset-0): Cornerstone render target
 * - COVER scale: image fills viewport with no black bars
 * - Draggable stamps
 */
import { useEffect, useRef, useCallback, memo, useState } from 'react';
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
    isStampMode, stampPlacements, updateStampPlacement, updateStampPlacementProps,
    placeStampDirect,
  } = useCRViewerStore();

  // Editing stamp state (double-click)
  const [editingStamp, setEditingStamp] = useState<{ id: string; color: string; fontSize: number } | null>(null);

  // Pending stamp popup (click-to-place with presets, same as DicomViewport)
  const [pendingStamp, setPendingStamp] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [stampText, setStampText] = useState('');
  const [stampColor, setStampColor] = useState('#ff0000');
  const [stampFontSize, setStampFontSize] = useState(14);

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

        const { selectedViewportIndices } = useCRViewerStore.getState();
        if (selectedViewportIndices.length > 1 && selectedViewportIndices.includes(viewportIndex)) {
          // Broadcast zoom only for true multi-select interactions.
          window.dispatchEvent(new CustomEvent('cr-viewport-sync', {
            detail: { type: 'scale', sourceIndex: viewportIndex, scale: newScale },
          }));
        }
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

            const { selectedViewportIndices } = useCRViewerStore.getState();
            if (selectedViewportIndices.length > 1 && selectedViewportIndices.includes(viewportIndex)) {
              // Broadcast W/L only for true multi-select interactions.
              window.dispatchEvent(new CustomEvent('cr-viewport-sync', {
                detail: { type: 'voi', sourceIndex: viewportIndex, windowWidth: newWW, windowCenter: newWC },
              }));
            }
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
      if (selectedViewportIndices.length <= 1 || !selectedViewportIndices.includes(viewportIndex)) return;
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
    if (isStampMode && imageId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingStamp({ xPercent, yPercent });
      }
      return;
    }
    onClick(e);
  }, [isStampMode, imageId, onClick]);

  const handlePlaceStamp = useCallback(() => {
    if (!pendingStamp || !stampText.trim()) return;
    placeStampDirect(viewportIndex, pendingStamp.xPercent, pendingStamp.yPercent, stampText.trim(), stampColor, stampFontSize);
    setPendingStamp(null);
    setStampText('');
  }, [pendingStamp, stampText, stampColor, stampFontSize, viewportIndex, placeStampDirect]);

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
          className="absolute z-10 select-none group"
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
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingStamp({ id: sp.id, color: sp.color, fontSize: sp.fontSize });
          }}
        >
          <span className="inline-block px-1.5 py-0.5 rounded border-2 border-current uppercase tracking-wider"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            {sp.text}
          </span>
        </div>
      ))}

      {/* Edit stamp popup (double-click) */}
      {editingStamp && (() => {
        const sp = viewportStamps.find(s => s.id === editingStamp.id);
        if (!sp) return null;
        return (
          <div
            className="absolute z-40"
            style={{
              left: `${sp.xPercent}%`,
              top: `${sp.yPercent}%`,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px]">
              <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase">Edit Stamp</div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] text-gray-400 uppercase">Size</span>
                <input 
                  type="range" min="10" max="40" value={editingStamp.fontSize}
                  onChange={(e) => setEditingStamp({ ...editingStamp, fontSize: parseInt(e.target.value) })}
                  className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[8px] text-white">{editingStamp.fontSize}px</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[8px] text-gray-400 uppercase">Color</span>
                <div className="flex gap-1.5">
                  {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                    <button
                      key={c}
                      onClick={() => setEditingStamp({ ...editingStamp, color: c })}
                      className={`w-4 h-4 rounded-full border ${editingStamp.color === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    updateStampPlacementProps(editingStamp.id, { color: editingStamp.color, fontSize: editingStamp.fontSize });
                    setEditingStamp(null);
                  }}
                  className="flex-1 px-2 py-1 text-[10px] bg-blue-600 text-white rounded font-bold hover:bg-blue-500"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingStamp(null)}
                  className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending stamp popup (click-to-place with presets) */}
      {pendingStamp && (
        <div
          className="absolute z-40"
          style={{
            left: `${pendingStamp.xPercent}%`,
            top: `${pendingStamp.yPercent}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px]">
            <div className="text-[10px] text-blue-400 font-bold mb-1 uppercase">Place Stamp</div>
            <div className="grid grid-cols-3 gap-1">
              {['VERIFIED', 'REVIEWED', 'APPROVED', 'REJECT', 'PENDING', 'URGENT'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStampText(s)}
                  className={`px-1 py-1 text-[8px] font-bold border rounded uppercase transition-colors ${
                    stampText === s ? 'bg-red-600 border-red-400 text-white' : 'border-gray-600 text-gray-300 hover:border-red-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-gray-400 uppercase">Size</span>
                <input 
                  type="range" min="10" max="40" value={stampFontSize}
                  onChange={(e) => setStampFontSize(parseInt(e.target.value))}
                  className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[8px] text-white">{stampFontSize}px</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] text-gray-400 uppercase">Color</span>
                <div className="flex gap-1.5">
                  {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                    <button
                      key={c}
                      onClick={() => setStampColor(c)}
                      className={`w-4 h-4 rounded-full border ${stampColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-1 mt-2">
              <button
                onClick={handlePlaceStamp}
                disabled={!stampText.trim()}
                className="flex-1 px-2 py-1 text-[10px] bg-red-600 text-white rounded font-bold hover:bg-red-500 disabled:opacity-40"
              >
                Place Stamp
              </button>
              <button
                onClick={() => setPendingStamp(null)}
                className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

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
