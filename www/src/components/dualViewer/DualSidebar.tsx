/**
 * DualSidebar — Shared right sidebar for the Dual viewer.
 * All actions target the active panel.
 * Prev/Next, Reset All, Clear, Select All/Deselect All, Undo stamp, Report.
 */
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import {
  ChevronUp, ChevronDown, RotateCcw, Undo2, FileText, CheckSquare, XSquare,
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

  const {
    currentPage, totalPages, selectedViewport, selectedViewportIndices, currentLayout,
    patientName, patientId, studyDate,
  } = panel;

  const store = useDualViewerStore;

  const handleOpenReport = async () => {
    localStorage.setItem('report-launch', JSON.stringify({
      patientName, patientId, studyDate, timestamp: Date.now(),
    }));
    const api = (window as any).electronAPI;
    if (api?.openReportEditor) {
      try { await api.openReportEditor(); return; } catch { /* fallback */ }
    }
    window.open('/report-editor', '_blank');
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
        className={`w-full px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border rounded transition-colors text-center leading-tight ${colorClass}`}
        title={title}
      >
        {Icon && <Icon className="w-3.5 h-3.5 mx-auto mb-0.5" />}
        {label}
      </button>
    );
  };

  return (
    <div className="w-16 flex flex-col items-center bg-app-surface border-l border-app-border py-2 gap-1.5 px-1 overflow-y-auto">
      {/* Prev */}
      <SidebarButton onClick={() => store.getState().activePrevPage()} label="Prev" title="Previous page" icon={ChevronUp} />

      {/* Navigation arrows */}
      <button
        onClick={() => store.getState().activePrevPage()}
        disabled={currentPage <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-app-accent text-app-accent hover:bg-app-accent hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => store.getState().activeNextPage()}
        disabled={currentPage >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-app-accent text-app-accent hover:bg-app-accent hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Next */}
      <SidebarButton onClick={() => store.getState().activeNextPage()} label="Next" title="Next page" icon={ChevronDown} />

      <div className="w-full border-t border-app-border my-1" />

      {/* Reset All */}
      <SidebarButton
        onClick={() => {
          store.getState().resetPanelAll(activePanel);
          clearAllPanelAnnotations(activePanel);
          window.dispatchEvent(new CustomEvent(`dual-custom-reset-${activePanel}`));
        }}
        label="Reset All"
        title="Reset active panel: restore image order and clear all annotations/stamps/zoom/WL"
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
            store.getState().clearStampPlacements(activePanel, vi);
            clearPanelAnnotationsForViewport(activePanel, vi);
            window.dispatchEvent(new CustomEvent(`dual-custom-reset-${activePanel}`, { detail: { viewportIndex: vi } }));
          });
        }}
        label="Clear"
        title="Clear selected viewport(s) in active panel"
        icon={RotateCcw}
        variant="default"
      />

      {/* Select All / Deselect All */}
      {(() => {
        const allSelected = selectedViewportIndices.length === currentLayout.spots;
        return (
          <SidebarButton
            onClick={() => store.getState().activeSelectAll()}
            label={allSelected ? 'Desel All' : 'Select All'}
            title={allSelected ? 'Deselect all viewports (Ctrl+A)' : 'Select all viewports (Ctrl+A)'}
            icon={allSelected ? XSquare : CheckSquare}
            variant={allSelected ? 'accent' : 'default'}
          />
        );
      })()}

      {/* Undo */}
      <SidebarButton onClick={undoStampPlacement} label="Undo" title="Undo last stamp" icon={Undo2} variant="default" />

      <div className="flex-1" />

      {/* Report */}
      <SidebarButton onClick={handleOpenReport} label="Report" title="Open report editor" icon={FileText} variant="accent" />

      {/* Counter */}
      {selectedViewportIndices.length > 1 && (
        <div className="text-[9px] text-yellow-400 font-bold leading-tight text-center">
          {selectedViewportIndices.length} SELECTED
        </div>
      )}
    </div>
  );
}
