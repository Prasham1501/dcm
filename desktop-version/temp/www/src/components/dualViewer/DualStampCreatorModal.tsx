/**
 * DualStampCreatorModal — Create and manage stamps for the Dual viewer.
 */
import { useState } from 'react';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { X, Plus, Trash2 } from 'lucide-react';

const STAMP_COLORS = [
  '#ff0000', '#ff6600', '#ffff00', '#00ff00',
  '#00ffff', '#0066ff', '#ff00ff', '#ffffff',
];

interface DualStampCreatorModalProps {
  onClose: () => void;
}

export function DualStampCreatorModal({ onClose }: DualStampCreatorModalProps) {
  const { stamps, addStamp, removeStamp } = useDualViewerStore();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffff00');
  const [fontSize, setFontSize] = useState(16);

  const handleCreate = () => {
    if (!name.trim() || !text.trim()) return;
    addStamp({ name: name.trim(), text: text.trim(), color, fontSize });
    setName('');
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-app-bg border border-app-border rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-app-border">
          <span className="text-sm font-bold text-app-accent">Stamp Manager</span>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-app-border">
          <h3 className="text-xs font-bold text-app-text mb-2 uppercase tracking-wide">Create New Stamp</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-app-text-muted block mb-0.5">Stamp Name</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hospital Logo"
                className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-app-text-muted block mb-0.5">Stamp Text</label>
              <input
                type="text" value={text} onChange={(e) => setText(e.target.value)}
                placeholder="e.g. APPROVED"
                className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-end gap-3 mt-2">
            <div>
              <label className="text-[10px] text-app-text-muted block mb-0.5">Color</label>
              <div className="flex gap-1">
                {STAMP_COLORS.map((c) => (
                  <button
                    key={c} onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded border-2 transition-colors ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-0 p-0" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-app-text-muted block mb-0.5">Size</label>
              <input
                type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} min={8} max={72}
                className="w-14 px-1.5 py-1 text-xs bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
            <div className="flex-1 flex items-center justify-center h-8 bg-black rounded border border-app-border overflow-hidden">
              <span style={{ color, fontSize: `${Math.min(fontSize, 20)}px`, fontWeight: 'bold' }} className="truncate px-2">
                {text || 'Preview'}
              </span>
            </div>
            <button
              onClick={handleCreate} disabled={!name.trim() || !text.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-app-accent text-white rounded hover:opacity-90 transition-colors disabled:opacity-40"
            >
              <Plus className="w-3 h-3" /> Create
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-2">
          <h3 className="text-xs font-bold text-app-text mb-2 uppercase tracking-wide">
            Saved Stamps ({stamps.length})
          </h3>
          {stamps.length === 0 ? (
            <p className="text-xs text-app-text-muted text-center py-4">No stamps created yet.</p>
          ) : (
            <div className="space-y-1">
              {stamps.map((stamp) => (
                <div key={stamp.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-app-border hover:bg-app-hover">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
                  <span className="text-xs font-semibold text-app-text flex-1 truncate">{stamp.name}</span>
                  <span className="text-xs truncate max-w-[120px]" style={{ color: stamp.color }}>{stamp.text}</span>
                  <span className="text-[10px] text-app-text-muted">{stamp.fontSize}px</span>
                  <button onClick={() => removeStamp(stamp.id)} className="p-0.5 text-red-400 hover:text-red-300 transition-colors" title="Delete stamp">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end px-4 py-2 border-t border-app-border">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
