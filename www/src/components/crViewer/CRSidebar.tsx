/**
 * CRSidebar — Right sidebar for CR viewer.
 * Contains: Prev, Next, Reset All, Reset One, Report.
 */
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useStampStore } from '@/stores/stampStore';
import { useUndoStore } from '@/stores/undoStore';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { undoLastAnnotationOnElement } from '@/lib/annotationUtils';
import { useState, useEffect } from 'react';
import {
  ChevronUp, ChevronDown,
  RotateCcw, Undo2, CheckSquare, Move, Trash2, Type,
  Minus, ArrowLeft, Square, Circle, Triangle,
  Stamp, Plus,
} from 'lucide-react';

// All annotation tools that may be active in CR viewports
const CR_ANNOTATION_TOOLS = [
  'Length', 'Angle', 'ArrowAnnotate', 'EllipticalRoi', 'RectangleRoi',
  'Probe', 'Bidirectional', 'CobbAngle', 'ScaledEllipticalRoi',
  'FreehandRoi', 'TextMarker',
];

function clearElementAnnotations(el: HTMLDivElement) {
  CR_ANNOTATION_TOOLS.forEach(toolName => {
    try {
      const state = cornerstoneTools.getToolState(el, toolName);
      if (state && state.data) {
        state.data.length = 0;
      }
    } catch { /* ignore */ }
  });
  try { cornerstone.updateImage(el); } catch { /* ignore */ }
}

function clearAllCRAnnotations() {
  const elements = document.querySelectorAll('[data-cr-viewport-index]');
  elements.forEach((el) => clearElementAnnotations(el as HTMLDivElement));
}

function clearCRAnnotationsForViewport(viewportIndex: number) {
  const el = document.querySelector(`[data-cr-viewport-index="${viewportIndex}"]`) as HTMLDivElement;
  if (!el) return;
  clearElementAnnotations(el);
}

export function CRSidebar() {
  const {
    resetAll, selectedViewport,
    currentPage, totalPages,
    nextPage, prevPage,
    patientName, patientId, studyDate,
    selectAllViewports, selectedViewportIndices,
    undoStampPlacement, clearStampPlacements,
    deleteImageFromViewport,
    isTextMode, setTextMode,
  } = useCRViewerStore();

  const [panActive, setPanActive] = useState(false);
  const [activeCSTool, setActiveCSTool] = useState<string | null>(null);
  const [showStampDropdown, setShowStampDropdown] = useState(false);
  const [showStampCreate, setShowStampCreate] = useState(false);
  const [newStampName, setNewStampName] = useState('');
  const [newStampText, setNewStampText] = useState('');
  const [newStampColor, setNewStampColor] = useState('#ffff00');
  const [newStampFontSize, setNewStampFontSize] = useState(16);

  const { stamps: sharedStamps, selectedStampId, selectStamp, addStamp } = useStampStore();
  const { isStampMode, setStampMode, stampPlacements } = useCRViewerStore();

  // Listen for auto-deactivate events from viewports
  useEffect(() => {
    const handler = () => setActiveCSTool(null);
    window.addEventListener('cr-tool-deactivated', handler);
    return () => window.removeEventListener('cr-tool-deactivated', handler);
  }, []);

  // Delete key: delete active annotation, fallback to clear all
  // Ctrl+Z: undo last annotation or stamp
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        const { deleteActiveAnnotationOnElement } = require('@/lib/annotationUtils');
        // Try all CR viewports
        const viewports = document.querySelectorAll('[data-cr-viewport-index]');
        let deleted = false;
        viewports.forEach((el) => {
          if (!deleted && deleteActiveAnnotationOnElement(el as HTMLElement)) deleted = true;
        });
        if (!deleted) {
          clearAllCRAnnotations();
        }
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        e.stopImmediatePropagation();
        useUndoStore.getState().undo('crViewer');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activateCSTool = (toolName: string) => {
    if (activeCSTool === toolName) {
      // Deactivate
      try { cornerstoneTools.setToolPassive(toolName); } catch { /* ignore */ }
      setActiveCSTool(null);
    } else {
      // Deactivate previous
      if (activeCSTool) {
        try { cornerstoneTools.setToolPassive(activeCSTool); } catch { /* ignore */ }
      }
      if (panActive) {
        try { cornerstoneTools.setToolPassive('Pan'); } catch { /* ignore */ }
        setPanActive(false);
      }
      try { cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 }); } catch { /* ignore */ }
      setActiveCSTool(toolName);
    }
  };

  const togglePan = () => {
    if (panActive) {
      try { cornerstoneTools.setToolPassive('Pan'); } catch { /* ignore */ }
      setPanActive(false);
    } else {
      if (activeCSTool) {
        try { cornerstoneTools.setToolPassive(activeCSTool); } catch { /* ignore */ }
        setActiveCSTool(null);
      }
      try { cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 }); } catch { /* ignore */ }
      setPanActive(true);
    }
  };

  const SidebarButton = ({
    onClick,
    label,
    title,
    icon: Icon,
    variant = 'default',
  }: {
    onClick: () => void;
    label: string;
    title: string;
    icon?: React.ElementType;
    variant?: 'default' | 'accent' | 'danger';
  }) => {
    const colorClass = variant === 'accent'
      ? 'text-app-accent border-app-accent hover:bg-app-accent/20'
      : variant === 'danger'
        ? 'text-red-400 border-red-400/50 hover:bg-red-500/20'
        : 'text-app-text-secondary border-app-border hover:bg-app-hover';

    return (
      <button
        onClick={onClick}
        className={`w-full px-1.5 py-1.5 2xl:px-2 2xl:py-2 text-[10px] 2xl:text-xs font-bold uppercase tracking-wide border rounded transition-colors text-center leading-tight ${colorClass}`}
        title={title}
      >
        {Icon && <Icon className="w-4 h-4 2xl:w-4.5 2xl:h-4.5 mx-auto mb-0.5" />}
        {label}
      </button>
    );
  };

  return (
    <>
    <div className="w-28 2xl:w-36 flex flex-col bg-app-surface border-l border-app-border py-1.5 2xl:py-2 px-1 2xl:px-1.5">
      {/* Tool buttons in 2-column grid */}
      <div className="grid grid-cols-2 gap-1 2xl:gap-1.5">
        {/* Pan toggle */}
        <SidebarButton
          onClick={togglePan}
          label="Pan"
          title={panActive ? 'Disable pan (drag to move)' : 'Enable pan (drag to move)'}
          icon={Move}
          variant={panActive ? 'accent' : 'default'}
        />

        {/* Text tool */}
        <SidebarButton
          onClick={() => setTextMode(!isTextMode)}
          label="Text"
          title={isTextMode ? 'Disable text tool' : 'Enable text tool (click to place text)'}
          icon={Type}
          variant={isTextMode ? 'accent' : 'default'}
        />

        {/* Measurement / Shape tools */}
        <SidebarButton
          onClick={() => activateCSTool('Length')}
          label="Line"
          title="Length measurement tool"
          icon={Minus}
          variant={activeCSTool === 'Length' ? 'accent' : 'default'}
        />
        <SidebarButton
          onClick={() => activateCSTool('ArrowAnnotate')}
          label="Arrow"
          title="Arrow annotation tool"
          icon={ArrowLeft}
          variant={activeCSTool === 'ArrowAnnotate' ? 'accent' : 'default'}
        />
        <SidebarButton
          onClick={() => activateCSTool('RectangleRoi')}
          label="Square"
          title="Rectangle ROI tool"
          icon={Square}
          variant={activeCSTool === 'RectangleRoi' ? 'accent' : 'default'}
        />
        <SidebarButton
          onClick={() => activateCSTool('EllipticalRoi')}
          label="Ellipse"
          title="Elliptical ROI tool"
          icon={Circle}
          variant={activeCSTool === 'EllipticalRoi' ? 'accent' : 'default'}
        />
        <SidebarButton
          onClick={() => activateCSTool('Angle')}
          label="Angle"
          title="Angle measurement tool"
          icon={Triangle}
          variant={activeCSTool === 'Angle' ? 'accent' : 'default'}
        />

        {/* Stamp button */}
        <div className="relative">
          <SidebarButton
            onClick={() => {
              if (isStampMode) {
                setStampMode(false);
                setShowStampDropdown(false);
              } else {
                setShowStampDropdown(prev => !prev);
              }
            }}
            label="Stamp"
            title={isStampMode ? 'Exit stamp mode' : 'Stamp tool — select a stamp to place'}
            icon={Stamp}
            variant={isStampMode ? 'accent' : 'default'}
          />
          {/* Stamp dropdown */}
          {showStampDropdown && (
            <div className="absolute right-full top-0 mr-1 z-50 bg-app-bg border border-app-border rounded-lg shadow-xl min-w-[240px] py-1">
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

        {/* Divider */}
        <div className="col-span-2 border-t border-app-border my-0.5" />

        {/* Prev */}
        <SidebarButton
          onClick={prevPage}
          label="Prev"
          title="Previous page"
          icon={ChevronUp}
        />

        {/* Next */}
        <SidebarButton
          onClick={nextPage}
          label="Next"
          title="Next page"
          icon={ChevronDown}
        />

        {/* Divider */}
        <div className="col-span-2 border-t border-app-border my-0.5" />

        {/* Reset All */}
        <SidebarButton
          onClick={() => {
            resetAll();
            clearAllCRAnnotations();
            window.dispatchEvent(new CustomEvent('cr-custom-reset'));
          }}
          label="Reset"
          title="Supreme reset: restore image order and clear ALL annotations, stamps, zoom and W/L"
          icon={RotateCcw}
          variant="danger"
        />

        {/* Clear */}
        <SidebarButton
          onClick={() => {
            const indicesToClear = selectedViewportIndices.length > 1
              ? selectedViewportIndices
              : [selectedViewport];
            indicesToClear.forEach(vi => {
              clearStampPlacements(vi);
              clearCRAnnotationsForViewport(vi);
              window.dispatchEvent(new CustomEvent('cr-custom-reset', { detail: { viewportIndex: vi } }));
            });
          }}
          label="Clear"
          title="Clear selected viewport(s): annotations, stamps, zoom and W/L"
          icon={RotateCcw}
          variant="default"
        />

        {/* Select All */}
        <SidebarButton
          onClick={selectAllViewports}
          label="Sel All"
          title="Select all viewports (Ctrl+A)"
          icon={CheckSquare}
          variant={selectedViewportIndices.length > 1 ? 'accent' : 'default'}
        />

        {/* Delete Image(s) */}
        <SidebarButton
          onClick={() => {
            const indicesToDelete = selectedViewportIndices.length > 1
              ? [...selectedViewportIndices].sort((a, b) => b - a)
              : [selectedViewport];
            indicesToDelete.forEach(vi => deleteImageFromViewport(vi));
            useCRViewerStore.setState({ selectedViewport: 0, selectedViewportIndices: [0] });
          }}
          label="Delete"
          title={selectedViewportIndices.length > 1 ? 'Delete all selected images' : 'Delete selected image'}
          icon={Trash2}
          variant="danger"
        />

        {/* Undo */}
        <SidebarButton
          onClick={() => {
            useUndoStore.getState().undo('crViewer');
          }}
          label="Undo"
          title="Undo last annotation or stamp (Ctrl+Z)"
          icon={Undo2}
          variant="default"
        />
      </div>

      {/* Counter */}
      {selectedViewportIndices.length > 1 && (
        <div className="text-[9px] text-yellow-400 font-bold leading-tight text-center mt-1">
          {selectedViewportIndices.length} SELECTED
        </div>
      )}
    </div>

    {/* Close stamp dropdown on outside click */}
    {showStampDropdown && (
      <div className="fixed inset-0 z-40" onClick={() => { setShowStampDropdown(false); setShowStampCreate(false); }} />
    )}
    </>
  );
}
