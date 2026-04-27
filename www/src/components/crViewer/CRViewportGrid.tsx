/**
 * CRViewportGrid — Grid layout for CR viewer matching reference software layouts.
 * Supports 1, 2, 4, 6, 8, 9 spot layouts with proper image fitting.
 * Features: red border selection, Ctrl+click multi-select, Shift+click swap, Ctrl+A select-all.
 */
import { useCallback, useRef, useEffect } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { CRViewport } from './CRViewport';
import { Check } from 'lucide-react';
import { useAspectGrid } from '@/hooks/useAspectGrid';
import { wasDblClickHandled } from '@/lib/annotationUtils';

/** Extract unique area letters from a CSS grid-template-areas string */
function getAreaLetters(areas: string): string[] {
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

export function CRViewportGrid() {
  const {
    currentLayout, currentPage, images, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection, selectAllViewports,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, toggleArrangeMode,
    swapImages, showLogo, toggleSingleViewport, setViewportImage,
    viewportImageOverrides, imageAspectRatio,
  } = useCRViewerStore();

  // Force-deselect multi-selection on non-Ctrl left-click.
  // Reads state directly from store to avoid stale closure issues.
  const handleViewportMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isArrangeMode) return;
    // Always collapse multi-selection on plain left-click
    useCRViewerStore.getState().setSelectedViewport(index);
  }, [isArrangeMode]);

  // Double-click: toggle single viewport (zoom in/out)
  const handleViewportDoubleClick = useCallback((index: number) => {
    if (isArrangeMode) return;
    if (wasDblClickHandled()) return;
    toggleSingleViewport(index);
  }, [isArrangeMode, toggleSingleViewport]);

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasImages = images.length > 0;
  const shiftFirstRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridSize = useAspectGrid(containerRef, currentLayout.cols, currentLayout.rows, imageAspectRatio);

  // Ctrl+A: select all viewports (capture phase)
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

    // Shift+click: swap instantly with the currently selected viewport
    if (e.shiftKey) {
      const first = selectedViewport;
      if (first !== index) {
        // Swap images globally
        const globalIdxA = startIndex + first;
        const globalIdxB = startIndex + index;
        swapImages(globalIdxA, globalIdxB);
      }
      setSelectedViewport(index);
      return;
    }

    // Ctrl+click: toggle multi-select
    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection, swapImages, startIndex, selectedViewport]);

  // Build grid style — gap creates visible separator lines using the container bg color
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
    backgroundColor: '#374151', // gray-700 separator color
    ...gridSize,
  };

  // Support asymmetric layouts with grid-template-areas
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

  return (
    // gray background shows through the 2px gap as visible separator lines between viewports
    <div className="flex-1 flex flex-col bg-gray-700 overflow-hidden relative">
      <div ref={containerRef} className="flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-gray-400 dark:bg-gray-600">
        <div ref={gridRef} style={gridStyle}>
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          // Check for viewport override (drag-and-drop placement)
          const overrideUrl = viewportImageOverrides[imgIndex];
          const overrideImage = (overrideUrl && overrideUrl !== 'deleted') ? images.find(img => img.imageUrl === overrideUrl) : null;
          // Use override if present, otherwise default to sequential
          const image = overrideImage || ((hasImages && imgIndex < images.length) ? images[imgIndex] : null);
          const rawImageId = image?.imageUrl || null;
          // Treat 'deleted' override as empty
          const imageId = overrideUrl === 'deleted' ? null : rawImageId;
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

          // For asymmetric layouts, assign grid-area by letter
          const areaStyle: React.CSSProperties = currentLayout.areas && areaNames[i]
            ? { gridArea: areaNames[i] }
            : {};

          // Empty slot — no CRViewport so no stale cornerstone canvas can appear
          if (!imageId) {
            return (
              <div
                key={`empty-cr-vp-${i}`}
                className="relative overflow-hidden min-h-0 bg-black"
                style={areaStyle}
                onClick={(e) => handleViewportClick(i, e)}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const imageUrl = e.dataTransfer.getData('application/dicom-image-url') || e.dataTransfer.getData('text/plain');
                  if (imageUrl) setViewportImage(imageUrl, i);
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
            <div key={`cr-vp-${i}`} className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : ''}`} style={areaStyle} onMouseDown={(e) => handleViewportMouseDown(i, e)} onDoubleClick={() => handleViewportDoubleClick(i)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={(e) => {
                e.preventDefault();
                const imageUrl = e.dataTransfer.getData('application/dicom-image-url') || e.dataTransfer.getData('text/plain');
                if (imageUrl) setViewportImage(imageUrl, i);
              }}
            >              <div className={`${isArrangeMode ? 'pointer-events-none' : ''} w-full h-full`}>
                <CRViewport
                  imageId={imageId}
                  isSelected={isSelected}
                  viewportIndex={i}
                  onClick={(e) => handleViewportClick(i, e)}
                  spotNumber={image ? image.instanceNumber : imgIndex + 1}
                  showLogo={showLogo}
                />
              </div>

              {/* Red selection border overlay — inset box-shadow so it's never clipped */}
              {(isSelected || isMultiSelected) && !isArrangeMode && (
                <div
                  className="absolute inset-0 z-40 pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 0 3px #ef4444' }}
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
