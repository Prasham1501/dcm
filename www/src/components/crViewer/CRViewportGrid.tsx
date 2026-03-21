/**
 * CRViewportGrid — Grid layout for CR viewer matching reference software layouts.
 * Supports 1, 2, 4, 6, 8, 9 spot layouts with proper image fitting.
 */
import { useCallback } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { CRViewport } from './CRViewport';
import { Check } from 'lucide-react';

export function CRViewportGrid() {
  const {
    currentLayout, currentPage, images, selectedViewport, setSelectedViewport,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, toggleArrangeMode,
    viewportImageOverrides, showLogo,
  } = useCRViewerStore();

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasImages = images.length > 0;

  const handleViewportClick = useCallback((index: number, e: React.MouseEvent) => {
    if (isArrangeMode) {
      toggleArrangeViewport(index);
      return;
    }
    setSelectedViewport(index);
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport]);

  // Build grid style — gap creates visible separator lines using the container bg color
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '1px',
    width: '100%',
    height: '100%',
    gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
  };

  return (
    // bg-gray-600 shows through the 3px gap as visible separator lines between viewports
    <div className="flex-1 flex flex-col bg-gray-600 overflow-hidden relative">
      <div style={gridStyle} className="flex-1">
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          const overrideUrl = viewportImageOverrides[i];
          const defaultImg = hasImages ? images[imgIndex] : null;
          const imageId = overrideUrl || defaultImg?.imageUrl || null;
          const isSelected = selectedViewport === i;

          return (
            <div key={`cr-vp-${i}`} className={`relative overflow-hidden min-h-0 ${isArrangeMode ? 'cursor-pointer' : ''}`}>
              <div className={`${isArrangeMode ? 'pointer-events-none' : ''} w-full h-full`}>
                <CRViewport
                  imageId={imageId}
                  isSelected={isSelected}
                  viewportIndex={i}
                  onClick={(e) => handleViewportClick(i, e)}
                  spotNumber={imgIndex + 1}
                  showLogo={showLogo}
                />
              </div>
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
