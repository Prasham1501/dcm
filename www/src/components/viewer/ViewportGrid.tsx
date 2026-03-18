import { useCallback, useRef, useEffect, useState } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { DicomViewport } from './DicomViewport';
import { useAnnotationPersistence, restoreAnnotations } from '@/hooks/useAnnotationPersistence';
import { getStudyKey } from '@/stores/annotationStore';

/** Extract unique area letters from a CSS grid-template-areas string */
function getAreaLetters(areas: string): string[] {
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

export function ViewportGrid() {
  const {
    currentLayout, currentPage, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection,
    patientName, studyDate, images, activeToolId, viewportsCleared,
  } = useViewerStore();

  const gridRef = useRef<HTMLDivElement>(null);

  // Track per-viewport image overrides from thumbnail drag-and-drop
  const [viewportImageOverrides, setViewportImageOverrides] = useState<Record<number, string>>({});

  // Listen for annotation events and auto-save
  useAnnotationPersistence();

  // Restore annotations when study changes
  useEffect(() => {
    if (images.length === 0) return;
    const studyKey = getStudyKey(useViewerStore.getState().studyUID, images.map((img) => img.imageUrl));
    const timer = setTimeout(() => restoreAnnotations(studyKey), 1000);
    return () => clearTimeout(timer);
  }, [images]);

  // Clear viewport overrides when images change (new study loaded)
  useEffect(() => {
    setViewportImageOverrides({});
  }, [images]);

  // Listen for insert-all event to clear overrides (reset to sequential fill)
  useEffect(() => {
    const handler = () => setViewportImageOverrides({});
    document.addEventListener('dicom-insert-all', handler);
    return () => document.removeEventListener('dicom-insert-all', handler);
  }, []);

  // Determine which images to show on this page
  const startIndex = (currentPage - 1) * currentLayout.spots;

  // Show empty slots when viewports are manually cleared, even if images array still has data
  const hasRealImages = images.length > 0 && !viewportsCleared;

  // Build grid style - handle asymmetric layouts with grid-template-areas
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
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
    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [setSelectedViewport, toggleViewportSelection]);

  // Handle drop of a thumbnail image onto a specific viewport slot
  const handleViewportImageDrop = useCallback((slotIndex: number, imageUrl: string) => {
    setViewportImageOverrides((prev) => ({ ...prev, [slotIndex]: imageUrl }));
  }, []);

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
      className="flex-1 flex flex-col bg-black overflow-hidden"
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
              <div key={`vp-${i}`} style={areaStyle} className="relative overflow-hidden min-h-0">
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
            );
          } else {
            return (
              <div
                key={`empty-${i}`}
                onClick={(e) => handleViewportClick(i, e)}
                style={areaStyle}
                className={`relative bg-black border cursor-pointer overflow-hidden ${
                  isSelected ? 'border-blue-500' : 'border-gray-800'
                }`}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700 text-xs gap-1 select-none">
                  <span className="text-2xl opacity-30">&#x2B1B;</span>
                  <span className="opacity-50">No image loaded</span>
                </div>
              </div>
            );
          }
        })}
      </div>

      {/* Patient name bar */}
      <div className="text-center py-1 bg-gray-900 text-gray-200 text-xs border-t border-gray-700 font-semibold">
        {patientName} : {studyDate}
      </div>
    </div>
  );
}
