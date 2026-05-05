import { getLayoutGridTemplate, getLayoutAreaNames, type ViewerLayout } from '@/lib/layouts';
import { X } from 'lucide-react';

/**
 * Simplified print layout options matching the DCM viewer's standard counts.
 * Each count has a portrait and landscape variant.
 */
const PRINT_LAYOUTS: { count: number; portrait: ViewerLayout; landscape: ViewerLayout }[] = [
  {
    count: 1,
    portrait:  { id: '1x1', name: '1', spots: 1, cols: 1, rows: 1 },
    landscape: { id: '1x1', name: '1', spots: 1, cols: 1, rows: 1 },
  },
  {
    count: 2,
    portrait:  { id: '2x1', name: '2', spots: 2, cols: 1, rows: 2 },
    landscape: { id: '1x2', name: '2', spots: 2, cols: 2, rows: 1 },
  },
  {
    count: 4,
    portrait:  { id: '2x2', name: '4', spots: 4, cols: 2, rows: 2 },
    landscape: { id: '2x2', name: '4', spots: 4, cols: 2, rows: 2 },
  },
  {
    count: 6,
    portrait:  { id: '2x3', name: '6', spots: 6, cols: 2, rows: 3 },
    landscape: { id: '3x2', name: '6', spots: 6, cols: 3, rows: 2 },
  },
  {
    count: 8,
    portrait:  { id: '2x4', name: '8', spots: 8, cols: 2, rows: 4 },
    landscape: { id: '4x2', name: '8', spots: 8, cols: 4, rows: 2 },
  },
  {
    count: 9,
    portrait:  { id: '3x3', name: '9', spots: 9, cols: 3, rows: 3 },
    landscape: { id: '3x3', name: '9', spots: 9, cols: 3, rows: 3 },
  },
  {
    count: 12,
    portrait:  { id: '3x4', name: '12', spots: 12, cols: 3, rows: 4 },
    landscape: { id: '4x3', name: '12', spots: 12, cols: 4, rows: 3 },
  },
  {
    count: 15,
    portrait:  { id: '3x5', name: '15', spots: 15, cols: 3, rows: 5 },
    landscape: { id: '5x3', name: '15', spots: 15, cols: 5, rows: 3 },
  },
  {
    count: 18,
    portrait:  { id: '3x6', name: '18', spots: 18, cols: 3, rows: 6 },
    landscape: { id: '6x3', name: '18', spots: 18, cols: 6, rows: 3 },
  },
];

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function PortraitThumb({ layout, selected, onClick, label }: { layout: ViewerLayout; selected: boolean; onClick: () => void; label: string }) {
  const grid = getLayoutGridTemplate(layout);
  const areaNames = getLayoutAreaNames(layout.areas);
  const cells = areaNames.length || layout.spots;
  return (
    <button
      onClick={onClick}
      title={`${layout.id} — ${layout.spots} spots (portrait)`}
      className={`flex flex-col items-center gap-1 rounded p-2 transition-colors ${
        selected ? 'bg-app-accent text-white' : 'hover:bg-app-hover text-app-text'
      }`}
    >
      <div
        className="h-16 w-12 border border-app-border bg-app-thumbnail-bg"
        style={{
          display: 'grid',
          gridTemplateColumns: grid.columns,
          gridTemplateRows: grid.rows,
          gridTemplateAreas: grid.areas,
          gap: '1px',
        }}
      >
        {Array.from({ length: cells }).map((_, idx) => {
          const style: React.CSSProperties = areaNames.length
            ? { gridArea: areaNames[idx], background: selected ? '#fff5' : '#7775' }
            : { background: selected ? '#fff5' : '#7775' };
          return <div key={idx} style={style} />;
        })}
      </div>
      <div className="text-[10px] font-semibold">{label}</div>
    </button>
  );
}

function LandscapeThumb({ layout, selected, onClick, label }: { layout: ViewerLayout; selected: boolean; onClick: () => void; label: string }) {
  const grid = getLayoutGridTemplate(layout);
  const areaNames = getLayoutAreaNames(layout.areas);
  const cells = areaNames.length || layout.spots;
  return (
    <button
      onClick={onClick}
      title={`${layout.id} — ${layout.spots} spots (landscape)`}
      className={`flex flex-col items-center gap-1 rounded p-2 transition-colors ${
        selected ? 'bg-app-accent text-white' : 'hover:bg-app-hover text-app-text'
      }`}
    >
      <div
        className="h-12 w-16 border border-app-border bg-app-thumbnail-bg"
        style={{
          display: 'grid',
          gridTemplateColumns: grid.columns,
          gridTemplateRows: grid.rows,
          gridTemplateAreas: grid.areas,
          gap: '1px',
        }}
      >
        {Array.from({ length: cells }).map((_, idx) => {
          const style: React.CSSProperties = areaNames.length
            ? { gridArea: areaNames[idx], background: selected ? '#fff5' : '#7775' }
            : { background: selected ? '#fff5' : '#7775' };
          return <div key={idx} style={style} />;
        })}
      </div>
      <div className="text-[10px] font-semibold">{label}</div>
    </button>
  );
}

export function LayoutPicker({ selectedId, onSelect, onClose }: Props) {
  const isAuto = selectedId === 'auto';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex w-[700px] flex-col rounded-lg border-2 border-app-accent bg-app-bg shadow-2xl">
        <div className="flex items-center justify-between bg-app-accent px-4 py-2.5 text-white">
          <span className="text-sm font-bold">Choose Layout</span>
          <button onClick={onClose} className="text-lg font-bold text-white/80 hover:text-white">&times;</button>
        </div>

        <div className="p-4">
          {/* Auto option */}
          <button
            onClick={() => { onSelect('auto'); onClose(); }}
            className={`mb-4 w-full rounded border-2 px-4 py-2 text-xs font-bold transition-colors ${
              isAuto
                ? 'border-app-accent bg-app-accent text-white'
                : 'border-app-border text-app-text hover:bg-app-hover'
            }`}
          >
            Auto — automatically select best layout based on image count
          </button>

          {/* Portrait layouts */}
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-app-text-secondary">Portrait</h3>
          <div className="mb-4 flex flex-wrap gap-1">
            {PRINT_LAYOUTS.map((pl) => (
              <PortraitThumb
                key={`p-${pl.count}`}
                layout={pl.portrait}
                selected={!isAuto && selectedId === pl.portrait.id}
                onClick={() => { onSelect(pl.portrait.id); onClose(); }}
                label={String(pl.count)}
              />
            ))}
          </div>

          {/* Landscape layouts */}
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-app-text-secondary">Landscape</h3>
          <div className="flex flex-wrap gap-1">
            {PRINT_LAYOUTS.map((pl) => (
              <LandscapeThumb
                key={`l-${pl.count}`}
                layout={pl.landscape}
                selected={!isAuto && selectedId === pl.landscape.id}
                onClick={() => { onSelect(pl.landscape.id); onClose(); }}
                label={String(pl.count)}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-app-border px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border-2 border-app-border bg-app-bg px-4 py-1.5 text-xs font-semibold text-app-text hover:bg-app-hover"
          >
            <X className="inline h-3 w-3" /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
