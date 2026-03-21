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

export function ViewportGrid() {
  const {
    currentLayout, currentPage, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection,
    patientName, studyDate, images, activeToolId, viewportsCleared,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, viewportImageOverrides, setViewportImageOverride, toggleArrangeMode
  } = useViewerStore();

  const gridRef = useRef<HTMLDivElement>(null);

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
    gap: '1px',
    padding: '1px',
    width: '100%',
    height: '100%',
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

  // Handle viewport click with multi-select (Ctrl+click adds to selection)
  const handleViewportClick = useCallback((index: number, e: React.MouseEvent) => {
    if (isArrangeMode) {
      toggleArrangeViewport(index);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection]);

  // Handle drop of a thumbnail image onto a specific viewport slot
  const handleViewportImageDrop = useCallback((slotIndex: number, imageUrl: string) => {
    setViewportImageOverride(slotIndex, imageUrl);
  }, [setViewportImageOverride]);

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
      className="flex-1 flex flex-col bg-black overflow-hidden relative"
      onDrop={handleGridDrop}
      onDragOver={handleDragOver}
    >
      <div ref={gridRef} style={gridStyle} className="flex-1">
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
            const imageId = overrideUrl || defaultImg?.imageUrl || null;

            const actualImgIndex = overrideUrl
              ? images.findIndex((img) => img.imageUrl === overrideUrl)
              : imgIndex;

            return (
              <div key={`vp-${i}`} style={areaStyle} className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : ''}`}>
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
                style={areaStyle}
                className={`relative bg-black border cursor-pointer overflow-hidden ${
                  isSelected && !isArrangeMode ? 'border-blue-500' : 'border-gray-800'
                }`}
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
