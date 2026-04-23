import { useEffect, useRef } from 'react';
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
  const { showCine, setShowCine, stopCine, loadStudyFiles } = useViewerStore();
  const [searchParams] = useSearchParams();
  const undo = useCustomAnnotationStore((s) => s.undo);
  const launchChecked = useRef(false);

  // Check for launch data in localStorage (when opened as popup window)
  useEffect(() => {
    if (launchChecked.current) return;
    launchChecked.current = true;

    try {
      const launchData = localStorage.getItem('viewer-launch');
      if (launchData) {
        const data = JSON.parse(launchData);
        // Only use if fresh (within 10 seconds)
        if (Date.now() - data.timestamp < 10000) {
          loadStudyFiles({
            patientName: data.patientName,
            patientId: data.patientId,
            studyDate: data.studyDate,
            filePaths: data.filePaths,
          });
        }
        localStorage.removeItem('viewer-launch');
      }
    } catch { /* ignore parse errors */ }
  }, [loadStudyFiles]);

  // Global Ctrl+Z undo and Ctrl+A select-all listener
  const selectAllViewports = useViewerStore((s) => s.selectAllViewports);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();
        selectAllViewports();
      }
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        useViewerStore.getState().nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        useViewerStore.getState().prevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [undo, selectAllViewports]);

  // Auto-open cine if ?cine=1 in URL
  useEffect(() => {
    if (searchParams.get('cine') === '1') {
      setShowCine(true);
    }
  }, [searchParams, setShowCine]);

  return (
    <div className="flex flex-col h-screen bg-app-bg select-none">
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
