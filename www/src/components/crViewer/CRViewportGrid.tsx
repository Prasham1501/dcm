/**
 * CRViewportGrid — Grid layout for CR viewer matching reference software layouts.
 * Supports 1, 2, 4, 6, 8, 9 spot layouts with proper image fitting.
 * Features: red border selection, Ctrl+click multi-select, Shift+click swap, Ctrl+A select-all.
 */
import { useCallback, useRef, useEffect } from 'react';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { CRViewport } from './CRViewport';
import { Check } from 'lucide-react';

export function CRViewportGrid() {
  const {
    currentLayout, currentPage, images, selectedViewport, setSelectedViewport,
    selectedViewportIndices, toggleViewportSelection, selectAllViewports,
    isArrangeMode, arrangeClickOrder, toggleArrangeViewport, toggleArrangeMode,
    viewportImageOverrides, setViewportImageOverride, showLogo,
  } = useCRViewerStore();

  const startIndex = (currentPage - 1) * currentLayout.spots;
  const hasImages = images.length > 0;
  const shiftFirstRef = useRef<number | null>(null);

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

    // Shift+click: swap two viewports
    if (e.shiftKey) {
      if (shiftFirstRef.current === null) {
        shiftFirstRef.current = index;
        setSelectedViewport(index);
      } else {
        const first = shiftFirstRef.current;
        shiftFirstRef.current = null;
        if (first !== index) {
          const store = useCRViewerStore.getState();
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
          }
        }
        setSelectedViewport(index);
      }
      return;
    }

    shiftFirstRef.current = null;

    // Ctrl+click: toggle multi-select
    if (e.ctrlKey || e.metaKey) {
      toggleViewportSelection(index);
    } else {
      setSelectedViewport(index);
    }
  }, [isArrangeMode, toggleArrangeViewport, setSelectedViewport, toggleViewportSelection, setViewportImageOverride]);

  // Build grid style — gap creates visible separator lines using the container bg color
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    padding: '2px',
    width: '100%',
    height: '100%',
    gridTemplateColumns: `repeat(${currentLayout.cols}, 1fr)`,
    gridTemplateRows: `repeat(${currentLayout.rows}, 1fr)`,
    backgroundColor: '#374151', // gray-700 separator color
  };

  return (
    // gray background shows through the 2px gap as visible separator lines between viewports
    <div className="flex-1 flex flex-col bg-gray-700 overflow-hidden relative">
      <div style={gridStyle} className="flex-1">
        {Array.from({ length: currentLayout.spots }, (_, i) => {
          const imgIndex = startIndex + i;
          const overrideUrl = viewportImageOverrides[i];
          const defaultImg = hasImages ? images[imgIndex] : null;
          const imageId = overrideUrl || defaultImg?.imageUrl || null;
          const isSelected = selectedViewport === i;
          const isMultiSelected = selectedViewportIndices.includes(i) && selectedViewportIndices.length > 1;

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
