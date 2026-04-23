/**
 * CRToolbar — Top toolbar for the CR viewer.
 * Contains: Format selector, navigation arrows, Arrange, Preview, Print, Stamp buttons.
 */
import { useState } from 'react';
import { useCRViewerStore, CR_LAYOUTS, type CRLayout } from '@/stores/crViewerStore';
import { useStampStore } from '@/stores/stampStore';
import {
  ChevronLeft, ChevronRight, Printer, Eye, ListOrdered, Stamp, Plus, X
} from 'lucide-react';
import { CRPrintPreview } from './CRPrintPreview';

export function CRToolbar() {
  const {
    currentLayout, setLayout, totalImages,
    isArrangeMode, toggleArrangeMode,
    nextPage, prevPage, currentPage, totalPages,
    isStampMode, setStampMode,
    undoStampPlacement, clearStampPlacements, stampPlacements,
  } = useCRViewerStore();

  const { stamps: sharedStamps, selectedStampId, selectStamp, addStamp, removeStamp } = useStampStore();

  const [showStampDropdown, setShowStampDropdown] = useState(false);
  const [showStampCreate, setShowStampCreate] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printFilter, setPrintFilter] = useState<'All' | 'Current'>('All');

  // Stamp create form state
  const [newStampName, setNewStampName] = useState('');
  const [newStampText, setNewStampText] = useState('');
  const [newStampColor, setNewStampColor] = useState('#ffff00');
  const [newStampFontSize, setNewStampFontSize] = useState(16);

  return (
    <>
      <div className="flex items-center gap-1.5 2xl:gap-2 px-2 2xl:px-3 py-1 2xl:py-2 bg-app-surface border-b border-app-border">
        {/* Format / Layout selector */}
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <span className="text-[10px] 2xl:text-xs font-bold text-app-accent uppercase tracking-wider">Format</span>
          <select
            value={currentLayout.id}
            onChange={(e) => {
              const layout = CR_LAYOUTS.find(l => l.id === e.target.value);
              if (layout) setLayout(layout);
            }}
            className="text-xs 2xl:text-sm px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
          >
            {CR_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5 ml-0.5">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-1 2xl:p-1.5 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          </button>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-1 2xl:p-1.5 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          </button>
        </div>

        {/* Arrange button */}
        <button
          onClick={toggleArrangeMode}
          className={`flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold rounded border-2 transition-colors ${
            isArrangeMode
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
          }`}
          title="Arrange images in viewports"
        >
          <ListOrdered className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Arrange
        </button>

        {/* Preview button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          title="Print preview"
        >
          <Eye className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Preview
        </button>

        {/* Print button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Print"
        >
          <Printer className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Print
        </button>

        {/* Image filter dropdown */}
        <select
          className="text-xs 2xl:text-sm px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none ml-0.5"
          value={printFilter}
          onChange={(e) => setPrintFilter(e.target.value as 'All' | 'Current')}
        >
          <option value="All">All</option>
          <option value="Current">Current</option>
        </select>

        {/* Stamp button with dropdown */}
        <div className="relative ml-0.5">
          <button
            onClick={() => {
              if (isStampMode) {
                setStampMode(false);
                setShowStampDropdown(false);
              } else {
                setShowStampDropdown(prev => !prev);
              }
            }}
            className={`flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold rounded border-2 transition-colors ${
              isStampMode
                ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
            }`}
            title={isStampMode ? 'Exit stamp mode' : 'Stamp tool \u2014 select a stamp to place'}
          >
            <Stamp className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
            Stamp
          </button>

          {/* Stamp dropdown — shared stamps */}
          {showStampDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-app-bg border border-app-border rounded-lg shadow-xl min-w-[260px] py-1">
              <div className="px-3 py-1.5 text-[10px] text-app-text-muted uppercase font-bold border-b border-app-border mb-1">
                Select a stamp, then click on viewport
              </div>
              {sharedStamps.map((stamp) => (
                <button
                  key={stamp.id}
                  onClick={() => {
                    selectStamp(stamp.id);
                    setStampMode(true);
                    setShowStampDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-app-hover flex items-center gap-2 ${
                    selectedStampId === stamp.id ? 'bg-app-accent/20 text-app-accent' : 'text-app-text'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
                  <span className="font-bold flex-1 truncate uppercase">{stamp.text}</span>
                  <span className="text-[9px] text-app-text-muted">{stamp.fontSize}px</span>
                </button>
              ))}
              <div className="border-t border-app-border mt-1 pt-1">
                {!showStampCreate ? (
                  <button
                    onClick={() => setShowStampCreate(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-app-accent hover:bg-app-hover font-semibold flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Create new stamp
                  </button>
                ) : (
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="text-[10px] text-app-accent font-bold uppercase">Create Stamp</div>
                    <input type="text" value={newStampName} onChange={(e) => setNewStampName(e.target.value)}
                      placeholder="Name" autoFocus
                      className="w-full px-2 py-1 text-[10px] bg-app-bg text-app-text border border-app-border rounded focus:border-app-accent focus:outline-none" />
                    <input type="text" value={newStampText} onChange={(e) => setNewStampText(e.target.value)}
                      placeholder="Stamp text (e.g. APPROVED)"
                      className="w-full px-2 py-1 text-[10px] bg-app-bg text-app-text border border-app-border rounded focus:border-app-accent focus:outline-none" />
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-app-text-muted">Color</span>
                      <div className="flex gap-1">
                        {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                          <button key={c} onClick={() => setNewStampColor(c)}
                            className={`w-4 h-4 rounded-full border-2 ${newStampColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-app-text-muted">Size</span>
                      <input type="range" min="10" max="40" value={newStampFontSize}
                        onChange={(e) => setNewStampFontSize(parseInt(e.target.value))}
                        className="w-20 h-1.5 bg-app-bg rounded-lg appearance-none cursor-pointer" />
                      <span className="text-[9px] text-app-text">{newStampFontSize}px</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        if (newStampName.trim() && newStampText.trim()) {
                          addStamp({ name: newStampName.trim(), text: newStampText.trim(), color: newStampColor, fontSize: newStampFontSize });
                          setNewStampName(''); setNewStampText(''); setShowStampCreate(false);
                        }
                      }} disabled={!newStampName.trim() || !newStampText.trim()}
                        className="flex-1 px-2 py-1 text-[10px] bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-40">
                        Save
                      </button>
                      <button onClick={() => setShowStampCreate(false)}
                        className="px-2 py-1 text-[10px] bg-app-bg text-app-text-muted border border-app-border rounded hover:bg-app-hover">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
      {showPrintPreview && <CRPrintPreview onClose={() => setShowPrintPreview(false)} initialPageMode={printFilter === 'Current' ? 'current' : 'all'} />}

      {/* Close stamp dropdown on outside click */}
      {showStampDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowStampDropdown(false); setShowStampCreate(false); }} />
      )}
    </>
  );
}
