import { LAYOUT_CATEGORIES, getLayoutGridTemplate, getLayoutAreaNames, type ViewerLayout } from '@/lib/layouts';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function LayoutThumb({ layout, selected, onClick }: { layout: ViewerLayout; selected: boolean; onClick: () => void }) {
  const grid = getLayoutGridTemplate(layout);
  const areaNames = getLayoutAreaNames(layout.areas);
  const cells = areaNames.length || layout.spots;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded p-2 transition-colors ${
        selected ? 'bg-app-accent text-white' : 'hover:bg-app-hover text-app-text'
      }`}
    >
      <div
        className="h-16 w-20 border border-app-border bg-app-thumbnail-bg"
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
      <div className="text-[10px] font-semibold">{layout.id}</div>
      <div className="text-[9px] opacity-70">{layout.spots} spots</div>
    </button>
  );
}

export function LayoutPicker({ selectedId, onSelect, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);
  const cat = LAYOUT_CATEGORIES[activeCategory];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[860px] flex-col rounded-lg border-2 border-app-accent bg-app-bg shadow-2xl">
        <div className="flex items-center justify-between bg-app-accent px-4 py-2.5 text-white">
          <span className="text-sm font-bold">Choose Layout</span>
          <button onClick={onClose} className="text-lg font-bold text-white/80 hover:text-white">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-44 border-r border-app-border bg-app-surface">
            {LAYOUT_CATEGORIES.map((c, idx) => (
              <button
                key={c.label}
                onClick={() => setActiveCategory(idx)}
                className={`block w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  activeCategory === idx
                    ? 'bg-app-accent text-white'
                    : 'text-app-text hover:bg-app-hover'
                }`}
              >
                {c.label}
              </button>
            ))}
          </aside>
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {cat.layouts.map((l) => (
                <LayoutThumb
                  key={l.id}
                  layout={l}
                  selected={selectedId === l.id}
                  onClick={() => { onSelect(l.id); onClose(); }}
                />
              ))}
            </div>
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
