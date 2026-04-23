/**
 * CRToolbar — Top toolbar for the CR viewer.
 * Contains: Format selector, navigation arrows, Arrange, Preview, Print, Stamp buttons.
 */
import { useState } from 'react';
import { useCRViewerStore, CR_LAYOUTS, type CRLayout } from '@/stores/crViewerStore';
import {
  ChevronLeft, ChevronRight, Printer, Eye, ListOrdered, Stamp, Trash2
} from 'lucide-react';
import { StampCreatorModal } from './StampCreatorModal';
import { CRPrintPreview } from './CRPrintPreview';

export function CRToolbar() {
  const {
    currentLayout, setLayout, totalImages,
    isArrangeMode, toggleArrangeMode,
    nextPage, prevPage, currentPage, totalPages,
    isStampMode, setStampMode, stamps, activeStampId, setActiveStamp,
    undoStampPlacement, clearStampPlacements, stampPlacements,
    selectedViewport, deleteImageFromViewport
  } = useCRViewerStore();

  const [showStampCreator, setShowStampCreator] = useState(false);
  const [showStampDropdown, setShowStampDropdown] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-app-surface border-b border-app-border">
        {/* Format / Layout selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-app-accent uppercase tracking-wider">Format</span>
          <select
            value={currentLayout.id}
            onChange={(e) => {
              const layout = CR_LAYOUTS.find(l => l.id === e.target.value);
              if (layout) setLayout(layout);
            }}
            className="text-xs px-2 py-1 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
          >
            {CR_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-1 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-1 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Arrange button */}
        <button
          onClick={toggleArrangeMode}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
            isArrangeMode
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
          }`}
          title="Arrange images in viewports"
        >
          <ListOrdered className="w-3.5 h-3.5" />
          Arrange
        </button>

        {/* Delete Image button */}
        <button
          onClick={() => deleteImageFromViewport(selectedViewport)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors ml-1"
          title="Delete currently selected image"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
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

        {/* Image filter dropdown */}
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
              setStampMode(!isStampMode);
              setShowStampDropdown(false);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border-2 transition-colors ${
              isStampMode
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
            }`}
            title={isStampMode ? 'Exit stamp mode' : 'Stamp tool — click on viewport to place'}
          >
            <Stamp className="w-3.5 h-3.5" />
            Stamp
          </button>

          {/* Stamp dropdown */}
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
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stamp.color }}
                  />
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
                  onClick={() => { undoStampPlacement(); }}
                  disabled={stampPlacements.length === 0}
                  className="w-full text-left px-3 py-1.5 text-xs text-yellow-400 hover:bg-app-hover font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↩ Undo last stamp
                </button>
                <button
                  onClick={() => { clearStampPlacements(); setShowStampDropdown(false); }}
                  disabled={stampPlacements.length === 0}
                  className="w-full text-left px-3 py-1.5 text-xs text-orange-400 hover:bg-app-hover font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
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
          Total Images {totalImages} | Selected {useCRViewerStore.getState().selectedViewport + 1}
        </span>
      </div>

      {/* Modals */}
      {showStampCreator && <StampCreatorModal onClose={() => setShowStampCreator(false)} />}
      {showPrintPreview && <CRPrintPreview onClose={() => setShowPrintPreview(false)} />}

      {/* Close stamp dropdown on outside click */}
      {showStampDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowStampDropdown(false)} />
      )}
    </>
  );
}
