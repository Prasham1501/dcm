/**
 * CRViewerPage — Independent CR format viewer page.
 * Completely separate from the main ViewerPage.
 * Opens in a popup window (Electron) or same window (browser fallback).
 * Reads launch data from localStorage when opened as a popup.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import { CRToolbar } from '@/components/crViewer/CRToolbar';
import { CRViewportGrid } from '@/components/crViewer/CRViewportGrid';
import { CRSidebar } from '@/components/crViewer/CRSidebar';
import { CRThumbnailSidebar } from '@/components/crViewer/CRThumbnailSidebar';
import { InlineReportPanel } from '@/components/report/InlineReportPanel';
import { ChevronLeft, X, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';

/** Auto-extract measurements + metadata in background when images are loaded */
async function autoExtract(filePaths: string[], patientId: string) {
  const store = useReportStore.getState();
  // Skip if already running or done for this session
  if (store.extractionStatus === 'running') return;

  const api = (window as any).electronAPI;

  // Extract DICOM metadata (fast — no OCR)
  if (api?.invoke && filePaths.length > 0) {
    try {
      const meta = await api.invoke('extract-dicom-metadata', { filePaths });
      if (meta && Object.keys(meta).length > 0) {
        useReportStore.getState().setDicomMetadata(meta);
      }
    } catch { /* metadata extraction is best-effort */ }
  }

  // Run OCR extraction
  store.setExtractionStatus('running');
  try {
    const { extractReadings } = await import('@/lib/usgExtraction/extractReadings');
    const result = await extractReadings({
      studyUID: patientId || 'auto',
      orthancStudyId: '',
      orthancInstanceIds: [],
      imageUrls: useCRViewerStore.getState().images.map((img: any) => img.imageUrl),
      filePaths,
      hfToken: '',
    });
    useReportStore.getState().setActiveReadingSet(result.readings.length > 0 ? result : null);
    useReportStore.getState().setExtractionStatus('done');
  } catch (err) {
    console.warn('[autoExtract] failed:', err);
    useReportStore.getState().setExtractionStatus('failed');
  }
}

export function CRViewerPage() {
  const navigate = useNavigate();
  const { patientName, patientId, studyDate, totalImages, currentPage, totalPages, loadStudy } = useCRViewerStore();
  const { mode, toggleTheme } = useThemeStore();
  const showInlineReport = useReportStore((s) => s.showInlineReport);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const launchChecked = useRef(false);

  // Check for launch data in localStorage (when opened as popup window)
  useEffect(() => {
    if (launchChecked.current) return;
    launchChecked.current = true;

    try {
      const launchData = localStorage.getItem('cr-viewer-launch');
      if (launchData) {
        const data = JSON.parse(launchData);
        // Only use if fresh (within 10 seconds)
        if (Date.now() - data.timestamp < 10000) {
          loadStudy({
            patientName: data.patientName,
            patientId: data.patientId,
            studyDate: data.studyDate,
            filePaths: data.filePaths,
          });
          // Auto-extract measurements in background (no user action needed)
          autoExtract(data.filePaths, data.patientId);
        }
        localStorage.removeItem('cr-viewer-launch');
      }
    } catch { /* ignore parse errors */ }
  }, [loadStudy]);

  // Keyboard navigation for pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        useCRViewerStore.getState().nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        useCRViewerStore.getState().prevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Detect if we're in a popup window (opener exists or no navigation history)
  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-header-bg border-b border-app-border">
        {/* Left: back/close + title */}
        <div className="flex items-center gap-2 2xl:gap-3">
          {isPopup ? (
            <button
              onClick={() => window.close()}
              className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
              title="Close viewer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
              title="Back to patient list"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Patients
            </button>
          )}
          <span className="text-xs 2xl:text-sm font-bold text-app-accent uppercase tracking-wide">Viewer</span>
        </div>

        {/* Center: Patient info */}
        <div className="flex items-center gap-3 text-xs 2xl:text-sm">
          {patientName && (
            <>
              <span className="font-bold text-app-accent truncate max-w-[250px]">{patientName}</span>
              {patientId && <span className="text-app-text font-semibold">ID: {patientId}</span>}
              {studyDate && <span className="text-app-text font-semibold">{studyDate}</span>}
            </>
          )}
        </div>

        {/* Right: Page info + theme */}
        <div className="flex items-center gap-2 2xl:gap-3">
          <span className="text-xs 2xl:text-sm text-app-text-secondary font-medium">
            Page {currentPage}/{totalPages}
            <span className="text-app-accent font-bold ml-1">({totalImages})</span>
          </span>
          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}
          >
            {showThumbnails ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={mode === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {mode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <CRToolbar />

      {/* Main content: viewport grid + sidebar (+ optional inline report) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Viewport area — shrinks to 60% when report panel is open */}
        <div className={`flex overflow-hidden ${showInlineReport ? 'w-[60%]' : 'flex-1'}`}>
          <CRViewportGrid />
          <div className="flex h-full border-l border-app-border">
            {showThumbnails && <CRThumbnailSidebar />}
            <CRSidebar />
          </div>
        </div>

        {/* Inline report panel — 40% width */}
        {showInlineReport && (
          <div className="w-[40%] flex-shrink-0 overflow-hidden">
            <InlineReportPanel />
          </div>
        )}
      </div>

      {/* Bottom bar: patient name + study date */}
      <div className="text-center py-1 2xl:py-1.5 bg-gray-900 text-gray-200 text-xs 2xl:text-sm border-t border-gray-700 font-semibold">
        {patientName} : {studyDate}
      </div>
    </div>
  );
}
