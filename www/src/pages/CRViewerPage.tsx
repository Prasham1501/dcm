/**
 * CRViewerPage — Independent CR format viewer page.
 * Completely separate from the main ViewerPage.
 * Opens in a popup window (Electron) or same window (browser fallback).
 * Reads launch data from localStorage when opened as a popup.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import { CRToolbar } from '@/components/crViewer/CRToolbar';
import { CRViewportGrid } from '@/components/crViewer/CRViewportGrid';
import { CRSidebar } from '@/components/crViewer/CRSidebar';
import { CRThumbnailSidebar } from '@/components/crViewer/CRThumbnailSidebar';
import { InlineReportPanel } from '@/components/report/InlineReportPanel';
import { ChevronLeft, X } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';

export function CRViewerPage() {
  const navigate = useNavigate();
  const { patientName, patientId, studyDate, totalImages, currentPage, totalPages, loadStudy } = useCRViewerStore();
  const { mode, toggleTheme } = useThemeStore();
  const showInlineReport = useReportStore((s) => s.showInlineReport);
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
        }
        localStorage.removeItem('cr-viewer-launch');
      }
    } catch { /* ignore parse errors */ }
  }, [loadStudy]);

  // Detect if we're in a popup window (opener exists or no navigation history)
  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-app-header-bg border-b border-app-border">
        {/* Left: back/close + title */}
        <div className="flex items-center gap-2">
          {isPopup ? (
            <button
              onClick={() => window.close()}
              className="px-2 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
              title="Close viewer"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="px-2 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
              title="Back to patient list"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Patients
            </button>
          )}
          <span className="text-xs font-bold text-app-accent uppercase tracking-wide">Viewer</span>
        </div>

        {/* Center: Patient info */}
        <div className="flex items-center gap-3 text-xs">
          {patientName && (
            <>
              <span className="font-bold text-app-accent truncate max-w-[200px]">{patientName}</span>
              {patientId && <span className="text-app-text-muted">ID: {patientId}</span>}
              {studyDate && <span className="text-app-text-muted">{studyDate}</span>}
            </>
          )}
        </div>

        {/* Right: Page info + theme */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-text-secondary">
            Page {currentPage}/{totalPages}
            <span className="text-app-accent font-semibold ml-1">({totalImages})</span>
          </span>
          <button
            onClick={toggleTheme}
            className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={mode === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <CRToolbar />

      {/* Main content: viewport grid + sidebar (+ optional inline report) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Viewport area — shrinks to 70% when report panel is open */}
        <div className={`flex overflow-hidden ${showInlineReport ? 'w-[70%]' : 'flex-1'}`}>
          <CRViewportGrid />
          <div className="flex h-full border-l border-app-border">
            <CRThumbnailSidebar />
            <CRSidebar />
          </div>
        </div>

        {/* Inline report panel — 30% width */}
        {showInlineReport && (
          <div className="w-[30%] flex-shrink-0 overflow-hidden">
            <InlineReportPanel />
          </div>
        )}
      </div>

      {/* Bottom bar: patient name + study date */}
      <div className="text-center py-1 bg-gray-900 text-gray-200 text-xs border-t border-gray-700 font-semibold">
        {patientName} : {studyDate}
      </div>
    </div>
  );
}
