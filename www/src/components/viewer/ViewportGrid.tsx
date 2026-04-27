import { useCallback, useRef, useEffect } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { DicomViewport } from './DicomViewport';
import { useAnnotationPersistence, restoreAnnotations } from '@/hooks/useAnnotationPersistence';
import { useAspectGrid } from '@/hooks/useAspectGrid';
import { getStudyKey } from '@/stores/annotationStore';
import { Check } from 'lucide-react';
import { wasDblClickHandled } from '@/lib/annotationUtils';

/** Extract unique area letters from a CSS grid-template-areas string */
function getAreaLetters(areas: string): string[] {
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

export function ViewportGrid() {
  const {
    currentLayout, currentPage, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection,
    patientName, studyDate, images, activeToolId, viewportsCleared,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, viewportImageOverrides, viewportIndexOverrides, setViewportImageOverride, setViewportIndexOverride, toggleArrangeMode,
    toggleSingleViewport, imageAspectRatio
  } = useViewerStore();

  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shiftFirstRef = useRef<number | null>(null);

  const gridSize = useAspectGrid(containerRef, currentLayout.cols, currentLayout.rows, imageAspectRatio);
  const selectAllViewports = useViewerStore((s) => s.selectAllViewports);

  // Ctrl+A: select all viewports (capture phase so it fires before browser's native select-all)
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

  // Determine which images to show on this page
  const startIndex = (currentPage - 1) * currentLayout.spots;

  // Show empty slots when viewports are manually cleared, even if images array still has data
  const hasRealImages = images.length > 0 && !viewportsCleared;

  // Build grid style - handle asymmetric layouts with grid-template-areas
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
    backgroundColor: '#374151', // gray-700 separator lines between viewports
    ...gridSize,
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

  // Get grid area names for asymmetric layouts
  const areaNames = currentLayout.areas ? getAreaLetters(currentLayout.areas) : [];

  // Build the image stack (all imageIds) for scroll support
  const imageStack = hasRealImages
    ? images.map((img) => img.imageUrl || '')
    : [];

  // Handle viewport click with multi-select (Ctrl+click adds to selection) and Shift+click swap
  const handleViewportClick = useCallback((index: number, e: React.MouseEvent) => {
    if (isArrangeMode) {
      toggleArrangeViewport(index);
      return;
    }

    // Shift+click: swap instantly with the currently selected viewport
    if (e.shiftKey) {
      const first = selectedViewport;
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
          // Also track the original image indices for reliable number display
          const idxA = store.images.findIndex((img) => img.imageUrl === urlA);
          const idxB = store.images.findIndex((img) => img.imageUrl === urlB);
          if (idxA >= 0) store.setViewportIndexOverride(index, idxA);
          if (idxB >= 0) store.setViewportIndexOverride(first, idxB);
        }
      }
      setSelectedViewport(index);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection, selectedViewport]);

  const handleViewportDoubleClick = useCallback((index: number) => {
    if (isArrangeMode) return;
    if (wasDblClickHandled()) return;
    toggleSingleViewport(index);
  }, [isArrangeMode, toggleSingleViewport]);

  // Handle drop of a thumbnail image onto a specific viewport slot
  const handleViewportImageDrop = useCallback((slotIndex: number, imageUrl: string) => {
    setViewportImageOverride(slotIndex, imageUrl);
    // Also update the index override so the bottom-left number label reflects the dropped image
    const store = useViewerStore.getState();
    const origIdx = store.images.findIndex((img) => img.imageUrl === imageUrl);
    if (origIdx >= 0) {
      setViewportIndexOverride(slotIndex, origIdx);
    }
  }, [setViewportImageOverride, setViewportIndexOverride]);

  // Handle file drop onto the grid (external DICOM files)
  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const { loadLocalFiles } = useViewerStore.getState();
      if (loadLocalFiles) {
        loadLocalFiles(e.dataTransfer.files);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      className="flex-1 flex flex-col bg-gray-400 dark:bg-gray-600 overflow-hidden relative"
      onDrop={handleGridDrop}
      onDragOver={handleDragOver}
    >
      <div ref={containerRef} className="flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        <div ref={gridRef} style={gridStyle}>
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          // For asymmetric layouts, assign grid-area by letter
          const areaStyle: React.CSSProperties = currentLayout.areas && areaNames[i]
            ? { gridArea: areaNames[i] }
            : {};
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

          if (hasRealImages) {
            const overrideUrl = viewportImageOverrides[i];
            const defaultImg = images[imgIndex];
            const rawImageId = overrideUrl || defaultImg?.imageUrl || null;
            // Treat 'deleted' override as empty
            const imageId = rawImageId === 'deleted' ? null : rawImageId;

            // Use explicit index override first (set by swap/arrange), then URL-based lookup, then sequential
            const actualImgIndex = viewportIndexOverrides[i] !== undefined
              ? viewportIndexOverrides[i]
              : overrideUrl && overrideUrl !== 'deleted'
                ? images.findIndex((img) => img.imageUrl === overrideUrl)
                : imgIndex;

            // Empty slot — no DicomViewport at all so no stale cornerstone canvas can appear
            if (!imageId) {
              return (
                <div
                  key={`empty-vp-${i}`}
                  style={areaStyle}
                  className="relative overflow-hidden min-h-0 bg-black"
                  onClick={(e) => handleViewportClick(i, e)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
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
                </div>
              );
            }

            return (
              <div key={`vp-${i}`} style={areaStyle} className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : ''}`}
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
                {/* Image order label - bottom left */}
                <div className="absolute bottom-1 left-1 z-30 text-white text-base font-mono font-bold pointer-events-none select-none opacity-70 leading-none drop-shadow-md">
                  {(actualImgIndex >= 0 ? actualImgIndex : imgIndex) + 1}/{images.length}
                </div>
                {/* Selection border overlay - rendered ON TOP with box-shadow so it can't be clipped */}
                {(isSelected || isMultiSelected) && (
                  <div
                    className="absolute inset-0 z-40 pointer-events-none"
                    style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }}
                  />
                )}
                {/* Arrange Overlay */}
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
                {/* Arrange Click Catcher when not selected yet */}
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
                {/* Arrange Overlay */}
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
