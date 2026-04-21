/**
 * DualViewportPanel — Wrapper for one side of the dual viewer.
 * Green 2px border when active, transparent otherwise.
 * Captures mousedown to set active panel.
 */
import { useDualViewerStore, type PanelId } from '@/stores/dualViewerStore';
import { DualPanelToolbar } from './DualPanelToolbar';
import { DualViewportGrid } from './DualViewportGrid';

interface DualViewportPanelProps {
  panelId: PanelId;
}

export function DualViewportPanel({ panelId }: DualViewportPanelProps) {
  const activePanel = useDualViewerStore((s) => s.activePanel);
  const isActive = activePanel === panelId;

  return (
    <div
      className="flex-1 flex flex-col min-w-0 overflow-hidden"
      style={{
        border: isActive ? '2px solid #22c55e' : '2px solid transparent',
      }}
      onMouseDownCapture={() => {
        if (!isActive) useDualViewerStore.getState().setActivePanel(panelId);
      }}
    >
      <DualPanelToolbar panelId={panelId} />
      <DualViewportGrid panelId={panelId} />
    </div>
  );
}
