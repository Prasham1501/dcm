/**
 * DualToolbar — Shared top toolbar for the Dual viewer.
 * Arrange (active panel), Stamp dropdown, Preview, Print.
 */
import { useState, useEffect } from 'react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { useUndoStore } from '@/stores/undoStore';
import { useReportStore } from '@/stores/reportStore';
import {
  ChevronLeft, ChevronRight, Printer, ListOrdered, MoveHorizontal, Move3d, Undo2, FileText,
} from 'lucide-react';
import { DualPrintPreview } from './DualPrintPreview';
import { undoLastAnnotationOnElement, deleteActiveAnnotationOnElement } from '@/lib/annotationUtils';

export function DualToolbar() {
  const {
    activePanel, panels, syncMove, setSyncMove,
    undoStampPlacement,
  } = useDualViewerStore();

  const leftP = panels.left;
  const rightP = panels.right;
  const activeP = panels[activePanel];
  const bothArranging = leftP.isArrangeMode && rightP.isArrangeMode;

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Delete key: delete active annotation from dual viewports
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        const viewports = document.querySelectorAll('[data-dual-viewport-index]');
        let deleted = false;
        viewports.forEach((el) => {
          if (!deleted && deleteActiveAnnotationOnElement(el as HTMLElement)) deleted = true;
        });
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation();
        useUndoStore.getState().undo('dualViewer');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-app-surface border-b border-app-border">
        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              if (syncMove) {
                useDualViewerStore.getState().panelPrevPage('left');
                useDualViewerStore.getState().panelPrevPage('right');
              } else {
                useDualViewerStore.getState().panelPrevPage(activePanel);
              }
            }}
            disabled={syncMove ? (leftP.currentPage <= 1 && rightP.currentPage <= 1) : activeP.currentPage <= 1}
            className="p-1 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title={syncMove ? "Previous page (both panels)" : "Previous page (active panel)"}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (syncMove) {
                useDualViewerStore.getState().panelNextPage('left');
                useDualViewerStore.getState().panelNextPage('right');
              } else {
                useDualViewerStore.getState().panelNextPage(activePanel);
              }
            }}
            disabled={syncMove ? (leftP.currentPage >= leftP.totalPages && rightP.currentPage >= rightP.totalPages) : activeP.currentPage >= activeP.totalPages}
            className="p-1 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title={syncMove ? "Next page (both panels)" : "Next page (active panel)"}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sync Move Toggle */}
        <button
          onClick={() => setSyncMove(!syncMove)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
            syncMove
              ? 'border-app-accent bg-app-accent text-white'
              : 'border-app-border text-app-text-secondary bg-app-surface hover:border-app-accent'
          }`}
          title={syncMove ? "Disable simultaneous movement" : "Enable simultaneous movement"}
        >
          {syncMove ? <Move3d className="w-3.5 h-3.5" /> : <MoveHorizontal className="w-3.5 h-3.5" />}
          Sync
        </button>

        {/* Arrange button (active panel) */}
        <button
          onClick={() => useDualViewerStore.getState().togglePanelArrangeMode(activePanel)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
            activeP.isArrangeMode
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
          }`}
          title="Arrange images (active panel)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Arrange
        </button>

        {/* Undo */}
        <button
          onClick={() => {
            useUndoStore.getState().undo('dualViewer');
          }}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 border-app-border text-app-text-secondary bg-app-bg hover:bg-app-hover transition-colors"
          title="Undo last annotation or stamp"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>

        {/* Arrange Both button */}
        <button
          onClick={() => useDualViewerStore.getState().toggleBothArrangeMode()}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
            bothArranging
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
          }`}
          title="Arrange images in both panels simultaneously"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Arrange Both
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Info */}
        <span className="text-[10px] text-app-text-muted">
          Active: {activePanel.toUpperCase()} | Page {activeP.currentPage}/{activeP.totalPages}
        </span>

        {/* Filter dropdown */}
        <select
          className="text-xs px-2 py-1 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
          defaultValue="All"
        >
          <option value="All">All</option>
          <option value="Current">Current</option>
        </select>

        {/* Print button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Print"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>

        {/* Report button - highlighted */}
        <button
          onClick={() => {
            const p = activeP;
            useReportStore.getState().openReportEditor(p.patientId, p.patientName, p.studyDate);
            useReportStore.getState().setShowInlineReport(true);
          }}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Create Report"
        >
          <FileText className="w-3.5 h-3.5" />
          Report
        </button>
      </div>

      {/* Modals */}
      {showPrintPreview && <DualPrintPreview onClose={() => setShowPrintPreview(false)} />}
    </>
  );
}
