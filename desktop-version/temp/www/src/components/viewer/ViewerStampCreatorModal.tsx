/**
 * ViewerStampCreatorModal — Create and manage stamps for the main DICOM viewer.
 * Independent from the CR viewer's stamp creator (uses viewerStore, not crViewerStore).
 */
import { useState } from 'react';
import { useViewerStore, type ViewerStamp } from '@/stores/viewerStore';
import { X, Trash2 } from 'lucide-react';

const PRESET_COLORS = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800', '#ff6699'];

interface Props {
  onClose: () => void;
}

export function ViewerStampCreatorModal({ onClose }: Props) {
  const { stamps, addStamp, removeStamp } = useViewerStore();

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ff0000');
  const [customColor, setCustomColor] = useState('#ff0000');
  const [fontSize, setFontSize] = useState(20);

  const handleAdd = () => {
    if (!name.trim() || !text.trim()) return;
    const stamp: ViewerStamp = {
      id: `vstamp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: name.trim(),
      text: text.trim(),
      color,
      fontSize,
      createdAt: Date.now(),
    };
    addStamp(stamp);
    setName('');
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-[400px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <h2 className="text-sm font-bold text-app-text uppercase tracking-wider">Stamp Creator</h2>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Stamp Name */}
          <div>
            <label className="block text-[10px] font-semibold text-app-text-muted uppercase mb-1">Stamp Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Verified, Urgent..."
              className="w-full px-2 py-1.5 text-xs bg-app-bg border border-app-border rounded text-app-text focus:outline-none focus:border-app-accent"
            />
          </div>

          {/* Stamp Text */}
          <div>
            <label className="block text-[10px] font-semibold text-app-text-muted uppercase mb-1">Stamp Text</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. VERIFIED"
              className="w-full px-2 py-1.5 text-xs bg-app-bg border border-app-border rounded text-app-text focus:outline-none focus:border-app-accent"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[10px] font-semibold text-app-text-muted uppercase mb-1">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={customColor}
                onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                title="Custom color"
              />
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-app-text-muted uppercase">Font Size</label>
              <span className="text-[10px] text-app-text">{fontSize}px</span>
            </div>
            <input
              type="range" min="12" max="48" value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full h-1 bg-app-border rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Live Preview */}
          <div className="bg-black rounded-lg p-4 flex items-center justify-center min-h-[60px]">
            {text ? (
              <span
                className="font-bold border-2 border-current px-2 py-1 rounded uppercase tracking-wider"
                style={{ color, fontSize: `${fontSize}px`, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              >
                {text}
              </span>
            ) : (
              <span className="text-gray-600 text-xs">Preview appears here</span>
            )}
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !text.trim()}
            className="w-full py-2 text-xs font-bold bg-app-accent text-white rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add Stamp
          </button>

          {/* Existing Stamps */}
          {stamps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-app-text-muted uppercase mb-2">Saved Stamps</div>
              <div className="space-y-1">
                {stamps.map((stamp) => (
                  <div
                    key={stamp.id}
                    className="flex items-center justify-between px-3 py-2 bg-app-bg rounded border border-app-border"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="font-bold text-xs border border-current px-1 rounded uppercase"
                        style={{ color: stamp.color, fontSize: `${Math.min(stamp.fontSize, 14)}px` }}
                      >
                        {stamp.text}
                      </span>
                      <span className="text-xs text-app-text-muted">{stamp.name}</span>
                    </div>
                    <button
                      onClick={() => removeStamp(stamp.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Delete stamp"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
