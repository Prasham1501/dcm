/**
 * CRSidebar — Right sidebar for CR viewer.
 * Contains: Prev, Next, Reset All, Reset One, Report.
 */
import { useCRViewerStore } from '@/stores/crViewerStore';
import {
  ChevronUp, ChevronDown,
  RotateCcw, Eraser, FileText,
} from 'lucide-react';

export function CRSidebar() {
  const {
    resetAll, resetOne, selectedViewport,
    currentPage, totalPages,
    nextPage, prevPage,
    patientName, patientId, studyDate,
  } = useCRViewerStore();

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
      <SidebarButton
        onClick={prevPage}
        label="Prev"
        title="Previous page"
        icon={ChevronUp}
      />

      {/* Navigation arrows */}
      <button
        onClick={prevPage}
        disabled={currentPage <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-app-accent text-app-accent hover:bg-app-accent hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      <button
        onClick={nextPage}
        disabled={currentPage >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-full border border-app-accent text-app-accent hover:bg-app-accent hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Next */}
      <SidebarButton
        onClick={nextPage}
        label="Next"
        title="Next page"
        icon={ChevronDown}
      />

      {/* Divider */}
      <div className="w-full border-t border-app-border my-1" />

      {/* Reset All */}
      <SidebarButton
        onClick={() => {
          if (window.confirm('Reset all viewports?')) resetAll();
        }}
        label="Reset All"
        title="Reset all viewports to default"
        icon={RotateCcw}
        variant="accent"
      />

      {/* Reset One */}
      <SidebarButton
        onClick={() => resetOne(selectedViewport)}
        label="Reset one"
        title="Reset selected viewport"
        icon={Eraser}
        variant="danger"
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
    </div>
  );
}
