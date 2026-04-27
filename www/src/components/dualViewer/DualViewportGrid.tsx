/**
 * DualViewportGrid — Grid layout for one panel of the Dual viewer.
 * Adapted from CRViewportGrid with panel-scoped drag state.
 * Features: red border selection, Ctrl+click multi-select, Shift+click swap, Ctrl+A select-all.
 * Drag-and-drop: custom mouse-based drag restricted to same panel.
 */
import { useCallback, useRef, useEffect, useState } from 'react';
import { useDualViewerStore, type PanelId } from '@/stores/dualViewerStore';
import { DualViewport } from './DualViewport';
import { Check } from 'lucide-react';
import { wasDblClickHandled } from '@/lib/annotationUtils';

// Module-level drag state keyed by panelId — avoids stale closures
interface _DualVPDrag { srcSlot: number; imageId: string; startX: number; startY: number }
const _dualDrag: Record<PanelId, _DualVPDrag | null> = { left: null, right: null };
const _dualDragging: Record<PanelId, boolean> = { left: false, right: false };

interface DualViewportGridProps {
  panelId: PanelId;
}

export function DualViewportGrid({ panelId }: DualViewportGridProps) {
  const panel = useDualViewerStore((s) => s.panels[panelId]);
  const showLogo = useDualViewerStore((s) => s.showLogo);

  const {
    currentLayout, currentPage, images, selectedViewport,
    selectedViewportIndices, isArrangeMode, arrangeClickOrder,
  } = panel;

  const gridRef = useRef<HTMLDivElement>(null);
  const shiftFirstRef = useRef<number | null>(null);
  const isArrangeModeRef = useRef(isArrangeMode);
  const panelIdRef = useRef(panelId);

  useEffect(() => { isArrangeModeRef.current = isArrangeMode; }, [isArrangeMode]);
  useEffect(() => { panelIdRef.current = panelId; }, [panelId]);

  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasImages = images.length > 0;

  // Force-deselect multi-selection on plain left-click
  const handleViewportMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isArrangeMode) return;
    useDualViewerStore.getState().setPanelSelectedViewport(panelId, index);
  }, [isArrangeMode, panelId]);

  // Step 1: Capture mousedown on the grid before Cornerstone gets it
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isArrangeModeRef.current) return;
      const wrapper = (e.target as Element).closest<HTMLElement>('[data-dual-vp-slot]');
      if (!wrapper) return;
      // Verify this wrapper belongs to our panel
      if (wrapper.dataset.dualPanel !== panelIdRef.current) return;
      const slot = parseInt(wrapper.dataset.dualVpSlot!, 10);
      const store = useDualViewerStore.getState();
      const p = store.panels[panelIdRef.current];
      const globalIdx = (p.currentPage - 1) * p.currentLayout.spots + slot;
      const imageId = p.images[globalIdx]?.imageUrl;
      if (!imageId) return;
      _dualDrag[panelIdRef.current] = { srcSlot: slot, imageId, startX: e.clientX, startY: e.clientY };
      _dualDragging[panelIdRef.current] = false;
    };

    grid.addEventListener('mousedown', onMouseDown, true);
    return () => grid.removeEventListener('mousedown', onMouseDown, true);
  }, []);

  // Step 2: Track movement and handle the drop on mouseup
  useEffect(() => {
    const pid = panelId;

    const onMouseMove = (e: MouseEvent) => {
      if (!_dualDrag[pid]) return;
      const dist = Math.hypot(e.clientX - _dualDrag[pid]!.startX, e.clientY - _dualDrag[pid]!.startY);
      if (!_dualDragging[pid]) {
        if (dist < 6) return;
        _dualDragging[pid] = true;
        document.body.style.cursor = 'grabbing';
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-dual-vp-slot]');
      // Only highlight if same panel
      const slot = (w && w.dataset.dualPanel === pid) ? parseInt(w.dataset.dualVpSlot!, 10) : null;
      setDragOverSlot((prev) => (prev !== slot ? slot : prev));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!_dualDrag[pid]) return;
      const drag = _dualDrag[pid]!;
      const wasDragging = _dualDragging[pid];
      _dualDrag[pid] = null;
      _dualDragging[pid] = false;
      document.body.style.cursor = '';

      if (!wasDragging) { setDragOverSlot(null); return; }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-dual-vp-slot]');
      // Restrict drop to same panel
      const dstSlot = (w && w.dataset.dualPanel === pid) ? parseInt(w.dataset.dualVpSlot!, 10) : null;
      setDragOverSlot(null);

      if (dstSlot === null || dstSlot === drag.srcSlot) return;

      const store = useDualViewerStore.getState();
      const p = store.panels[pid];
      const si = (p.currentPage - 1) * p.currentLayout.spots;
      const srcGlobal = si + drag.srcSlot;
      const dstGlobal = si + dstSlot;
      if (srcGlobal < p.images.length && dstGlobal < p.images.length) {
        store.panelSwapImages(pid, srcGlobal, dstGlobal);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [panelId]);

  // Ctrl+A: select all viewports in active panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const store = useDualViewerStore.getState();
        if (store.activePanel !== panelId) return; // only active panel
        e.preventDefault();
        e.stopImmediatePropagation();
        store.selectAllPanelViewports(panelId);
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [panelId]);

  const handleViewportClick = useCallback((index: number, e: React.MouseEvent) => {
    const store = useDualViewerStore.getState();
    const p = store.panels[panelId];

    if (p.isArrangeMode) {
      store.togglePanelArrangeViewport(panelId, index);
      return;
    }

    if (e.shiftKey) {
      if (shiftFirstRef.current === null) {
        shiftFirstRef.current = index;
        store.setPanelSelectedViewport(panelId, index);
      } else {
        const first = shiftFirstRef.current;
        shiftFirstRef.current = null;
        if (first !== index) {
          const si = (p.currentPage - 1) * p.currentLayout.spots;
          store.panelSwapImages(panelId, si + first, si + index);
        }
        store.setPanelSelectedViewport(panelId, index);
      }
      return;
    }

    shiftFirstRef.current = null;

    if (e.ctrlKey || e.metaKey) {
      store.togglePanelViewportSelection(panelId, index);
    } else {
      store.setPanelSelectedViewport(panelId, index);
    }
  }, [panelId]);

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
      <div ref={gridRef} style={gridStyle} className="flex-1">
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          const image = (hasImages && imgIndex < images.length) ? images[imgIndex] : null;
          const imageId = image?.imageUrl || null;
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

          return (
            <div
              key={`dual-vp-${panelId}-${i}`}
              data-dual-vp-slot={i}
              data-dual-panel={panelId}
              className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : imageId ? 'hover:cursor-grab active:cursor-grabbing' : ''}`}
              onMouseDown={(e) => handleViewportMouseDown(i, e)}
              onDoubleClick={() => { if (!wasDblClickHandled()) useDualViewerStore.getState().togglePanelSingleViewport(panelId, i); }}
            >
              <div className={`${isArrangeMode ? 'pointer-events-none' : ''} w-full h-full`}>
                <DualViewport
                  imageId={imageId}
                  isSelected={isSelected}
                  viewportIndex={i}
                  panelId={panelId}
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
                  onClick={(e) => { e.stopPropagation(); useDualViewerStore.getState().togglePanelArrangeViewport(panelId, i); }}
                >
                  <div className="w-12 h-12 rounded-full bg-green-600 border-3 border-white flex items-center justify-center text-white text-2xl font-bold shadow-2xl">
                    {arrangeClickOrder.indexOf(i) + 1}
                  </div>
                </div>
              )}
              {isArrangeMode && !arrangeClickOrder.includes(i) && (
                <div
                  className="absolute inset-0 z-50 cursor-pointer hover:bg-white/10"
                  onClick={(e) => { e.stopPropagation(); useDualViewerStore.getState().togglePanelArrangeViewport(panelId, i); }}
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
            onClick={(e) => { e.stopPropagation(); useDualViewerStore.getState().togglePanelArrangeMode(panelId); }}
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
