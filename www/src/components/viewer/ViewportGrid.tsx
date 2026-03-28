import { useCallback, useRef, useEffect, useState } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { DicomViewport } from './DicomViewport';
import { useAnnotationPersistence, restoreAnnotations } from '@/hooks/useAnnotationPersistence';
import { getStudyKey } from '@/stores/annotationStore';
import { Check } from 'lucide-react';

/** Extract unique area letters from a CSS grid-template-areas string */
function getAreaLetters(areas: string): string[] {
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

// Module-level drag state — avoids stale React closures and dataTransfer.getData() issues in Electron
interface _VPDrag { srcSlot: number; imageId: string; startX: number; startY: number }
let _vpDrag: _VPDrag | null = null;
let _vpDragging = false;

export function ViewportGrid() {
  const {
    currentLayout, currentPage, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection,
    patientName, studyDate, images, activeToolId, viewportsCleared,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, viewportImageOverrides, viewportIndexOverrides, setViewportImageOverride, setViewportIndexOverride, toggleArrangeMode,
    toggleSingleViewport
  } = useViewerStore();

  const gridRef = useRef<HTMLDivElement>(null);
  const shiftFirstRef = useRef<number | null>(null);
  const isArrangeModeRef = useRef(isArrangeMode);
  const selectAllViewports = useViewerStore((s) => s.selectAllViewports);

  // Keep ref in sync so native event handlers always read latest value
  useEffect(() => { isArrangeModeRef.current = isArrangeMode; }, [isArrangeMode]);

  // Blue border over the slot the user is hovering during drag
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // ── Custom mouse-based drag (bypasses HTML5 DnD + Cornerstone interference) ──

  // Step 1: Capture mousedown on the grid before Cornerstone gets it
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isArrangeModeRef.current) return;
      const wrapper = (e.target as Element).closest<HTMLElement>('[data-vp-slot]');
      if (!wrapper) return;
      const slot = parseInt(wrapper.dataset.vpSlot!, 10);
      const store = useViewerStore.getState();
      if (store.viewportsCleared || store.images.length === 0) return;
      const overrideUrl = store.viewportImageOverrides[slot];
      const si = (store.currentPage - 1) * store.currentLayout.spots + slot;
      const imageId = overrideUrl || store.images[si]?.imageUrl;
      if (!imageId) return;
      _vpDrag = { srcSlot: slot, imageId, startX: e.clientX, startY: e.clientY };
      _vpDragging = false;
    };

    grid.addEventListener('mousedown', onMouseDown, true); // capture — fires before Cornerstone
    return () => grid.removeEventListener('mousedown', onMouseDown, true);
  }, []); // stable: reads fresh state via getState() and isArrangeModeRef

  // Step 2: Track movement and handle the drop on mouseup
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!_vpDrag) return;
      const dist = Math.hypot(e.clientX - _vpDrag.startX, e.clientY - _vpDrag.startY);
      if (!_vpDragging) {
        if (dist < 6) return;
        _vpDragging = true;
        document.body.style.cursor = 'grabbing';
      }
      // Highlight the slot under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-vp-slot]');
      const slot = w ? parseInt(w.dataset.vpSlot!, 10) : null;
      setDragOverSlot((prev) => (prev !== slot ? slot : prev));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!_vpDrag) return;
      const drag = _vpDrag;
      const wasDragging = _vpDragging;
      _vpDrag = null;
      _vpDragging = false;
      document.body.style.cursor = '';

      if (!wasDragging) { setDragOverSlot(null); return; }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const w = el?.closest<HTMLElement>('[data-vp-slot]');
      const dstSlot = w ? parseInt(w.dataset.vpSlot!, 10) : null;
      setDragOverSlot(null);

      if (dstSlot === null || dstSlot === drag.srcSlot) return;

      // Swap images between srcSlot and dstSlot
      const store = useViewerStore.getState();
      const getSlotUrl = (slot: number) => {
        const o = store.viewportImageOverrides[slot];
        if (o) return o;
        const idx = (store.currentPage - 1) * store.currentLayout.spots + slot;
        return store.images[idx]?.imageUrl || null;
      };
      const dstUrl = getSlotUrl(dstSlot);
      store.setViewportImageOverride(dstSlot, drag.imageId);
      const srcOrigIdx = store.images.findIndex((img) => img.imageUrl === drag.imageId);
      if (srcOrigIdx >= 0) store.setViewportIndexOverride(dstSlot, srcOrigIdx);
      if (dstUrl) {
        store.setViewportImageOverride(drag.srcSlot, dstUrl);
        const dstOrigIdx = store.images.findIndex((img) => img.imageUrl === dstUrl);
        if (dstOrigIdx >= 0) store.setViewportIndexOverride(drag.srcSlot, dstOrigIdx);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []); // stable: uses only module-level vars and getState()

  // ── Keyboard shortcut: Ctrl+A ──
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

  // Listen for annotation events and auto-save
  useAnnotationPersistence();

  // Restore annotations when study changes
  useEffect(() => {
    if (images.length === 0) return;
    const studyKey = getStudyKey(useViewerStore.getState().studyUID, images.map((img) => img.imageUrl));
    const timer = setTimeout(() => restoreAnnotations(studyKey), 1000);
    return () => clearTimeout(timer);
  }, [images]);

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasRealImages = images.length > 0 && !viewportsCleared;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
    width: '100%',
    height: '100%',
    backgroundColor: '#374151',
  };

  if (currentLayout.areas) {
    gridStyle.gridTemplateAreas = currentLayout.areas;
    if (currentLayout.gridTemplate) {
      gridStyle.gridTemplateColumns = currentLayout.gridTemplate.columns;
      gridStyle.gridTemplateRows = currentLayout.gridTemplate.rows;
    } else {
      gridStyle.gridTemplateColumns = `repeat(${currentLayout.cols}, 1fr)`;
      gridStyle.gridTemplateRows = `repeat(${currentLayout.rows}, 1fr)`;
    }
  } else {
    gridStyle.gridTemplateColumns = `repeat(${currentLayout.cols}, 1fr)`;
    gridStyle.gridTemplateRows = `repeat(${currentLayout.rows}, 1fr)`;
  }

  const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];

  const imageStack = hasRealImages ? images.map((img) => img.imageUrl || '') : [];

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
          const store = useViewerStore.getState();
          const getImageUrl = (vpIdx: number) => {
            const override = store.viewportImageOverrides[vpIdx];
            if (override) return override;
            const imgIdx = (store.currentPage - 1) * store.currentLayout.spots + vpIdx;
            return store.images[imgIdx]?.imageUrl || null;
          };
          const urlA = getImageUrl(first);
          const urlB = getImageUrl(index);
          if (urlA && urlB) {
            store.setViewportImageOverride(first, urlB);
            store.setViewportImageOverride(index, urlA);
            const idxA = store.images.findIndex((img) => img.imageUrl === urlA);
            const idxB = store.images.findIndex((img) => img.imageUrl === urlB);
            if (idxA >= 0) store.setViewportIndexOverride(index, idxA);
            if (idxB >= 0) store.setViewportIndexOverride(first, idxB);
          }
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
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection]);

  const handleViewportDoubleClick = useCallback((index: number) => {
    if (isArrangeMode) return;
    toggleSingleViewport(index);
  }, [isArrangeMode, toggleSingleViewport]);

  const handleViewportImageDrop = useCallback((slotIndex: number, imageUrl: string) => {
    setViewportImageOverride(slotIndex, imageUrl);
    const store = useViewerStore.getState();
    const origIdx = store.images.findIndex((img) => img.imageUrl === imageUrl);
    if (origIdx >= 0) setViewportIndexOverride(slotIndex, origIdx);
  }, [setViewportImageOverride, setViewportIndexOverride]);

  // File drop onto the grid (external DICOM files)
  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const { loadLocalFiles } = useViewerStore.getState();
      if (loadLocalFiles) loadLocalFiles(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      className="flex-1 flex flex-col bg-black overflow-hidden relative"
      onDrop={handleGridDrop}
      onDragOver={handleDragOver}
    >
      <div ref={gridRef} style={gridStyle} className="flex-1">
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          const areaStyle: React.CSSProperties = currentLayout.areas && areaNames[i]
            ? { gridArea: areaNames[i] }
            : {};
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

          if (hasRealImages) {
            const overrideUrl = viewportImageOverrides[i];
            const defaultImg = images[imgIndex];
            const imageId = overrideUrl || defaultImg?.imageUrl || null;

            const actualImgIndex = viewportIndexOverrides[i] !== undefined
              ? viewportIndexOverrides[i]
              : overrideUrl
                ? images.findIndex((img) => img.imageUrl === overrideUrl)
                : imgIndex;

            if (!imageId) {
              return (
                <div
                  key={`empty-vp-${i}`}
                  data-vp-slot={i}
                  style={areaStyle}
                  className="relative overflow-hidden min-h-0 bg-black"
                  onClick={(e) => handleViewportClick(i, e)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const url = e.dataTransfer.getData('application/dicom-image-url');
                    if (url) handleViewportImageDrop(i, url);
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs select-none pointer-events-none">
                    Empty
                  </div>
                  {(isSelected || isMultiSelected) && (
                    <div className="absolute inset-0 z-40 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }} />
                  )}
                  {dragOverSlot === i && (
                    <div className="absolute inset-0 z-[45] pointer-events-none" style={{ boxShadow: 'inset 0 0 0 3px #3b82f6' }} />
                  )}
                </div>
              );
            }

            return (
              <div
                key={`vp-${i}`}
                data-vp-slot={i}
                style={areaStyle}
                className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : 'hover:cursor-grab active:cursor-grabbing'}`}
                onDoubleClick={() => handleViewportDoubleClick(i)}
              >
                <div className={`${isArrangeMode ? 'pointer-events-none' : ''} w-full h-full`}>
                  <DicomViewport
                    imageId={imageId}
                    isSelected={isSelected}
                    isMultiSelected={isMultiSelected}
                    onClick={(e) => handleViewportClick(i, e)}
                    viewportIndex={i}
                    activeTool={activeToolId}
                    imageStack={imageStack}
                    stackIndex={actualImgIndex >= 0 ? actualImgIndex : imgIndex}
                    onImageDrop={(url) => handleViewportImageDrop(i, url)}
                  />
                </div>
                {/* Image order label */}
                <div className="absolute bottom-1 left-1 z-30 text-white text-[10px] font-mono pointer-events-none select-none opacity-60 leading-none">
                  {(actualImgIndex >= 0 ? actualImgIndex : imgIndex) + 1}/{images.length}
                </div>
                {/* Selection border */}
                {(isSelected || isMultiSelected) && (
                  <div className="absolute inset-0 z-40 pointer-events-none" style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }} />
                )}
                {/* Drop target indicator */}
                {dragOverSlot === i && !isArrangeMode && (
                  <div className="absolute inset-0 z-[45] pointer-events-none" style={{ boxShadow: 'inset 0 0 0 3px #3b82f6' }} />
                )}
                {/* Arrange overlay */}
                {isArrangeMode && arrangeClickOrder.includes(i) && (
                  <div
                    className="absolute inset-0 bg-green-500/20 z-50 flex items-center justify-center cursor-pointer"
                    onClick={(e) => handleViewportClick(i, e)}
                  >
                    <div className="w-16 h-16 rounded-full bg-green-600 border-4 border-white flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
                      {arrangeClickOrder.indexOf(i) + 1}
                    </div>
                  </div>
                )}
                {isArrangeMode && !arrangeClickOrder.includes(i) && (
                  <div
                    className="absolute inset-0 z-50 cursor-pointer hover:bg-white/10"
                    onClick={(e) => handleViewportClick(i, e)}
                  />
                )}
              </div>
            );
          } else {
            return (
              <div
                key={`empty-${i}`}
                onClick={(e) => handleViewportClick(i, e)}
                style={{
                  ...areaStyle,
                  ...((isSelected || isMultiSelected) && !isArrangeMode ? { boxShadow: 'inset 0 0 0 3px #ef4444' } : {}),
                }}
                className="relative bg-black border border-gray-800 cursor-pointer overflow-hidden"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 text-xs gap-1 select-none">
                  <span className="text-2xl opacity-30">&#x2B1B;</span>
                  <span className="opacity-50">No image loaded</span>
                </div>
                {isArrangeMode && arrangeClickOrder.includes(i) && (
                  <div className="absolute inset-0 bg-green-500/20 z-50 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-green-600 border-4 border-white flex items-center justify-center text-white text-3xl font-bold shadow-2xl">
                      {arrangeClickOrder.indexOf(i) + 1}
                    </div>
                  </div>
                )}
              </div>
            );
          }
        })}
      </div>

      {/* Floating Apply Arrange Button */}
      {isArrangeMode && arrangeClickOrder.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100]">
          <button
            onClick={(e) => { e.stopPropagation(); toggleArrangeMode(); }}
            className="flex items-center gap-2 px-6 py-3 bg-app-accent pointer-events-auto hover:brightness-110 text-white rounded-full font-bold shadow-[0_10px_25px_-5px_rgba(239,68,68,0.5),0_0_15px_rgba(239,68,68,0.5)] transition-transform hover:scale-105"
          >
            <Check className="w-5 h-5" />
            Arrange the {arrangeClickOrder.length} images
          </button>
        </div>
      )}

      {/* Patient name bar */}
      <div className="text-center py-1 bg-gray-900 text-gray-200 text-xs border-t border-gray-700 font-semibold">
        {patientName} : {studyDate}
      </div>
    </div>
  );
}
