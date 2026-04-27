import { useState, useCallback, useEffect } from 'react';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useCustomAnnotationStore } from '@/stores/customAnnotationStore';
import { useStampStore } from '@/stores/stampStore';
import {
  activateTool, applyWLPreset, applyFilter, WL_PRESETS, resetViewport,
  setAnnotationToolColor, applyActionToElements, undoLastAnnotationOnSelected,
  clearAllAnnotationsOnSelected,
  deleteActiveAnnotationOnSelected,
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

  // Activate Pan as the default tool on mount
  useEffect(() => {
    activateTool('pan', null);
  }, []);

  // Listen for auto-deactivate events from viewports
  useEffect(() => {
    const handler = () => {
      setActiveTool('select');
      activateTool('select', null);
    };
    window.addEventListener('viewer-tool-deactivated', handler);
    return () => window.removeEventListener('viewer-tool-deactivated', handler);
  }, [setActiveTool]);

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
        // Try deleting the selected/active annotation first, fall back to clearing all
        if (!deleteActiveAnnotationOnSelected()) {
          clearAllAnnotationsOnSelected();
        }
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
    // Clear ALL custom annotations first (before resetViewport fires dicom-clear-annotations)
    useCustomAnnotationStore.getState().resetAll();
    // Reset ALL viewport elements (not just selected — Reset is a full reset)
    document.querySelectorAll('[data-viewport-index]').forEach((el) => {
      try { resetViewport(el as HTMLDivElement); } catch { /* ignore */ }
    });
    setActiveTool('pan');
    activateTool('pan', null);
    setActiveFilter('none');
    // Reset toggle states
    setToggleStates({ 'flip-h': false, 'flip-v': false, 'invert': false });
    // Clear any viewport image swaps/overrides
    useViewerStore.getState().clearViewportOverrides();
  }, [setActiveTool]);

  const handleClearAll = useCallback(() => {
    const selectedEls = getSelectedViewportElements();
    selectedEls.forEach((el) => {
      try { resetViewport(el); } catch { /* ignore */ }
    });
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
    <div className="w-14 sm:w-28 lg:w-48 2xl:w-80 flex flex-col bg-app-surface border-l border-app-border overflow-y-auto">
      {/* W/L Presets */}
      <div className="p-1 2xl:p-2.5 border-b border-app-border">
        <button
          onClick={() => setShowWLPresets(!showWLPresets)}
          className="w-full px-1 py-1 2xl:px-2.5 2xl:py-1.5 text-[8px] sm:text-[10px] 2xl:text-xs font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-hover transition-colors truncate"
        >
          {showWLPresets ? 'Close' : 'W/L Presets'}
        </button>
        {showWLPresets && (
          <div className="mt-1 2xl:mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1 2xl:gap-1.5">
            {Object.entries(WL_PRESET_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleWLPreset(key)}
                className="px-1 py-1 2xl:px-1.5 2xl:py-1.5 text-[8px] sm:text-[9px] 2xl:text-[10px] font-semibold border border-app-border text-app-text bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors truncate"
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
        <div className="p-1 2xl:p-2.5 border-b border-app-border">
          <div className="hidden sm:block text-[10px] 2xl:text-xs font-semibold text-app-text-muted mb-1 2xl:mb-1.5">COLOR</div>
          <div className="flex items-center gap-1 2xl:gap-1.5 flex-wrap justify-center sm:justify-start">
            {['#00ff00', '#ff0000', '#ffff00', '#00ffff', '#ff00ff', '#ffffff', '#ff8800'].map((color) => (
              <button
                key={color}
                onClick={() => {
                  setAnnotationColor(color);
                  setAnnotationToolColor(color);
                }}
                className={`w-3.5 h-3.5 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6 rounded-sm border transition-colors ${
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
        <div className="px-1 py-1 sm:px-2.5 sm:py-1.5 bg-yellow-500/20 border-b border-yellow-500/40 text-center sm:text-left">
          <div className="text-[8px] sm:text-xs text-yellow-400 font-semibold leading-tight">
            <span className="sm:hidden">{selectedViewportIndices.length}V</span>
            <span className="hidden sm:inline">{selectedViewportIndices.length} viewports selected</span>
          </div>
        </div>
      )}

      {/* Configurable shortcut buttons */}
      <div className="hidden sm:block p-1.5 2xl:p-2.5 border-b border-app-border">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 2xl:gap-1.5">
          {['Not defined', 'Not defined', 'Not defined'].map((label, i) => (
            <button
              key={i}
              className="px-1 py-1.5 2xl:px-1.5 2xl:py-2 text-[8px] lg:text-[10px] 2xl:text-xs border border-app-border text-app-text-muted bg-app-bg rounded hover:bg-app-hover transition-colors truncate"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified tool grid */}
      <div className="p-1 2xl:p-2.5 border-b border-app-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-3 gap-1 2xl:gap-1.5">
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
                className={`flex flex-col items-center justify-center p-1 sm:p-1.5 2xl:p-2 rounded border transition-colors ${
                  isActive
                    ? 'border-app-accent bg-app-accent text-white shadow-[0_0_8px_rgba(var(--app-accent-rgb),0.6)]'
                    : isToggled
                    ? 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                    : 'border-app-border text-app-text hover:bg-app-hover hover:border-app-accent'
                }`}
                title={tool.label + (isToggled ? ' (active)' : '')}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 2xl:w-5 2xl:h-5 mb-0.5" />
                <span className="hidden sm:block text-[8px] lg:text-[9px] 2xl:text-[10px] leading-tight truncate w-full text-center">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stamp picker — shown when stamp tool is active */}
      {activeToolId === 'stamp' && (
        <StampPickerSection />
      )}

      {/* Reset + Clear All buttons */}
      <div className="p-1 2xl:p-2.5 border-b border-app-border flex flex-col sm:flex-row gap-1 2xl:gap-1.5">
        <button
          onClick={handleReset}
          className="flex-1 px-1 py-1 2xl:px-2.5 2xl:py-2 text-[8px] sm:text-xs 2xl:text-sm font-semibold border border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleClearAll}
          className="flex items-center justify-center gap-1 px-1 py-1 2xl:px-2.5 2xl:py-2 text-[8px] sm:text-xs 2xl:text-sm font-semibold border border-red-500 text-red-500 bg-app-bg rounded hover:bg-red-500 hover:text-white transition-colors"
          title="Clear all annotations from selected viewport(s)"
        >
          <Eraser className="w-3 h-3 sm:w-3.5 sm:h-3.5 2xl:w-4 2xl:h-4" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Cine button */}
      <div className="p-1 2xl:p-2.5 border-b border-app-border">
        <button
          onClick={handleCineToggle}
          className={`w-full flex items-center justify-center gap-1 2xl:gap-1.5 px-1 py-1 2xl:px-2.5 2xl:py-2 text-[8px] sm:text-xs 2xl:text-sm font-semibold rounded border transition-colors ${
            isPlaying
              ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/40'
              : 'border-app-border text-app-text hover:bg-app-hover'
          }`}
          title={isPlaying ? 'Stop Cine (currently playing)' : 'Start Cine playback'}
        >
          {isPlaying ? (
            <><StopCircle className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" /><span className="hidden sm:inline">Stop Cine</span></>
          ) : (
            <><Play className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" /><span className="hidden sm:inline">Cine</span></>
          )}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden lg:block p-1.5 2xl:p-2.5">
        <div className="text-[9px] 2xl:text-[10px] text-app-text-muted space-y-0.5">
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

/** StampPickerSection — stamp management panel in ToolsPanel sidebar */
function StampPickerSection() {
  const { stamps, selectedStampId, selectStamp, addStamp, removeStamp } = useStampStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');
  const [newColor, setNewColor] = useState('#ffff00');
  const [newFontSize, setNewFontSize] = useState(16);

  return (
    <div className="p-2.5 border-b border-app-border">
      <div className="text-xs font-semibold text-app-text-muted mb-1.5 uppercase">Select Stamp</div>
      <div className="text-[10px] text-app-text-muted mb-2">Select a stamp then click on viewport to place it.</div>

      {/* Saved stamps list */}
      <div className="max-h-[200px] overflow-y-auto space-y-1 mb-2">
        {stamps.map((stamp) => (
          <div key={stamp.id} className="flex items-center gap-1.5">
            <button
              onClick={() => selectStamp(selectedStampId === stamp.id ? null : stamp.id)}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded border transition-colors text-left ${
                selectedStampId === stamp.id
                  ? 'border-app-accent bg-app-accent/20 text-white'
                  : 'border-app-border text-app-text hover:bg-app-hover hover:border-app-accent'
              }`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stamp.color }} />
              <span className="text-[10px] font-bold flex-1 truncate uppercase">{stamp.text}</span>
              <span className="text-[9px] text-app-text-muted">{stamp.fontSize}px</span>
            </button>
            {!stamp.id.startsWith('default-') && (
              <button
                onClick={() => removeStamp(stamp.id)}
                className="p-1 text-red-400 hover:text-red-300 transition-colors"
                title="Delete stamp"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create new stamp inline */}
      {showCreate ? (
        <div className="border-t border-app-border pt-2 space-y-1.5">
          <div className="text-[10px] text-app-accent font-bold uppercase">Create Stamp</div>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Hospital)"
            className="w-full px-2 py-1 text-[10px] bg-app-bg text-app-text border border-app-border rounded focus:border-app-accent focus:outline-none"
            autoFocus />
          <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)}
            placeholder="Stamp text (e.g. APPROVED)"
            className="w-full px-2 py-1 text-[10px] bg-app-bg text-app-text border border-app-border rounded focus:border-app-accent focus:outline-none" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-app-text-muted uppercase">Size</span>
            <input type="range" min="10" max="40" value={newFontSize}
              onChange={(e) => setNewFontSize(parseInt(e.target.value))}
              className="w-20 h-1.5 bg-app-bg rounded-lg appearance-none cursor-pointer" />
            <span className="text-[9px] text-app-text w-8 text-right">{newFontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-app-text-muted uppercase">Color</span>
            <div className="flex gap-1">
              {['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ffffff'].map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className={`w-4 h-4 rounded-full border-2 ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="p-1.5 bg-black/40 rounded border border-app-border text-center">
            <span className="inline-block px-1.5 py-0.5 rounded font-bold border-2 border-current uppercase tracking-wider"
              style={{ color: newColor, fontSize: `${Math.min(newFontSize, 18)}px`, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
              {newText || 'PREVIEW'}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (newName.trim() && newText.trim()) {
                  addStamp({ name: newName.trim(), text: newText.trim(), color: newColor, fontSize: newFontSize });
                  setNewName(''); setNewText(''); setShowCreate(false);
                }
              }}
              disabled={!newName.trim() || !newText.trim()}
              className="flex-1 px-2 py-1.5 text-[10px] bg-green-600 text-white rounded font-bold hover:bg-green-500 disabled:opacity-40"
            >
              Save Stamp
            </button>
            <button onClick={() => setShowCreate(false)}
              className="px-2 py-1.5 text-[10px] bg-app-bg text-app-text-muted border border-app-border rounded hover:bg-app-hover">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full px-2 py-1.5 text-[10px] font-semibold border border-dashed border-app-accent text-app-accent rounded hover:bg-app-accent/10 transition-colors"
        >
          + Create New Stamp
        </button>
      )}
    </div>
  );
}
