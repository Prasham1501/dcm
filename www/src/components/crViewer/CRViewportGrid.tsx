/**
 * CRViewportGrid — Grid layout for CR viewer matching reference software layouts.
 * Supports 1, 2, 4, 6, 8, 9 spot layouts with proper image fitting.
 * Features: red border selection, Ctrl+click multi-select, Shift+click swap, Ctrl+A select-all.
 * Drag-and-drop: custom mouse-based drag (bypasses HTML5 DnD / Cornerstone interference).
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { CRViewport } from './CRViewport';
import { Check } from 'lucide-react';

// Module-level drag state — avoids stale React closures and dataTransfer issues in Electron
interface _CRVPDrag { srcSlot: number; imageId: string; startX: number; startY: number }
let _crDrag: _CRVPDrag | null = null;
let _crDragging = false;

export function CRViewportGrid() {
  const {
    currentLayout, currentPage, images, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection, selectAllViewports,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, toggleArrangeMode,
    swapImages, showLogo,
  } = useCRViewerStore();

  const crGridRef = useRef<HTMLDivElement>(null);
  const shiftFirstRef = useRef<number | null>(null);
  const isArrangeModeRef = useRef(isArrangeMode);

  // Keep ref in sync so native event handlers always read latest value
  useEffect(() => { isArrangeModeRef.current = isArrangeMode; }, [isArrangeMode]);

  // Blue border over the slot the user is hovering during drag
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasImages = images.length > 0;

  // Force-deselect multi-selection on plain left-click
  const handleViewportMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isArrangeMode) return;
    useCRViewerStore.getState().setSelectedViewport(index);
  }, [isArrangeMode]);

  // ── Custom mouse-based drag ──

  // Step 1: Capture mousedown on the grid before Cornerstone gets it
  useEffect(() => {
    const grid = crGridRef.current;
    if (!grid) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isArrangeModeRef.current) return;
      const wrapper = (e.target as Element).closest<HTMLElement>('[data-cr-vp-slot]');
      if (!wrapper) return;
      const slot = parseInt(wrapper.dataset.crVpSlot!, 10);
      const { currentPage: page, currentLayout: layout, images: imgs } = useCRViewerStore.getState();
      const globalIdx = (page - 1) * layout.spots + slot;
      const imageId = imgs[globalIdx]?.imageUrl;
      if (!imageId) return;
      _crDrag = { srcSlot: slot, imageId, startX: e.clientX, startY: e.clientY };
      _crDragging = false;
    };

    grid.addEventListener('mousedown', onMouseDown, true); // capture — fires before Cornerstone
    return () => grid.removeEventListener('mousedown', onMouseDown, true);
  }, []); // stable: reads fresh state via getState() and isArrangeModeRef

  // Step 2: Track movement and handle the drop on mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!_crDrag) return;
      const dist = Math.hypot(e.clientX - _crDrag.startX, e.clientY - _crDrag.startY);
      if (!_crDragging) {
        if (dist < 6) return;
        _crDragging = true;
        document.body.style.cursor = 'grabbing';
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-cr-vp-slot]');
      const slot = w ? parseInt(w.dataset.crVpSlot!, 10) : null;
      setDragOverSlot((prev) => (prev !== slot ? slot : prev));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!_crDrag) return;
      const drag = _crDrag;
      const wasDragging = _crDragging;
      _crDrag = null;
      _crDragging = false;
      document.body.style.cursor = '';

      if (!wasDragging) { setDragOverSlot(null); return; }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-cr-vp-slot]');
      const dstSlot = w ? parseInt(w.dataset.crVpSlot!, 10) : null;
      setDragOverSlot(null);

      if (dstSlot === null || dstSlot === drag.srcSlot) return;

      // Swap images using global indices
      const { currentPage: page, currentLayout: layout, images: imgs } = useCRViewerStore.getState();
      const si = (page - 1) * layout.spots;
      const srcGlobal = si + drag.srcSlot;
      const dstGlobal = si + dstSlot;
      if (srcGlobal < imgs.length && dstGlobal < imgs.length) {
        useCRViewerStore.getState().swapImages(srcGlobal, dstGlobal);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []); // stable: uses only module-level vars and getState()

  // ── Ctrl+A: select all viewports ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopImmediatePropagation();
        selectAllViewports();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [selectAllViewports]);

  const handleViewportClick = useCallback((index: number, e: React.MouseEvent) => {
    if (isArrangeMode) {
      toggleArrangeViewport(index);
      return;
    }

    if (e.shiftKey) {
      if (shiftFirstRef.current === null) {
        shiftFirstRef.current = index;
        setSelectedViewport(index);
      } else {
        const first = shiftFirstRef.current;
        shiftFirstRef.current = null;
        if (first !== index) {
          const globalIdxA = startIndex + first;
          const globalIdxB = startIndex + index;
          swapImages(globalIdxA, globalIdxB);
        }
        setSelectedViewport(index);
      }
      return;
    }

    shiftFirstRef.current = null;

    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection, swapImages, startIndex]);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
    width: '100%',
    height: '100%',
    gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
    backgroundColor: '#374151',
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-700 overflow-hidden relative">
      <div ref={crGridRef} style={gridStyle} className="flex-1">
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          const image = (hasImages && imgIndex < images.length) ? images[imgIndex] : null;
          const imageId = image?.imageUrl || null;
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

          return (
            <div
              key={`cr-vp-${i}`}
              data-cr-vp-slot={i}
              className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : imageId ? 'hover:cursor-grab active:cursor-grabbing' : ''}`}
              onMouseDown={(e) => handleViewportMouseDown(i, e)}
            >
              <div className={`${isArrangeMode ? 'pointer-events-none' : ''} w-full h-full`}>
                <CRViewport
                  imageId={imageId}
                  isSelected={isSelected}
                  viewportIndex={i}
                  onClick={(e) => handleViewportClick(i, e)}
                  spotNumber={image ? image.instanceNumber : imgIndex + 1}
                  showLogo={showLogo}
                />
              </div>

              {/* Red selection border overlay */}
              {(isSelected || isMultiSelected) && !isArrangeMode && (
                <div
                  className="absolute inset-0 z-40 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }}
                />
              )}
              {/* Drop target indicator */}
              {dragOverSlot === i && imageId && !isArrangeMode && (
                <div
                  className="absolute inset-0 z-[45] pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 0 3px #3b82f6' }}
                />
              )}

              {/* Arrange overlay */}
              {isArrangeMode && arrangeClickOrder.includes(i) && (
                <div
                  className="absolute inset-0 bg-green-500/20 z-50 flex items-center justify-center cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); toggleArrangeViewport(i); }}
                >
                  <div className="w-12 h-12 rounded-full bg-green-600 border-3 border-white flex items-center justify-center text-white text-2xl font-bold shadow-2xl">
                    {arrangeClickOrder.indexOf(i) + 1}
                  </div>
                </div>
              )}
              {isArrangeMode && !arrangeClickOrder.includes(i) && (
                <div
                  className="absolute inset-0 z-50 cursor-pointer hover:bg-white/10"
                  onClick={(e) => { e.stopPropagation(); toggleArrangeViewport(i); }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Apply Arrange Button */}
      {isArrangeMode && arrangeClickOrder.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100]">
          <button
            onClick={(e) => { e.stopPropagation(); toggleArrangeMode(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-app-accent pointer-events-auto hover:brightness-110 text-white rounded-full font-bold shadow-[0_10px_25px_-5px_rgba(239,68,68,0.5)] transition-transform hover:scale-105"
          >
            <Check className="w-4 h-4" />
            Arrange {arrangeClickOrder.length} images
          </button>
        </div>
      )}
    </div>
  );
}
