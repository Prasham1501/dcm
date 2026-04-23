import { useState, useEffect, useCallback, RefObject } from 'react';

export function useAspectGrid(
  containerRef: RefObject<HTMLDivElement>,
  layoutCols: number,
  layoutRows: number,
  imageAspectRatio: number = 4 / 3
) {
  const [gridSize, setGridSize] = useState({ width: '100%', height: '100%' });

  const calculateSize = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Get available container size
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    if (containerWidth === 0 || containerHeight === 0) return;

    // Calculate grid aspect ratio
    const cols = Math.max(1, layoutCols);
    const rows = Math.max(1, layoutRows);
    const gridAspect = (cols / rows) * imageAspectRatio;
    
    // Fit within container
    let gridWidth = containerWidth;
    let gridHeight = gridWidth / gridAspect;
    
    if (gridHeight > containerHeight) {
      gridHeight = containerHeight;
      gridWidth = gridHeight * gridAspect;
    }
    
    setGridSize({
      width: `${Math.floor(gridWidth)}px`,
      height: `${Math.floor(gridHeight)}px`
    });
  }, [containerRef, layoutCols, layoutRows, imageAspectRatio]);

  useEffect(() => {
    calculateSize();
    
    const observer = new ResizeObserver(() => {
      calculateSize();
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [calculateSize, containerRef]);

  // Re-calculate when window resizes or fullscreen toggles
  useEffect(() => {
    window.addEventListener('resize', calculateSize);
    document.addEventListener('fullscreenchange', calculateSize);
    return () => {
      window.removeEventListener('resize', calculateSize);
      document.removeEventListener('fullscreenchange', calculateSize);
    };
  }, [calculateSize]);

  return gridSize;
}
