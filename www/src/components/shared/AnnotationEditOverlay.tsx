/**
 * AnnotationEditOverlay — Floating panel for editing cornerstone annotation properties.
 * Shows when double-clicking on a shape (ellipse, rectangle, line, angle, arrow).
 * Allows changing color, line width, and scaling.
 */
import { useState } from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import { updateAnnotationStyle, deleteAnnotation, toggleAnnotationText, isAnnotationTextHidden } from '@/lib/annotationUtils';
import { cornerstoneTools } from '@/lib/cornerstoneSetup';

interface AnnotationEditOverlayProps {
  element: HTMLElement;
  toolName: string;
  annotationIndex: number;
  initialColor: string;
  initialLineWidth: number;
  position: { x: number; y: number };
  onClose: () => void;
}

const COLORS = ['#00ff00', '#ff0000', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800', '#8800ff'];

export function AnnotationEditOverlay({
  element, toolName, annotationIndex,
  initialColor, initialLineWidth,
  position, onClose,
}: AnnotationEditOverlayProps) {
  const [color, setColor] = useState(initialColor || '#00ff00');
  const [lineWidth, setLineWidth] = useState(() => {
    try { return cornerstoneTools.toolStyle.getToolWidth() || 1; } catch { return initialLineWidth || 1; }
  });
  const [textHidden, setTextHidden] = useState(() => isAnnotationTextHidden(element, toolName, annotationIndex));

  const handleColorChange = (c: string) => {
    setColor(c);
    updateAnnotationStyle(element, toolName, annotationIndex, { color: c });
  };

  const handleLineWidthChange = (w: number) => {
    const clamped = Math.max(1, Math.min(10, w));
    setLineWidth(clamped);
    updateAnnotationStyle(element, toolName, annotationIndex, { lineWidth: clamped });
  };

  const handleToggleText = (hide: boolean) => {
    setTextHidden(hide);
    toggleAnnotationText(element, toolName, annotationIndex, hide);
  };

  const handleDelete = () => {
    deleteAnnotation(element, toolName, annotationIndex);
    onClose();
  };

  // Friendly tool labels
  const toolLabels: Record<string, string> = {
    EllipticalRoi: 'Ellipse', RectangleRoi: 'Rectangle', Length: 'Line',
    Angle: 'Angle', ArrowAnnotate: 'Arrow', FreehandRoi: 'Freehand', Probe: 'Probe',
  };

  return (
    <div
      className="fixed z-[100] bg-gray-900/95 border border-blue-500/70 rounded-xl p-2.5 shadow-2xl w-[200px] backdrop-blur-sm"
      style={{ left: Math.min(position.x, window.innerWidth - 220), top: Math.min(position.y, window.innerHeight - 300) }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.stopPropagation(); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wide">
          Edit {toolLabels[toolName] || toolName}
        </span>
        <button onClick={onClose} className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white text-[10px]">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Color */}
      <div className="mb-2">
        <span className="text-[9px] text-gray-400 uppercase font-semibold block mb-1">Color</span>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => handleColorChange(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110 ring-2 ring-blue-500/50' : 'border-gray-600 hover:border-gray-400'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Thickness */}
      <div className="mb-2">
        <span className="text-[9px] text-gray-400 uppercase font-semibold block mb-1">Thickness</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleLineWidthChange(lineWidth - 1)}
            disabled={lineWidth <= 1}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <div
              className="rounded-full"
              style={{ width: `${Math.min(lineWidth * 6, 50)}px`, height: `${Math.max(lineWidth * 2, 2)}px`, backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] text-gray-300 font-bold w-5 text-center">{lineWidth}</span>
          <button
            onClick={() => handleLineWidthChange(lineWidth + 1)}
            disabled={lineWidth >= 10}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hide Text */}
      <div className="mb-2">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleText(!textHidden); }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="flex items-center gap-2 w-full px-1.5 py-1 rounded hover:bg-gray-700/50 transition-colors cursor-pointer select-none"
        >
          <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors ${
            textHidden ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-500'
          }`}>
            {textHidden && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
          </div>
          <span className="text-[10px] text-gray-300 font-semibold uppercase tracking-wide">Hide Text</span>
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-bold bg-red-600/80 text-white rounded hover:bg-red-500 transition-colors"
      >
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}
