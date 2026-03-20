import { useState, useCallback, useEffect } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import {
  activateTool, applyWLPreset, applyFilter, WL_PRESETS,
  setAnnotationToolColor, applyActionToElements, undoLastAnnotationOnSelected,
  clearAllAnnotationsOnSelected,
} from '@/lib/viewerTools';
import {
  Stamp, Type, Minus, ArrowLeft, Spline, Ruler,
  Square, Circle, RotateCw, FlipHorizontal,
  CircleDot, Mouse, SlidersHorizontal,
  RotateCcwIcon, Move, ZoomIn, Triangle, Pipette,
  FlipVertical, Play, StopCircle, Undo2, X, Pencil, Eraser, ListOrdered,
} from 'lucide-react';

interface ToolDef {
  id: string;
  label: string;
  icon: React.ElementType;
  isAction?: boolean;
  isToggle?: boolean; // For tools like Invert, Flip that toggle state
}

const toolIdMap: Record<string, string> = {
  'stamp': 'stamp',
  'text': 'text',
  'line': 'line',
  'arrow': 'arrow',
  'polyline': 'polyline',
  'measure': 'measure',
  'square': 'square',
  'ellipse': 'ellipse',
  'rotate-cw': '90cw',
  'rotate-acw': '90acw',
  'flip-h': 'fliph',
  'flip-v': 'flipv',
  'invert': 'invert',
  'select': 'select',
  'filters': 'filters',
  'pan': 'pan',
  'zoom': 'zoom',
  'wwwc': 'wl',
  'length': 'length',
  'angle': 'angle',
  'probe': 'probe',
  'draw': 'draw',
  'undo': 'undo',
  'cine-play': 'cineplay',
  'cine-stop': 'cinestop',
};

// Unified tool grid — no more separate "Additional Tools" section
const allTools: ToolDef[] = [
  // Annotation
  { id: 'stamp', label: 'Stamp', icon: Stamp },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'draw', label: 'Draw', icon: Pencil },
  // Measurement
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: ArrowLeft },
  { id: 'polyline', label: 'Polyline', icon: Spline },
  { id: 'measure', label: 'Length', icon: Ruler },
  { id: 'angle', label: 'Angle', icon: Triangle },
  { id: 'probe', label: 'Probe', icon: Pipette },
  // Shapes
  { id: 'square', label: 'Square', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  // Navigation
  { id: 'arrange', label: 'Arrange', icon: ListOrdered },
  { id: 'pan', label: 'Pan', icon: Move },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'wwwc', label: 'W/L', icon: SlidersHorizontal },
  { id: 'select', label: 'Select', icon: Mouse },
  // Transform (actions)
  { id: 'rotate-cw', label: '90 CW', icon: RotateCw, isAction: true },
  { id: 'rotate-acw', label: '90 ACW', icon: RotateCcwIcon, isAction: true },
  // Toggle actions
  { id: 'flip-h', label: 'Flip H', icon: FlipHorizontal, isAction: true, isToggle: true },
  { id: 'flip-v', label: 'Flip V', icon: FlipVertical, isAction: true, isToggle: true },
  { id: 'invert', label: 'Invert', icon: CircleDot, isAction: true, isToggle: true },
  // Utility actions
  { id: 'undo', label: 'Undo', icon: Undo2, isAction: true },
  // Filters
  { id: 'filters', label: 'Filters', icon: SlidersHorizontal },
];

const WL_PRESET_LABELS: Record<string, string> = {
  default: 'Default',
  lung: 'Lung',
  abdomen: 'Abdomen',
  brain: 'Brain',
  bone: 'Bone',
  softTissue: 'Soft Tissue',
};

function getSelectedViewportElement(): HTMLDivElement | null {
  const { selectedViewport } = useViewerStore.getState();
  const byIndex = document.querySelector(`[data-viewport-index="${selectedViewport}"]`) as HTMLDivElement;
  if (byIndex) return byIndex;
  const viewports = document.querySelectorAll('[data-viewport-index]');
  return (viewports[0] as HTMLDivElement) || null;
}

function getSelectedViewportElements(): HTMLDivElement[] {
  const { selectedViewportIndices } = useViewerStore.getState();
  return selectedViewportIndices
    .map((i) => document.querySelector(`[data-viewport-index="${i}"]`) as HTMLDivElement)
    .filter(Boolean);
}

export function ToolsPanel() {
  const {
    activeToolId, setActiveTool,
    isPlaying, startCine, stopCine, setShowCine,
    selectAllViewports, selectedViewportIndices,
    isArrangeMode, toggleArrangeMode,
  } = useViewerStore();
  // Print store kept for future use
  const _printStore = usePrintStore(); void _printStore;
  const [showFilters, setShowFilters] = useState(false);
  const [showWLPresets, setShowWLPresets] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');
  const [annotationColor, setAnnotationColor] = useState('#00ff00');

  // Track toggle states for invert/flip per viewport
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
    'flip-h': false,
    'flip-v': false,
    'invert': false,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAllViewports();
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undoLastAnnotationOnSelected();
      }

      if (e.key === 'Escape') {
        try {
          const { cornerstoneTools: cst } = require('@/lib/cornerstoneSetup');
          cst.setToolPassive('FreehandRoi');
          cst.setToolPassive('ArrowAnnotate');
          cst.setToolPassive('TextMarker');
        } catch { /* ignore */ }
        setActiveTool('select');
        activateTool('select', null);
      }

      if (e.key === 'Delete') {
        clearAllAnnotationsOnSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAllViewports, setActiveTool]);

  const handleToolClick = useCallback((tool: ToolDef) => {
    const csToolId = toolIdMap[tool.id] || tool.id;

    if (tool.id === 'filters') {
      setShowFilters(prev => !prev);
      return;
    }

    if (tool.id === 'arrange') {
      toggleArrangeMode();
      return;
    }

    if (tool.isAction) {
      // Toggle state tracking for flip/invert
      if (tool.isToggle) {
        setToggleStates(prev => ({ ...prev, [tool.id]: !prev[tool.id] }));
      }

      const selectedEls = getSelectedViewportElements();
      if (selectedEls.length > 1) {
        applyActionToElements(csToolId, selectedEls);
      } else {
        const el = getSelectedViewportElement();
        if (el) activateTool(csToolId, el);
      }
    } else {
      setActiveTool(tool.id);
      activateTool(csToolId, null);
    }
  }, [setActiveTool]);

  const handleReset = useCallback(() => {
    const selectedEls = getSelectedViewportElements();
    if (selectedEls.length > 0) {
      applyActionToElements('reset', selectedEls);
    } else {
      const el = getSelectedViewportElement();
      if (el) activateTool('reset', el);
    }
    setActiveTool('select');
    activateTool('select', null);
    setActiveFilter('none');
    // Reset toggle states
    setToggleStates({ 'flip-h': false, 'flip-v': false, 'invert': false });
  }, [setActiveTool]);

  const handleClearAll = useCallback(() => {
    clearAllAnnotationsOnSelected();
  }, []);

  const handleCineToggle = useCallback(() => {
    if (isPlaying) {
      stopCine();
    } else {
      setShowCine(true);
      startCine();
    }
  }, [isPlaying, startCine, stopCine, setShowCine]);

  const handleWLPreset = useCallback((preset: string) => {
    const el = getSelectedViewportElement();
    if (el) {
      applyWLPreset(el, preset);
      const values = WL_PRESETS[preset];
      if (values) {
        useViewerStore.getState().setWidth(values.ww);
        useViewerStore.getState().setLevel(values.wl);
      }
    }
    setShowWLPresets(false);
  }, []);

  const handleFilter = useCallback((filter: 'sharpen' | 'smooth' | 'edge' | 'none') => {
    const el = getSelectedViewportElement();
    if (el) applyFilter(el, filter);
    setActiveFilter(filter);
  }, []);

  // Listen for custom events from tool handlers
  useState(() => {
    const handleOpenFilters = () => setShowFilters(true);
    window.addEventListener('dicom-open-filters', handleOpenFilters);
    return () => {
      window.removeEventListener('dicom-open-filters', handleOpenFilters);
    };
  });

  const multiSelected = selectedViewportIndices.length > 1;

  return (
    <div className="w-60 flex flex-col bg-app-surface border-l border-app-border overflow-y-auto">
      {/* W/L Presets */}
      <div className="p-2 border-b border-app-border">
        <button
          onClick={() => setShowWLPresets(!showWLPresets)}
          className="w-full px-2 py-1 text-[10px] font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors"
        >
          W/L Presets
        </button>
        {showWLPresets && (
          <div className="mt-1 grid grid-cols-2 gap-1">
            {Object.entries(WL_PRESET_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleWLPreset(key)}
                className="px-1 py-1 text-[9px] font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors truncate"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Annotation color picker */}
      {(activeToolId === 'text' || activeToolId === 'arrow' || activeToolId === 'line'
        || activeToolId === 'draw' || activeToolId === 'measure' || activeToolId === 'polyline') && (
        <div className="p-2 border-b border-app-border">
          <div className="text-[10px] font-semibold text-app-text-muted mb-1">COLOR</div>
          <div className="flex items-center gap-1 flex-wrap">
            {['#00ff00', '#ff0000', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  setAnnotationColor(color);
                  setAnnotationToolColor(color);
                }}
                className={`w-5 h-5 rounded-sm border-2 transition-colors ${
                  annotationColor === color ? 'border-white scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Multi-select indicator */}
      {multiSelected && (
        <div className="px-2 py-1 bg-yellow-500/20 border-b border-yellow-500/40">
          <div className="text-[10px] text-yellow-400 font-semibold">
            {selectedViewportIndices.length} viewports selected
          </div>
          <div className="text-[9px] text-yellow-400/70">Actions apply to all</div>
        </div>
      )}

      {/* Configurable shortcut buttons */}
      <div className="p-2 border-b border-app-border">
        <div className="grid grid-cols-3 gap-1">
          {['Not defined', 'Not defined', 'Not defined'].map((label, i) => (
            <button
              key={i}
              className="px-1 py-1.5 text-[10px] border border-app-border text-app-text-muted bg-app-bg rounded hover:bg-app-hover transition-colors truncate"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified tool grid */}
      <div className="p-2 border-b border-app-border">
        <div className="grid grid-cols-3 gap-1">
          {allTools.map((tool) => {
            const Icon = tool.icon;
            let isActive = false;
            
            if (tool.id === 'arrange') {
              isActive = isArrangeMode;
            } else if (!tool.isAction) {
              isActive = activeToolId === tool.id;
            }
            
            const isToggled = tool.isToggle && toggleStates[tool.id];
            
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className={`flex flex-col items-center justify-center p-1.5 rounded border transition-colors ${
                  isActive
                    ? 'border-app-accent bg-app-accent text-white shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.6)]'
                    : isToggled
                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                    : 'border-app-border text-app-text hover:bg-app-hover hover:border-app-accent'
                }`}
                title={tool.label + (isToggled ? ' (active)' : '')}
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="text-[9px] leading-tight truncate w-full text-center">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset + Clear All buttons */}
      <div className="p-2 border-b border-app-border flex gap-1">
        <button
          onClick={handleReset}
          className="flex-1 px-2 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleClearAll}
          className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-semibold border-2 border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors"
          title="Clear all annotations from selected viewport(s)"
        >
          <Eraser className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Cine button */}
      <div className="p-2 border-b border-app-border">
        <button
          onClick={handleCineToggle}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded border transition-colors ${
            isPlaying
              ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/40'
              : 'border-app-border text-app-text hover:bg-app-hover'
          }`}
          title={isPlaying ? 'Stop Cine (currently playing)' : 'Start Cine playback'}
        >
          {isPlaying ? (
            <><StopCircle className="w-4 h-4" /><span>Stop Cine</span></>
          ) : (
            <><Play className="w-4 h-4" /><span>Cine</span></>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="p-2">
        <div className="text-[9px] text-app-text-muted space-y-0.5">
          <div>Ctrl+A — select all viewports</div>
          <div>Ctrl+Z — undo annotation</div>
          <div>Delete — clear all annotations</div>
          <div>Esc — end drawing / cancel tool</div>
          <div>Ctrl+click viewport — multi-select</div>
          <div>Double-click — close polygon</div>
        </div>
      </div>

      {/* Filters popup */}
      {showFilters && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-app-text">Image Filters</span>
            <button onClick={() => setShowFilters(false)} className="text-app-text-muted hover:text-app-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'sharpen', label: 'Sharpen' },
              { key: 'smooth', label: 'Smooth' },
              { key: 'edge', label: 'Edge Enhance' },
              { key: 'none', label: 'None (Reset)' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilter(key as any)}
                className={`px-2 py-2 text-xs font-semibold rounded border transition-colors ${
                  activeFilter === key
                    ? 'border-app-accent bg-app-accent text-white'
                    : 'border-app-border text-app-text hover:bg-app-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
