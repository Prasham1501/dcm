import { useState } from 'react';
import { X } from 'lucide-react';
import { useViewerStore } from '@/stores/viewerStore';
import { LAYOUT_CATEGORIES, type ViewerLayout } from '@/types/viewer';

export function LayoutSelector() {
  const { showLayoutModal, setShowLayoutModal, currentLayout, setLayout } = useViewerStore();
  const [activeTab, setActiveTab] = useState(0);

  if (!showLayoutModal) return null;

  const category = LAYOUT_CATEGORIES[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-app-bg border border-app-border rounded-lg shadow-xl w-[740px] max-h-[520px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
          <span className="text-sm font-bold text-app-accent">ACCURATE</span>
          <button onClick={() => setShowLayoutModal(false)} className="text-app-text-muted hover:text-app-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-app-border overflow-x-auto">
          {LAYOUT_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeTab === i
                  ? 'text-app-accent border-b-2 border-app-accent bg-app-surface'
                  : 'text-app-text-secondary hover:text-app-text hover:bg-app-hover'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex flex-wrap gap-4">
            {category.layouts.map((layout) => (
              <LayoutPreview
                key={layout.id}
                layout={layout}
                isSelected={currentLayout.id === layout.id}
                onClick={() => {
                  setLayout(layout);
                  setShowLayoutModal(false);
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2 border-t border-app-border gap-2">
          <button
            onClick={() => setShowLayoutModal(false)}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90"
          >
            Ok
          </button>
          <button
            onClick={() => setShowLayoutModal(false)}
            className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Preview cell definition for asymmetric layouts.
 * Each cell can optionally span multiple rows/columns using grid-row/grid-column span.
 */
interface PreviewCell {
  colSpan?: number;
  rowSpan?: number;
}

/**
 * For asymmetric layouts, define how each cell spans in the preview thumbnail.
 * Matches the reference project's exact preview grid structure.
 */
const ASYMMETRIC_PREVIEW: Record<string, { cols: string; rows: string; cells: PreviewCell[] }> = {
  // 3 Spots
  '2+1-top':    { cols: '1fr 1fr', rows: '1fr 1fr', cells: [{}, {}, { colSpan: 2 }] },
  '1+2-left':   { cols: '1fr 1fr', rows: '1fr 1fr', cells: [{ rowSpan: 2 }, {}, {}] },
  '1+2-right':  { cols: '1fr 1fr', rows: '1fr 1fr', cells: [{}, { rowSpan: 2 }, {}] },
  '2+1-bottom': { cols: '1fr 1fr', rows: '1fr 1fr', cells: [{ colSpan: 2 }, {}, {}] },
  // 4 Spots
  '1+3-left':   { cols: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{ rowSpan: 3 }, {}, {}, {}] },
  '1+3-right':  { cols: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{}, { rowSpan: 3 }, {}, {}] },
  '3+1-top':    { cols: '1fr 1fr 1fr', rows: '1fr 1fr', cells: [{}, {}, {}, { colSpan: 3 }] },
  '3+1-bottom': { cols: '1fr 1fr 1fr', rows: '1fr 1fr', cells: [{ colSpan: 3 }, {}, {}, {}] },
  '1+2+1':      { cols: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{ colSpan: 2 }, {}, {}, { colSpan: 2 }] },
  // 5 Spots
  '2+3':        { cols: '1fr 1fr 1fr', rows: '1fr 1fr', cells: [{}, {}, { rowSpan: 2 }, {}, {}] },
  '1+4-big':    { cols: '2fr 1fr 1fr', rows: '1fr 1fr', cells: [{ rowSpan: 2 }, {}, {}, {}, {}] },
  '2+2+1':      { cols: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{}, {}, {}, {}, { colSpan: 2 }] },
  '1+2+2':      { cols: '1fr 1fr', rows: '1fr 1fr 1fr', cells: [{ colSpan: 2 }, {}, {}, {}, {}] },
  // 7 Spots
  '3+2+2':      { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', cells: [{}, {}, {}, { colSpan: 2 }, {}, { colSpan: 2 }, {}] },
  '1+3+3':      { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', cells: [{ colSpan: 3 }, {}, {}, {}, {}, {}, {}] },
  '7-mixed':    { cols: '1fr 1fr 1fr 1fr', rows: '1fr 1fr', cells: [{}, {}, {}, {}, {}, { colSpan: 2 }, {}] },
  // 11 Spots (asymmetric)
  '3x4-11':     { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr 1fr', cells: [{}, {}, {}, {}, {}, {}, {}, {}, {}, { colSpan: 2 }, {}] },
};

function LayoutPreview({ layout, isSelected, onClick }: { layout: ViewerLayout; isSelected: boolean; onClick: () => void }) {
  const asymmetric = ASYMMETRIC_PREVIEW[layout.id];

  // Determine if this is portrait or landscape orientation
  const isPortrait = layout.rows > layout.cols;
  const isLandscape = layout.cols > layout.rows;

  // Card dimensions — large enough to clearly show the layout shape
  const cardW = isPortrait ? 72 : isLandscape ? 100 : 80;
  const cardH = isPortrait ? 90 : isLandscape ? 60 : 72;

  // Build the grid style for the preview
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '2px',
    width: '100%',
    height: '100%',
  };

  if (asymmetric) {
    gridStyle.gridTemplateColumns = asymmetric.cols;
    gridStyle.gridTemplateRows = asymmetric.rows;
  } else {
    const cols = Math.min(layout.cols, 8);
    const rows = Math.min(layout.rows, 8);
    gridStyle.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridStyle.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }

  const cellCount = asymmetric
    ? asymmetric.cells.length
    : Math.min(layout.spots, Math.min(layout.cols, 8) * Math.min(layout.rows, 8));

  return (
    <button
      onClick={onClick}
      title={layout.id}
      className={`flex flex-col items-center gap-1 p-2 rounded transition-colors cursor-pointer ${
        isSelected ? 'bg-app-accent/15 ring-2 ring-app-accent' : 'hover:bg-app-hover'
      }`}
    >
      <div
        className={`border-2 rounded overflow-hidden relative ${
          isSelected ? 'border-app-accent' : 'border-app-border'
        }`}
        style={{ width: cardW, height: cardH, minWidth: cardW, minHeight: cardH }}
      >
        <div style={{ ...gridStyle, width: '100%', height: '100%' }}>
          {asymmetric
            ? asymmetric.cells.map((cell, i) => {
                const cellStyle: React.CSSProperties = {
                  background: isSelected ? 'rgba(220,53,69,0.25)' : '#333',
                  border: `1px solid ${isSelected ? 'rgba(220,53,69,0.5)' : '#555'}`,
                  borderRadius: '1px',
                };
                if (cell.colSpan) cellStyle.gridColumn = `span ${cell.colSpan}`;
                if (cell.rowSpan) cellStyle.gridRow = `span ${cell.rowSpan}`;
                return <div key={i} style={cellStyle} />;
              })
            : Array.from({ length: cellCount }, (_, i) => (
                <div
                  key={i}
                  style={{
                    background: isSelected ? 'rgba(220,53,69,0.25)' : '#333',
                    border: `1px solid ${isSelected ? 'rgba(220,53,69,0.5)' : '#555'}`,
                    borderRadius: '1px',
                  }}
                />
              ))}
        </div>
        {/* Portrait/Landscape badge */}
        {isPortrait && (
          <span className="absolute top-0.5 right-0.5 text-[6px] px-1 py-px rounded bg-indigo-500/70 text-white leading-tight">P</span>
        )}
        {isLandscape && (
          <span className="absolute top-0.5 right-0.5 text-[6px] px-1 py-px rounded bg-emerald-500/70 text-white leading-tight">L</span>
        )}
      </div>
      <span className={`text-[10px] font-bold ${isSelected ? 'text-app-accent' : 'text-app-text-secondary'}`}>
        {layout.spots}
      </span>
    </button>
  );
}
