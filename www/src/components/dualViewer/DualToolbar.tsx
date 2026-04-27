/**
 * DualToolbar — Shared top toolbar for the Dual viewer.
 * Arrange (active panel), Stamp dropdown, Preview, Print.
 */
import { useState, useEffect } from 'react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import {
  ChevronLeft, ChevronRight, Printer, Eye, ListOrdered, Stamp, MoveHorizontal, Move3d, Undo2,
} from 'lucide-react';
import { DualStampCreatorModal } from './DualStampCreatorModal';
import { DualPrintPreview } from './DualPrintPreview';
import { undoLastAnnotationOnElement, deleteActiveAnnotationOnElement } from '@/lib/annotationUtils';

export function DualToolbar() {
  const {
    activePanel, panels, syncMove, setSyncMove,
    isStampMode, setStampMode, stamps, activeStampId, setActiveStamp,
    undoStampPlacement, clearStampPlacements, stampPlacements,
  } = useDualViewerStore();

  const leftP = panels.left;
  const rightP = panels.right;
  const activeP = panels[activePanel];
  const bothArranging = leftP.isArrangeMode && rightP.isArrangeMode;

  const [showStampCreator, setShowStampCreator] = useState(false);
  const [showStampDropdown, setShowStampDropdown] = useState(false);
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
        const viewports = document.querySelectorAll('[data-dual-viewport-index]');
        let undone = false;
        viewports.forEach((el) => {
          if (!undone && undoLastAnnotationOnElement(el as HTMLElement)) undone = true;
        });
        if (!undone) undoStampPlacement();
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
            // Try all viewports: active panel first, then other panel
            const otherPanel = activePanel === 'left' ? 'right' : 'left';
            const panelOrder = [activePanel, otherPanel];
            let undone = false;
            for (const pId of panelOrder) {
              if (undone) break;
              const viewports = document.querySelectorAll(`[data-dual-viewport-index^="${pId}-"]`);
              viewports.forEach((el) => {
                if (!undone && undoLastAnnotationOnElement(el as HTMLElement)) undone = true;
              });
            }
            if (!undone) undoStampPlacement();
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

        {/* Preview button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          title="Print preview"
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>

        {/* Print button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Print"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>

        {/* Filter dropdown */}
        <select
          className="text-xs px-2 py-1 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none ml-1"
          defaultValue="All"
        >
          <option value="All">All</option>
          <option value="Current">Current</option>
        </select>

        {/* Stamp button with dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => {
              if (stamps.length === 0) setShowStampCreator(true);
              else setShowStampDropdown(!showStampDropdown);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
              isStampMode
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
            }`}
            title="Stamp tool"
          >
            <Stamp className="w-3.5 h-3.5" />
            Stamp
          </button>

          {showStampDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-app-bg border border-app-border rounded-lg shadow-xl min-w-[200px] py-1">
              {stamps.map((stamp) => (
                <button
                  key={stamp.id}
                  onClick={() => {
                    setActiveStamp(stamp.id);
                    setStampMode(true);
                    setShowStampDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-app-hover flex items-center gap-2 ${
                    activeStampId === stamp.id ? 'bg-app-accent/20 text-app-accent' : 'text-app-text'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
                  <span className="truncate">{stamp.name}</span>
                </button>
              ))}
              <div className="border-t border-app-border mt-1 pt-1">
                <button
                  onClick={() => { setShowStampCreator(true); setShowStampDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-app-accent hover:bg-app-hover font-semibold"
                >
                  + Create new stamp
                </button>
                <button
                  onClick={() => undoStampPlacement()}
                  disabled={stampPlacements.length === 0}
                  className="w-full text-left px-3 py-1.5 text-xs text-yellow-400 hover:bg-app-hover font-semibold disabled:opacity-30"
                >
                  ↩ Undo last stamp
                </button>
                <button
                  onClick={() => { clearStampPlacements(); setShowStampDropdown(false); }}
                  disabled={stampPlacements.length === 0}
                  className="w-full text-left px-3 py-1.5 text-xs text-orange-400 hover:bg-app-hover font-semibold disabled:opacity-30"
                >
                  ✕ Reset all stamps
                </button>
                {isStampMode && (
                  <button
                    onClick={() => { setStampMode(false); setShowStampDropdown(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-app-hover font-semibold"
                  >
                    Exit stamp mode
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Info */}
        <span className="text-[10px] text-app-text-muted">
          Active: {activePanel.toUpperCase()} | Page {activeP.currentPage}/{activeP.totalPages}
        </span>
      </div>

      {/* Modals */}
      {showStampCreator && <DualStampCreatorModal onClose={() => setShowStampCreator(false)} />}
      {showPrintPreview && <DualPrintPreview onClose={() => setShowPrintPreview(false)} />}

      {/* Close stamp dropdown on outside click */}
      {showStampDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowStampDropdown(false)} />
      )}
    </>
  );
}
