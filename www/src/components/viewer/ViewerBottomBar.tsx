import { useCallback } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { cornerstone } from '@/lib/cornerstoneSetup';
import { setWindowLevel, setZoom as csSetZoom } from '@/lib/viewerTools';

function getSelectedViewportElement(): HTMLDivElement | null {
  const { selectedViewport } = useViewerStore.getState();
  const byIndex = document.querySelector(`[data-viewport-index="${selectedViewport}"]`) as HTMLDivElement;
  if (byIndex) return byIndex;
  const viewports = document.querySelectorAll('[data-cornerstone-enabled="true"]');
  return (viewports[selectedViewport] as HTMLDivElement) || (viewports[0] as HTMLDivElement) || null;
}

export function ViewerBottomBar() {
  const { level, width, zoom, showLogo, setLevel, setWidth, setZoom, setShowLogo, loadProgress, loadingStudy } = useViewerStore();

  const handleLevelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLevel(val);
    const el = getSelectedViewportElement();
    if (el) {
      const { width: w } = useViewerStore.getState();
      setWindowLevel(el, w, val);
    }
  }, [setLevel]);

  const handleWidthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setWidth(val);
    const el = getSelectedViewportElement();
    if (el) {
      const { level: l } = useViewerStore.getState();
      setWindowLevel(el, val, l);
    }
  }, [setWidth]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setZoom(val);
    const el = getSelectedViewportElement();
    if (el) {
      csSetZoom(el, val);
    }
  }, [setZoom]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-4 2xl:gap-6 px-1.5 sm:px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-surface border-t border-app-border overflow-x-auto no-scrollbar">
      {/* Loading indicator */}
      {loadingStudy && (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[8px] sm:text-[9px] text-app-accent">{loadProgress}%</span>
        </div>
      )}

      {/* Level (Window Center) */}
      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[7px] sm:text-[10px] font-semibold text-app-accent whitespace-nowrap min-w-[20px] sm:min-w-[32px]">L</label>
        <span className="hidden sm:inline text-[9px] text-app-text-muted min-w-[28px] text-right tabular-nums">{level}</span>
        <input
          type="range"
          min="-1000"
          max="1000"
          value={level}
          onChange={handleLevelChange}
          className="w-12 sm:w-24 h-1 accent-app-accent"
        />
      </div>

      {/* Width (Window Width) */}
      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[7px] sm:text-[10px] font-semibold text-app-accent whitespace-nowrap min-w-[20px] sm:min-w-[32px]">W</label>
        <span className="hidden sm:inline text-[9px] text-app-text-muted min-w-[28px] text-right tabular-nums">{width}</span>
        <input
          type="range"
          min="1"
          max="4000"
          value={width}
          onChange={handleWidthChange}
          className="w-12 sm:w-24 h-1 accent-app-accent"
        />
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[7px] sm:text-[10px] font-semibold text-app-accent whitespace-nowrap min-w-[20px] sm:min-w-[32px]">Z</label>
        <span className="hidden sm:inline text-[9px] text-app-text-muted min-w-[28px] text-right tabular-nums">{zoom.toFixed(2)}</span>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.01"
          value={zoom}
          onChange={handleZoomChange}
          className="w-12 sm:w-24 h-1 accent-app-accent"
        />
      </div>

      {/* Logo checkbox */}
      <label className="flex items-center gap-1.5 ml-auto cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={showLogo}
          onChange={(e) => setShowLogo(e.target.checked)}
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 accent-app-accent"
        />
        <span className="text-[7px] sm:text-[10px] font-semibold text-app-accent uppercase tracking-wider">Logo</span>
      </label>
    </div>
  );
}
