/**
 * DualPanelToolbar — Per-panel toolbar strip.
 * Layout dropdown, "All" checkbox, Reset, Clear.
 */
import { useDualViewerStore, DUAL_LAYOUTS, type PanelId } from '@/stores/dualViewerStore';
import { cornerstone, cornerstoneTools } from '@/lib/cornerstoneSetup';
import { RotateCcw } from 'lucide-react';

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

function clearAllPanelAnnotations(panelId: PanelId) {
  const elements = document.querySelectorAll(`[data-dual-viewport-index^="${panelId}-"]`);
  elements.forEach((el) => clearElementAnnotations(el as HTMLDivElement));
}

function clearPanelAnnotationsForViewport(panelId: PanelId, viewportIndex: number) {
  const el = document.querySelector(`[data-dual-viewport-index="${panelId}-${viewportIndex}"]`) as HTMLDivElement;
  if (!el) return;
  clearElementAnnotations(el);
}

interface DualPanelToolbarProps {
  panelId: PanelId;
}

export function DualPanelToolbar({ panelId }: DualPanelToolbarProps) {
  const panel = useDualViewerStore((s) => s.panels[panelId]);
  const { currentLayout, applyToAll, patientName, selectedViewport, selectedViewportIndices } = panel;

  const store = useDualViewerStore;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-app-surface border-b border-app-border text-xs">
      {/* Panel label */}
      <span className="text-[10px] font-bold text-app-accent uppercase tracking-wider w-8">
        {panelId === 'left' ? 'L' : 'R'}
      </span>

      {/* Layout selector */}
      <select
        value={currentLayout.id}
        onChange={(e) => {
          const layout = DUAL_LAYOUTS.find(l => l.id === e.target.value);
          if (layout) store.getState().setPanelLayout(panelId, layout);
        }}
        className="text-xs px-1.5 py-0.5 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
      >
        {DUAL_LAYOUTS.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      {/* All checkbox */}
      <label className="flex items-center gap-1 text-[10px] text-app-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={applyToAll}
          onChange={(e) => store.getState().setPanelApplyToAll(panelId, e.target.checked)}
          className="accent-app-accent w-3 h-3"
        />
        All
      </label>

      {/* Reset */}
      <button
        onClick={() => {
          store.getState().resetPanelAll(panelId);
          clearAllPanelAnnotations(panelId);
          window.dispatchEvent(new CustomEvent(`dual-custom-reset-${panelId}`));
        }}
        className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-red-400 border border-red-400/50 rounded hover:bg-red-500/20 transition-colors"
        title="Reset all (restore original order, clear annotations/stamps/zoom/WL)"
      >
        <RotateCcw className="w-3 h-3" />
        Reset
      </button>

      {/* Clear */}
      <button
        onClick={() => {
          const indicesToClear = selectedViewportIndices.length > 1
            ? selectedViewportIndices
            : [selectedViewport];
          indicesToClear.forEach(vi => {
            store.getState().clearStampPlacements(panelId, vi);
            clearPanelAnnotationsForViewport(panelId, vi);
            window.dispatchEvent(new CustomEvent(`dual-custom-reset-${panelId}`, { detail: { viewportIndex: vi } }));
          });
        }}
        className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-app-text-secondary border border-app-border rounded hover:bg-app-hover transition-colors"
        title="Clear selected viewport(s)"
      >
        <RotateCcw className="w-3 h-3" />
        Clear
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Patient name */}
      <span className="text-[10px] text-app-text-muted truncate max-w-[120px]">
        {patientName || 'No study'}
      </span>
    </div>
  );
}
