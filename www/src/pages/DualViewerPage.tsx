/**
 * DualViewerPage — Route page for the Dual comparison viewer.
 * Reads launch data from localStorage, loads both panels, renders full layout.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { useReportStore } from '@/stores/reportStore';
import { DualToolbar } from '@/components/dualViewer/DualToolbar';
import { ReportRouterHost } from '@/features/report-router/ReportRouterHost';
import { DualViewportPanel } from '@/components/dualViewer/DualViewportPanel';
import { DualSidebar } from '@/components/dualViewer/DualSidebar';
import { DualThumbnailSidebar } from '@/components/dualViewer/DualThumbnailSidebar';
import { InlineReportPanel } from '@/components/report/InlineReportPanel';
import { ChevronLeft, X, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';

export function DualViewerPage() {
  const navigate = useNavigate();
  const { panels, activePanel, loadPanelStudy } = useDualViewerStore();
  const { mode, toggleTheme } = useThemeStore();
  const showInlineReport = useReportStore((s) => s.showInlineReport);
  const launchChecked = useRef(false);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const leftP = panels.left;
  const rightP = panels.right;
  const activeP = panels[activePanel];

  // Check for launch data in localStorage
  useEffect(() => {
    if (launchChecked.current) return;
    launchChecked.current = true;

    try {
      const launchData = localStorage.getItem('dual-viewer-launch');
      if (launchData) {
        const data = JSON.parse(launchData);
        if (Date.now() - data.timestamp < 10000) {
          loadPanelStudy('left', {
            patientName: data.leftStudy.patientName,
            patientId: data.leftStudy.patientId,
            studyDate: data.leftStudy.studyDate,
            filePaths: data.leftStudy.filePaths,
            modality: data.leftStudy.modality,
            studyDescription: data.leftStudy.studyDescription,
          });
          loadPanelStudy('right', {
            patientName: data.rightStudy.patientName,
            patientId: data.rightStudy.patientId,
            studyDate: data.rightStudy.studyDate,
            filePaths: data.rightStudy.filePaths,
            modality: data.rightStudy.modality,
            studyDescription: data.rightStudy.studyDescription,
          });
        }
        localStorage.removeItem('dual-viewer-launch');
      }
    } catch { /* ignore parse errors */ }
  }, [loadPanelStudy]);

  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  // Keyboard navigation for pages (arrow keys on active panel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const { syncMove, activePanel } = useDualViewerStore.getState();

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        if (syncMove) {
          useDualViewerStore.getState().panelNextPage('left');
          useDualViewerStore.getState().panelNextPage('right');
        } else {
          useDualViewerStore.getState().panelNextPage(activePanel);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (syncMove) {
          useDualViewerStore.getState().panelPrevPage('left');
          useDualViewerStore.getState().panelPrevPage('right');
        } else {
          useDualViewerStore.getState().panelPrevPage(activePanel);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

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
          <span className="text-xs font-bold text-app-accent uppercase tracking-wide">Dual Viewer</span>
        </div>

        {/* Center: Patient info (both panels) */}
        <div className="flex items-center gap-3 text-xs">
          {leftP.patientName && (
            <span className="font-bold text-app-text-secondary truncate max-w-[150px]" title="Left panel">
              L: {leftP.patientName}
            </span>
          )}
          <span className="text-app-text-muted">vs</span>
          {rightP.patientName && (
            <span className="font-bold text-app-text-secondary truncate max-w-[150px]" title="Right panel">
              R: {rightP.patientName}
            </span>
          )}
        </div>

        {/* Right: Page info + theme */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-text-secondary">
            Page {activeP.currentPage}/{activeP.totalPages}
            <span className="text-app-accent font-semibold ml-1">({activeP.totalImages})</span>
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
            {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <DualToolbar />

      {/* Main content: two panels + sidebars (+ optional inline report) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Viewport area — shrinks to 70% when report panel is open */}
        <div className={`flex flex-col overflow-hidden ${showInlineReport ? 'w-[70%]' : 'flex-1'}`}>
          <div className="flex-1 flex overflow-hidden">
            {/* Left thumbnail */}
            {showThumbnails && <DualThumbnailSidebar panelId="left" />}

            <DualViewportPanel panelId="left" />
            <div className="w-1 bg-gray-600 flex-shrink-0" />
            <DualViewportPanel panelId="right" />

            {/* Right sidebars — right thumbnail + controls */}
            <div className="flex h-full border-l border-app-border">
              {showThumbnails && <DualThumbnailSidebar panelId="right" />}
              <DualSidebar />
            </div>
          </div>

          {/* Bottom bar — patient names below their respective panels */}
          <div className="flex border-t border-gray-700 bg-gray-900">
            <div className="flex-1 text-center py-1 text-xs font-semibold text-gray-300 truncate px-2 border-r border-gray-700">
              {leftP.patientName || 'Left'} — {leftP.studyDate}
            </div>
            <div className="flex-1 text-center py-1 text-xs font-semibold text-gray-300 truncate px-2">
              {rightP.patientName || 'Right'} — {rightP.studyDate}
            </div>
          </div>
        </div>

        {/* Inline report panel — 30% width */}
        {showInlineReport && (
          <div className="w-[30%] flex-shrink-0 overflow-hidden">
            <InlineReportPanel />
          </div>
        )}
      </div>

      {/* Report type picker modal */}
      <ReportRouterHost />
    </div>
  );
}
