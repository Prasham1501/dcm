/**
 * DualSidebar — Right sidebar for the Dual viewer.
 * All tools + navigation. Mirrors CRSidebar functionality.
 * Actions target the active panel.
 */
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { useReportStore } from '@/stores/reportStore';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useState } from 'react';
import {
  ChevronUp, ChevronDown,
  RotateCcw, Undo2, FileText, CheckSquare, Move, Trash2, Type,
  Minus, ArrowLeft, Square, Circle, Triangle,
} from 'lucide-react';

const DUAL_ANNOTATION_TOOLS = [
  'Length', 'Angle', 'ArrowAnnotate', 'EllipticalRoi', 'RectangleRoi',
  'Probe', 'Bidirectional', 'CobbAngle', 'ScaledEllipticalRoi',
  'FreehandRoi', 'TextMarker',
];

function clearElementAnnotations(el: HTMLDivElement) {
  DUAL_ANNOTATION_TOOLS.forEach(toolName => {
    try {
      const state = cornerstoneTools.getToolState(el, toolName);
      if (state && state.data) state.data.length = 0;
    } catch { /* ignore */ }
  });
  try { cornerstone.updateImage(el); } catch { /* ignore */ }
}

function clearAllPanelAnnotations(panelId: string) {
  const elements = document.querySelectorAll(`[data-dual-viewport-index^="${panelId}-"]`);
  elements.forEach((el) => clearElementAnnotations(el as HTMLDivElement));
}

function clearPanelAnnotationsForViewport(panelId: string, viewportIndex: number) {
  const el = document.querySelector(`[data-dual-viewport-index="${panelId}-${viewportIndex}"]`) as HTMLDivElement;
  if (!el) return;
  clearElementAnnotations(el);
}

export function DualSidebar() {
  const activePanel = useDualViewerStore((s) => s.activePanel);
  const panel = useDualViewerStore((s) => s.panels[s.activePanel]);
  const undoStampPlacement = useDualViewerStore((s) => s.undoStampPlacement);

  const isTextMode = useDualViewerStore((s) => s.isTextMode);

  const {
    currentPage, totalPages, selectedViewport, selectedViewportIndices, currentLayout,
    patientName, patientId, studyDate,
  } = panel;

  const store = useDualViewerStore;

  const [panActive, setPanActive] = useState(false);
  const [activeCSTool, setActiveCSTool] = useState<string | null>(null);

  const activateCSTool = (toolName: string) => {
    if (activeCSTool === toolName) {
      try { cornerstoneTools.setToolPassive(toolName); } catch { /* ignore */ }
      setActiveCSTool(null);
    } else {
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

  const handleOpenReport = () => {
    useReportStore.getState().openReportEditor(patientId, patientName, studyDate);
    useReportStore.getState().setShowInlineReport(true);
  };

  const SidebarButton = ({
    onClick, label, title, icon: Icon, variant = 'default',
  }: {
    onClick: () => void; label: string; title: string; icon?: React.ElementType;
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
    <div className="w-16 2xl:w-20 flex flex-col items-center bg-app-surface border-l border-app-border py-1.5 2xl:py-2 gap-1.5 2xl:gap-2 px-1 2xl:px-1.5 overflow-y-auto">
      {/* Pan toggle */}
      <SidebarButton onClick={togglePan} label="Pan" title={panActive ? 'Disable pan' : 'Enable pan'} icon={Move} variant={panActive ? 'accent' : 'default'} />

      {/* Measurement / Shape tools */}
      <SidebarButton onClick={() => activateCSTool('Length')} label="Line" title="Length measurement" icon={Minus} variant={activeCSTool === 'Length' ? 'accent' : 'default'} />
      <SidebarButton onClick={() => activateCSTool('ArrowAnnotate')} label="Arrow" title="Arrow annotation" icon={ArrowLeft} variant={activeCSTool === 'ArrowAnnotate' ? 'accent' : 'default'} />
      <SidebarButton onClick={() => activateCSTool('RectangleRoi')} label="Square" title="Rectangle ROI" icon={Square} variant={activeCSTool === 'RectangleRoi' ? 'accent' : 'default'} />
      <SidebarButton onClick={() => activateCSTool('EllipticalRoi')} label="Ellipse" title="Elliptical ROI" icon={Circle} variant={activeCSTool === 'EllipticalRoi' ? 'accent' : 'default'} />
      <SidebarButton onClick={() => activateCSTool('Angle')} label="Angle" title="Angle measurement" icon={Triangle} variant={activeCSTool === 'Angle' ? 'accent' : 'default'} />

      {/* Navigation — both panels */}
      <SidebarButton onClick={() => { store.getState().panelPrevPage('left'); store.getState().panelPrevPage('right'); }} label="Prev" title="Previous page (both panels)" icon={ChevronUp} />
      <SidebarButton onClick={() => { store.getState().panelNextPage('left'); store.getState().panelNextPage('right'); }} label="Next" title="Next page (both panels)" icon={ChevronDown} />

      <div className="w-full border-t border-app-border my-1" />

      {/* Reset All */}
      <SidebarButton
        onClick={() => {
          store.getState().resetPanelAll(activePanel);
          clearAllPanelAnnotations(activePanel);
          window.dispatchEvent(new CustomEvent(`dual-custom-reset-${activePanel}`));
        }}
        label="Reset"
        title="Reset active panel"
        icon={RotateCcw}
        variant="danger"
      />

      {/* Clear */}
      <SidebarButton
        onClick={() => {
          const indicesToClear = selectedViewportIndices.length > 1 ? selectedViewportIndices : [selectedViewport];
          indicesToClear.forEach(vi => {
            store.getState().clearStampPlacements(activePanel, vi);
            clearPanelAnnotationsForViewport(activePanel, vi);
            window.dispatchEvent(new CustomEvent(`dual-custom-reset-${activePanel}`, { detail: { viewportIndex: vi } }));
          });
        }}
        label="Clear"
        title="Clear selected viewport(s)"
        icon={RotateCcw}
        variant="default"
      />

      {/* Select All */}
      <SidebarButton
        onClick={() => store.getState().activeSelectAll()}
        label="Sel All"
        title="Select all viewports"
        icon={CheckSquare}
        variant={selectedViewportIndices.length > 1 ? 'accent' : 'default'}
      />

      {/* Text tool */}
      <SidebarButton
        onClick={() => store.getState().setTextMode(!isTextMode)}
        label="Text"
        title={isTextMode ? 'Disable text tool' : 'Enable text tool (click to place text)'}
        icon={Type}
        variant={isTextMode ? 'accent' : 'default'}
      />

      {/* Delete Image(s) */}
      <SidebarButton
        onClick={() => {
          const indicesToDelete = selectedViewportIndices.length > 1
            ? [...selectedViewportIndices].sort((a, b) => b - a)
            : [selectedViewport];
          indicesToDelete.forEach(vi => store.getState().deleteImageFromViewport(activePanel, vi));
        }}
        label={selectedViewportIndices.length > 1 ? 'Del All' : 'Delete'}
        title={selectedViewportIndices.length > 1 ? 'Delete all selected images' : 'Delete selected image'}
        icon={Trash2}
        variant="danger"
      />

      {/* Undo */}
      <SidebarButton onClick={undoStampPlacement} label="Undo" title="Undo last stamp/text" icon={Undo2} variant="default" />

      <div className="flex-1" />

      {/* Report */}
      <SidebarButton onClick={handleOpenReport} label="Report" title="Open report editor" icon={FileText} variant="accent" />

      {selectedViewportIndices.length > 1 && (
        <div className="text-[9px] text-yellow-400 font-bold leading-tight text-center">
          {selectedViewportIndices.length} SEL
        </div>
      )}
    </div>
  );
}
