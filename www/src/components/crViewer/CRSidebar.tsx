/**
 * CRSidebar — Right sidebar for CR viewer.
 * Contains: Prev, Next, Reset All, Reset One, Report.
 */
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { useState } from 'react';
import {
  ChevronUp, ChevronDown,
  RotateCcw, Undo2, FileText, CheckSquare, Move, Trash2, Type,
  Minus, ArrowLeft, Square, Circle, Ruler, Triangle,
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

  const handleOpenReport = () => {
    useReportStore.getState().openReportEditor(patientId, patientName, studyDate);
    useReportStore.getState().setShowInlineReport(true);
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
    <div className="w-16 2xl:w-20 flex flex-col items-center bg-app-surface border-l border-app-border py-1.5 2xl:py-2 gap-1.5 2xl:gap-2 px-1 2xl:px-1.5 overflow-y-auto">
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
      <div className="w-full border-t border-app-border my-1" />

      {/* Reset All — supreme command: restores original order + clears ALL annotations/stamps/zoom/WL */}
      <SidebarButton
        onClick={() => {
          // 1. Restore original image order and default layout, clear stamps
          resetAll();
          // 2. Clear all cornerstoneTools annotations from every viewport element
          clearAllCRAnnotations();
          // 3. Reset zoom/pan/WL for every viewport
          window.dispatchEvent(new CustomEvent('cr-custom-reset'));
        }}
        label="Reset All"
        title="Supreme reset: restore image order and clear ALL annotations, stamps, zoom and W/L"
        icon={RotateCcw}
        variant="danger"
      />

      {/* Clear — clears selected viewport(s): annotations, stamps, zoom, W/L */}
      <SidebarButton
        onClick={() => {
          const indicesToClear = selectedViewportIndices.length > 1
            ? selectedViewportIndices
            : [selectedViewport];
          indicesToClear.forEach(vi => {
            // Clear stamps for this viewport
            clearStampPlacements(vi);
            // Clear cornerstoneTools annotations for this viewport element
            clearCRAnnotationsForViewport(vi);
            // Reset zoom/pan/WL for this viewport
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
        label="Select All"
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
        }}
        label={selectedViewportIndices.length > 1 ? 'Delete All' : 'Delete'}
        title={selectedViewportIndices.length > 1 ? 'Delete all selected images' : 'Delete selected image'}
        icon={Trash2}
        variant="danger"
      />

      {/* Undo */}
      <SidebarButton
        onClick={undoStampPlacement}
        label="Undo"
        title="Undo last stamp (Ctrl+Z)"
        icon={Undo2}
        variant="default"
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Report */}
      <SidebarButton
        onClick={handleOpenReport}
        label="Report"
        title="Open report editor"
        icon={FileText}
        variant="accent"
      />

      {/* Counter */}
      {selectedViewportIndices.length > 1 && (
        <div className="text-[9px] text-yellow-400 font-bold leading-tight text-center">
          {selectedViewportIndices.length} SELECTED
        </div>
      )}
    </div>
  );
}
