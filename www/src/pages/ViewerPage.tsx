import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import { ViewportGrid } from '@/components/viewer/ViewportGrid';
import { ThumbnailSidebar } from '@/components/viewer/ThumbnailSidebar';
import { ViewerActionBar } from '@/components/viewer/ViewerActionBar';
import { ToolsPanel } from '@/components/viewer/ToolsPanel';
import { ViewerBottomBar } from '@/components/viewer/ViewerBottomBar';
import { CineControls } from '@/components/viewer/CineControls';
import { LayoutSelector } from '@/components/viewer/LayoutSelector';
import { SettingsModal } from '@/components/viewer/SettingsModal';
import { PrintPreview } from '@/components/print/PrintPreview';
import { PrinterModal } from '@/components/print/PrinterModal';
import { usePrintStore } from '@/stores/printStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useCustomAnnotationStore } from '@/stores/customAnnotationStore';

export function ViewerPage() {
  const { showPrintPreview, showPrinterModal } = usePrintStore();
  const { showCine, setShowCine, stopCine } = useViewerStore();
  const [searchParams] = useSearchParams();
  const undo = useCustomAnnotationStore((s) => s.undo);

  // Global Ctrl+Z undo listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  // Auto-open cine if ?cine=1 in URL
  useEffect(() => {
    if (searchParams.get('cine') === '1') {
      setShowCine(true);
    }
  }, [searchParams, setShowCine]);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header */}
      <ViewerHeader />

      {/* Main viewer area */}
      <div className="flex-1 flex overflow-hidden">
        {/* STUDY vertical tab on left edge */}
        <div className="w-5 bg-app-surface border-r border-app-border flex flex-col items-center justify-center">
          {'STUDY'.split('').map((ch, i) => (
            <span key={i} className="text-[10px] font-bold text-app-accent leading-tight cursor-pointer hover:text-app-accent-hover">
              {ch}
            </span>
          ))}
        </div>

        {/* Viewport grid (center) */}
        <ViewportGrid />

        {/* Action bar (between viewports and thumbnails) */}
        <ViewerActionBar />

        {/* Thumbnail sidebar (right of viewports) */}
        <div className="relative">
          <ThumbnailSidebar />
        </div>

        {/* Tools panel (far right) */}
        <ToolsPanel />
      </div>

      {/* Cine controls (togglable) */}
      {showCine && (
        <CineControls onClose={() => { stopCine(); setShowCine(false); }} />
      )}

      {/* Bottom bar: Level, Width, Zoom, Logo */}
      <ViewerBottomBar />

      {/* Layout selector modal */}
      <LayoutSelector />

      {/* Settings modal */}
      <SettingsModal />

      {/* Print modals */}
      {showPrintPreview && <PrintPreview />}
      {showPrinterModal && <PrinterModal />}
    </div>
  );
}
