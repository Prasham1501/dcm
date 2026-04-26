/**
 * CRViewport — Single DICOM viewport for the CR viewer.
 * - containerRef (w-full h-full relative): handles mouse events
 * - elementRef (absolute inset-0): Cornerstone render target
 * - COVER scale: image fills viewport with no black bars
 * - Draggable stamps
 */
import { useEffect, useRef, useCallback, memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useStampStore } from '@/stores/stampStore';


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
    isStampMode, isTextMode, stampPlacements, updateStampPlacement, updateStampPlacementProps,
    placeStampDirect, placeTextDirect,
  } = useCRViewerStore();

  // Editing stamp/text state (double-click)
  const [editingStamp, setEditingStamp] = useState<{ id: string; color: string; fontSize: number; text?: string; type?: string } | null>(null);

  // Pending stamp popup (click-to-place with stamp picker)
  const [pendingStamp, setPendingStamp] = useState<{ xPercent: number; yPercent: number } | null>(null);

  // Pending text input (click-to-place text)
  const [pendingText, setPendingText] = useState<{ xPercent: number; yPercent: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#ffff00');
  const [textFontSize, setTextFontSize] = useState(14);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const rightClickMoved = useRef(false);

  // Right-click W/L drag state
  const rightDragRef = useRef<{
    startX: number; startY: number; startWW: number; startWC: number;
  } | null>(null);

  // Stamp drag state
  const stampDragRef = useRef<{
    id: string; startX: number; startY: number;
    startXPct: number; startYPct: number;
  } | null>(null);
  const wasStampDragRef = useRef(false);

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
        if (image.columns && image.rows) {
          useCRViewerStore.getState().setImageAspectRatio(image.columns / image.rows);
        }
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
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) rightClickMoved.current = true;
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
        // Context menu is now handled by onContextMenu event
        rightDragRef.current = null;
        rightButtonDownRef.current = false;
        document.body.style.cursor = '';
      }
      if (e.button === 0) {
        wasStampDragRef.current = !!stampDragRef.current;
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

  // ---- CUSTOM CONTEXT MENU ----
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!rightClickMoved.current) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
    rightButtonDownRef.current = false;
    rightDragRef.current = null;
    document.body.style.cursor = '';
  }, []);

  // ---- MOUSE DOWN on container (right-click = W/L drag) ----
  const rightButtonDownRef = useRef(false);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);
    if (e.button !== 2) return;
    e.preventDefault();
    rightClickMoved.current = false;
    rightButtonDownRef.current = true;
    const el = elementRef.current;
    if (!el || !enabledRef.current) return;
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

  // Handle click — stamp/text placement or viewport selection
  const handleClick = useCallback((e: React.MouseEvent) => {
    // If a stamp drag just happened, don't treat as click
    if (stampDragRef.current) return;
    if (wasStampDragRef.current) { wasStampDragRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('[data-stamp-edit]')) return;
    if (target.closest('[data-stamp-overlay]')) return;
    if (target.closest('[data-pending-input]')) return;
    if (editingStamp) return;

    if (isStampMode && imageId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      // If a stamp is selected in the shared store, place immediately
      const selectedStamp = useStampStore.getState().getSelectedStamp();
      if (selectedStamp) {
        placeStampDirect(viewportIndex, xPercent, yPercent, selectedStamp.text, selectedStamp.color, selectedStamp.fontSize);
        return;
      }
      // Otherwise show picker
      setPendingStamp({ xPercent, yPercent });
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
  }, [isStampMode, isTextMode, imageId, onClick, viewportIndex, placeStampDirect, editingStamp]);

  // Filter stamp placements for this viewport
  const viewportStamps = stampPlacements.filter(s => s.viewportIndex === viewportIndex);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative bg-black overflow-hidden ${(isStampMode || isTextMode) ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseDownCapture={handleMouseDown}
      onContextMenu={handleContextMenu}
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
          data-stamp-overlay="true"
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
            setEditingStamp({ id: sp.id, color: sp.color, fontSize: sp.fontSize, text: sp.text, type: sp.type });
          }}
        >
          <span className={`inline-block px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${
            sp.type === 'text' ? '' : 'border-2 border-current uppercase tracking-wider'
          }`}
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            {sp.text}
          </span>
        </div>
      ))}

      {/* Edit stamp/text panel (double-click) — fixed to top-right corner */}
      {editingStamp && (() => {
        const sp = viewportStamps.find(s => s.id === editingStamp.id);
        if (!sp) return null;
        const isText = editingStamp.type === 'text';
        return (
          <div
            className="absolute z-40 top-2 right-2"
            data-stamp-edit="true"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-900/95 border border-blue-500/70 rounded-xl p-2 2xl:p-4 shadow-2xl w-[180px] 2xl:w-[260px] backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1.5 2xl:mb-3">
                <div className="text-[10px] 2xl:text-sm text-blue-400 font-bold uppercase tracking-wide">Edit {isText ? 'Text' : 'Stamp'}</div>
                <button onClick={() => setEditingStamp(null)} className="w-4 h-4 2xl:w-6 2xl:h-6 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors text-[10px] 2xl:text-xs">
                  ×
                </button>
              </div>
              {/* Live preview */}
              <div className="mb-2 2xl:mb-4 p-1.5 2xl:p-3 bg-black/70 rounded-lg border border-gray-700/50 text-center min-h-[30px] 2xl:min-h-[50px] flex items-center justify-center">
                <span className={`inline-block px-2 py-1 rounded font-bold ${isText ? '' : 'border-2 border-current uppercase tracking-wider'}`}
                  style={{ color: editingStamp.color, fontSize: `${Math.min(editingStamp.fontSize, 22)}px`, textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
                  {editingStamp.text || sp.text}
                </span>
              </div>
              <div className="space-y-1.5 2xl:space-y-3">
                {/* Text input (only for text type) */}
                {isText && (
                  <div>
                    <span className="text-[9px] 2xl:text-xs text-gray-400 uppercase font-semibold block mb-1">Text</span>
                    <input
                      type="text"
                      value={editingStamp.text ?? sp.text}
                      onChange={(e) => setEditingStamp({ ...editingStamp, text: e.target.value })}
                      className="w-full px-2 py-1 text-[10px] 2xl:text-sm bg-gray-800 text-white border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] 2xl:text-xs text-gray-400 uppercase font-semibold">Size</span>
                    <span className="text-[9px] 2xl:text-xs text-white font-bold bg-gray-700 px-1 py-0.5 rounded">{editingStamp.fontSize}px</span>
                  </div>
                  <input 
                    type="range" min="10" max="40" value={editingStamp.fontSize}
                    onChange={(e) => setEditingStamp({ ...editingStamp, fontSize: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div>
                  <span className="text-[9px] 2xl:text-xs text-gray-400 uppercase font-semibold block mb-1">Color</span>
                  <div className="flex gap-1.5 2xl:gap-2.5 flex-wrap">
                    {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800', '#8800ff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setEditingStamp({ ...editingStamp, color: c })}
                        className={`w-5 h-5 2xl:w-7 2xl:h-7 rounded-full border-2 transition-transform ${editingStamp.color === c ? 'border-white scale-110 ring-2 ring-blue-500/50' : 'border-gray-600 hover:border-gray-400'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2 2xl:mt-4">
                <button
                  onClick={() => {
                    const updates: { color: string; fontSize: number; text?: string } = { color: editingStamp.color, fontSize: editingStamp.fontSize };
                    if (isText && editingStamp.text !== undefined) updates.text = editingStamp.text;
                    updateStampPlacementProps(editingStamp.id, updates);
                    setEditingStamp(null);
                  }}
                  className="flex-1 px-2 py-1.5 text-[10px] 2xl:text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    useCRViewerStore.getState().removeStampPlacement(editingStamp.id);
                    setEditingStamp(null);
                  }}
                  className="px-2 py-1.5 text-[10px] 2xl:text-sm bg-red-600/80 text-white rounded-lg font-bold hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending stamp picker (click-to-place) — fixed to top-right corner */}
      {pendingStamp && (
        <div
          className="absolute z-40 top-2 right-2"
          data-pending-input="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px] 2xl:min-w-[220px]">
            <div className="text-[9px] 2xl:text-[10px] text-blue-400 font-bold mb-1.5 uppercase">Select Stamp to Place</div>
            <CRStampPickerPanel
              onSelect={(text, color, fontSize) => {
                placeStampDirect(viewportIndex, pendingStamp.xPercent, pendingStamp.yPercent, text, color, fontSize);
                setPendingStamp(null);
              }}
              onCancel={() => setPendingStamp(null)}
            />
          </div>
        </div>
      )}

      {/* Pending text input (click-to-place text) — fixed to top-right corner */}
      {pendingText && (
        <div
          className="absolute z-40 top-2 right-2"
          data-pending-input="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="bg-gray-800 border border-blue-500 rounded-lg p-2 shadow-xl min-w-[180px] 2xl:min-w-[220px]">
            <div className="text-[9px] 2xl:text-[10px] text-blue-400 font-bold mb-1.5 uppercase">Add Text</div>
            <div className="space-y-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) {
                    placeTextDirect(viewportIndex, pendingText.xPercent, pendingText.yPercent, textInput.trim(), textColor, textFontSize);
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
                      placeTextDirect(viewportIndex, pendingText.xPercent, pendingText.yPercent, textInput.trim(), textColor, textFontSize);
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

      {/* Right-click context menu (portal to body) */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onMouseDown={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[61] bg-gray-900/95 border border-gray-600 rounded-lg shadow-2xl py-1 min-w-[160px] backdrop-blur-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { label: 'Pan', tool: 'Pan' },
              { label: 'Zoom', tool: 'Zoom' },
              { label: 'Window/Level', tool: 'Wwwc' },
              { label: 'Length', tool: 'Length' },
              { label: 'Arrow', tool: 'ArrowAnnotate' },
              { label: 'Angle', tool: 'Angle' },
              { label: 'Rectangle', tool: 'RectangleRoi' },
              { label: 'Ellipse', tool: 'EllipticalRoi' },
            ].map((item) => (
              <button
                key={item.tool}
                onClick={() => {
                  try { cornerstoneTools.setToolActive(item.tool, { mouseButtonMask: 1 }); } catch { /* ignore */ }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-blue-600/40 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('cr-custom-reset', { detail: { viewportIndex } }));
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-blue-600/40 transition-colors"
            >
              Reset Viewport
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/** CRStampPickerPanel — inline panel showing saved stamps for quick placement in CR viewer */
function CRStampPickerPanel({ onSelect, onCancel }: {
  onSelect: (text: string, color: string, fontSize: number) => void;
  onCancel: () => void;
}) {
  const { stamps, addStamp } = useStampStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState('#ffff00');
  const [newFontSize, setNewFontSize] = useState(16);

  return (
    <div className="space-y-2">
      {stamps.length > 0 && (
        <div className="max-h-[180px] overflow-y-auto space-y-1">
          {stamps.map((stamp) => (
            <button
              key={stamp.id}
              onClick={() => onSelect(stamp.text, stamp.color, stamp.fontSize)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-gray-600 hover:border-blue-400 hover:bg-gray-700/50 transition-colors text-left"
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
              <span className="text-[10px] font-bold text-white flex-1 truncate uppercase">{stamp.text}</span>
              <span className="text-[9px] text-gray-500">{stamp.fontSize}px</span>
            </button>
          ))}
        </div>
      )}

      {stamps.length === 0 && !showCreate && (
        <div className="text-[10px] text-gray-400 text-center py-2">No stamps yet. Create one below.</div>
      )}

      {showCreate ? (
        <div className="border-t border-gray-600 pt-2 space-y-1.5">
          <div className="text-[9px] text-blue-400 font-bold uppercase">Create Stamp</div>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Hospital)" autoFocus
            className="w-full px-2 py-1 text-[10px] bg-gray-900 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none" />
          <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)}
            placeholder="Stamp text (e.g. APPROVED)"
            className="w-full px-2 py-1 text-[10px] bg-gray-900 text-white border border-gray-600 rounded focus:border-blue-500 focus:outline-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400 uppercase">Size</span>
            <input type="range" min="10" max="40" value={newFontSize}
              onChange={(e) => setNewFontSize(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
            <span className="text-[9px] text-white w-8 text-right">{newFontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 uppercase">Color</span>
            <div className="flex gap-1">
              {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="p-1.5 bg-black/60 rounded border border-gray-700 text-center">
            <span className="inline-block px-1.5 py-0.5 rounded font-bold border-2 border-current uppercase tracking-wider"
              style={{ color: newColor, fontSize: `${Math.min(newFontSize, 18)}px`, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              {newText || 'PREVIEW'}
            </span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => {
              if (newName.trim() && newText.trim()) {
                addStamp({ name: newName.trim(), text: newText.trim(), color: newColor, fontSize: newFontSize });
                setNewName(''); setNewText(''); setShowCreate(false);
              }
            }} disabled={!newName.trim() || !newText.trim()}
              className="flex-1 px-2 py-1 text-[10px] bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-40">
              Save Stamp
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          <button onClick={() => setShowCreate(true)}
            className="flex-1 px-2 py-1.5 text-[10px] bg-blue-600/80 text-white rounded font-bold hover:bg-blue-500">
            + New Stamp
          </button>
          <button onClick={onCancel}
            className="px-2 py-1.5 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export const CRViewport = memo(CRViewportInner);
