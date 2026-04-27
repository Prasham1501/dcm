/**
 * DualViewport — Single Cornerstone viewport for the Dual comparison viewer.
 * Adapted from CRViewport with panel-scoped sync events.
 * - Right-drag: W/L adjustment
 * - Scroll: zoom
 * - Stamp placement + draggable stamps
 * - Panel-scoped CustomEvents to prevent cross-panel sync
 */
import { useEffect, useRef, useCallback, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useDualViewerStore, type PanelId } from '@/stores/dualViewerStore';
import { findAnnotationAtPoint, setupAutoDeactivate, markDblClickHandled } from '@/lib/annotationUtils';
import { AnnotationEditOverlay } from '@/components/shared/AnnotationEditOverlay';

interface DualViewportProps {
  imageId: string | null;
  isSelected: boolean;
  viewportIndex: number;
  panelId: PanelId;
  onClick: (e: React.MouseEvent) => void;
  spotNumber: number;
  showLogo: boolean;
}

function DualViewportInner({
  imageId, isSelected, viewportIndex, panelId, onClick, spotNumber, showLogo,
}: DualViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const enabledRef = useRef(false);
  const currentImageIdRef = useRef<string | null>(null);

  const {
    isStampMode, activeStampId, placeStamp, stampPlacements, updateStampPlacement,
    setPanelViewportImage, isTextMode, placeTextDirect,
  } = useDualViewerStore();

  // Editing cornerstone annotation (double-click on shape)
  const [editingAnnotation, setEditingAnnotation] = useState<{
    toolName: string; annotationIndex: number; color: string; lineWidth: number; position: { x: number; y: number };
  } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const imageUrl = e.dataTransfer.getData('application/dicom-image-url') || e.dataTransfer.getData('text/plain');
    if (imageUrl) setPanelViewportImage(panelId, imageUrl, viewportIndex);
  }, [setPanelViewportImage, panelId, viewportIndex]);

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
    try { cornerstone.enable(el); enabledRef.current = true; } catch { /* may already be enabled */ }
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
    }).catch(() => { /* ignore */ });

    return () => { cancelled = true; };
  }, [imageId]);

  // Resize observer
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

  // ---- AUTO-DEACTIVATE TOOLS AFTER SINGLE USE ----
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    return setupAutoDeactivate(el, () => {
      window.dispatchEvent(new CustomEvent('dual-tool-deactivated'));
    });
  }, []);

  // ---- DOUBLE-CLICK TO EDIT CORNERSTONE ANNOTATIONS ----
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const handleDblClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const found = findAnnotationAtPoint(el, canvasX, canvasY);
      if (found) {
        e.stopPropagation();
        markDblClickHandled();
        setEditingAnnotation({
          toolName: found.toolName,
          annotationIndex: found.annotationIndex,
          color: found.data.color || '#00ff00',
          lineWidth: found.data.lineWidth || 1,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    };
    el.addEventListener('dblclick', handleDblClick);
    return () => el.removeEventListener('dblclick', handleDblClick);
  }, []);

  // Scroll wheel = zoom
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

        window.dispatchEvent(new CustomEvent(`dual-viewport-sync-${panelId}`, {
          detail: { type: 'scale', sourceIndex: viewportIndex, scale: newScale },
        }));
      } catch { /* ignore */ }
    };

    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => container.removeEventListener('wheel', handleWheel, true);
  }, [panelId, viewportIndex]);

  // Global mouse: W/L drag + stamp drag
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
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
            window.dispatchEvent(new CustomEvent(`dual-viewport-sync-${panelId}`, {
              detail: { type: 'voi', sourceIndex: viewportIndex, windowWidth: newWW, windowCenter: newWC },
            }));
          }
        } catch { /* ignore */ }
        return;
      }

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
      if (e.button === 2) { rightDragRef.current = null; document.body.style.cursor = ''; }
      if (e.button === 0) { stampDragRef.current = null; }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [updateStampPlacement, panelId, viewportIndex]);

  // Receive sync events from other selected viewports in the SAME panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.sourceIndex === viewportIndex) return;
      const el = elementRef.current;
      if (!el || !enabledRef.current) return;
      const { panels } = useDualViewerStore.getState();
      const panel = panels[panelId];
      if (!panel.selectedViewportIndices.includes(viewportIndex)) return;
      try {
        const vp = cornerstone.getViewport(el);
        if (!vp) return;
        if (detail.type === 'scale') vp.scale = detail.scale;
        else if (detail.type === 'voi') vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
        else if (detail.type === 'translation') vp.translation = detail.translation;
        else if (detail.type === 'full') {
          vp.scale = detail.scale;
          vp.translation = detail.translation;
          if (detail.windowWidth != null && detail.windowCenter != null) {
            vp.voi = { windowWidth: detail.windowWidth, windowCenter: detail.windowCenter };
          }
        }
        cornerstone.setViewport(el, vp);
      } catch { /* ignore */ }
    };
    window.addEventListener(`dual-viewport-sync-${panelId}`, handler);
    return () => window.removeEventListener(`dual-viewport-sync-${panelId}`, handler);
  }, [panelId, viewportIndex]);

  // Handle reset events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
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
          cornerstone.displayImage(el, image, {
            scale: defaultScale,
            translation: { x: 0, y: 0 },
            voi: { windowCenter: wc, windowWidth: ww },
            rotation: 0, hflip: false, vflip: false, invert: false,
            pixelReplication: false, labelmap: false,
          });
        } else {
          cornerstone.resize(el, true);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener(`dual-custom-reset-${panelId}`, handler);
    return () => window.removeEventListener(`dual-custom-reset-${panelId}`, handler);
  }, [panelId, viewportIndex]);

  // Right-click = W/L drag
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

  // Text input state
  const [pendingText, setPendingText] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#ffff00');
  const [textFontSize, setTextFontSize] = useState(14);

  // Click — stamp placement, text placement, or viewport selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (stampDragRef.current) return;
    // Don't handle clicks on pending text input
    const target = e.target as HTMLElement;
    if (target.closest('[data-pending-input]')) return;

    if (isStampMode && activeStampId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        placeStamp(panelId, viewportIndex, xPercent, yPercent);
      }
      return;
    }
    if (isTextMode && imageId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
      setPendingText({ xPercent, yPercent });
      setTextInput('');
      setTextColor('#ffff00');
      setTextFontSize(14);
      return;
    }
    onClick(e);
  }, [isStampMode, isTextMode, activeStampId, placeStamp, panelId, viewportIndex, onClick, imageId]);

  // Filter stamp placements for this viewport in this panel
  const viewportStamps = stampPlacements.filter(
    s => s.panelId === panelId && s.viewportIndex === viewportIndex
  );

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative bg-black overflow-hidden ${(isStampMode || isTextMode) ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseDownCapture={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Cornerstone render target */}
      <div
        ref={elementRef}
        data-dual-viewport-index={`${panelId}-${viewportIndex}`}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Stamp/text overlays — draggable */}
      {viewportStamps.map((sp) => (
        <div
          key={sp.id}
          className="absolute z-10 select-none"
          style={{
            left: `${sp.xPercent}%`, top: `${sp.yPercent}%`,
            transform: 'translate(-50%, -50%)',
            color: sp.color, fontSize: `${sp.fontSize}px`, fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', cursor: 'grab',
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            stampDragRef.current = {
              id: sp.id, startX: e.clientX, startY: e.clientY,
              startXPct: sp.xPercent, startYPct: sp.yPercent,
            };
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {sp.text}
        </div>
      ))}

      {/* Pending text input — fixed to top-right */}
      {pendingText && (
        <div
          className="absolute z-40 top-2 right-2"
          data-pending-input="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px]">
            <div className="text-[9px] text-blue-400 font-bold mb-1.5 uppercase">Add Text</div>
            <div className="space-y-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    placeTextDirect(panelId, viewportIndex, pendingText.xPercent, pendingText.yPercent, textInput.trim(), textColor, textFontSize);
                    setPendingText(null);
                  }
                  if (e.key === 'Escape') setPendingText(null);
                }}
                placeholder="Type text..."
                className="w-full px-2 py-1 text-xs bg-gray-900 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-gray-400 uppercase">Size</span>
                <input type="range" min="8" max="30" value={textFontSize}
                  onChange={(e) => setTextFontSize(parseInt(e.target.value))}
                  className="flex-1 mx-2 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-[8px] text-white">{textFontSize}px</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-gray-400 uppercase">Color</span>
                <div className="flex gap-1.5">
                  {['#ffff00', '#00ff00', '#ffffff', '#ff0000', '#00ffff'].map(c => (
                    <button key={c} onClick={() => setTextColor(c)}
                      className={`w-4 h-4 rounded-full border ${textColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (textInput.trim()) {
                      placeTextDirect(panelId, viewportIndex, pendingText.xPercent, pendingText.yPercent, textInput.trim(), textColor, textFontSize);
                      setPendingText(null);
                    }
                  }}
                  className="flex-1 px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                >
                  Add Text
                </button>
                <button
                  onClick={() => setPendingText(null)}
                  className="px-2 py-1 text-[10px] font-bold bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annotation edit overlay (double-click on shape) */}
      {editingAnnotation && elementRef.current && createPortal(
        <AnnotationEditOverlay
          element={elementRef.current}
          toolName={editingAnnotation.toolName}
          annotationIndex={editingAnnotation.annotationIndex}
          initialColor={editingAnnotation.color}
          initialLineWidth={editingAnnotation.lineWidth}
          position={editingAnnotation.position}
          onClose={() => setEditingAnnotation(null)}
        />,
        document.body
      )}

      {/* Spot number */}
      <div className="absolute bottom-1 left-1 text-white text-base font-mono font-bold opacity-70 select-none pointer-events-none z-10 drop-shadow-md">
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

export const DualViewport = memo(DualViewportInner);
