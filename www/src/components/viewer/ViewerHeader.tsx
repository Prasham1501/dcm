import { useNavigate } from 'react-router-dom';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

export function ViewerHeader() {
  const navigate = useNavigate();
  const {
    currentPage, totalPages, totalImages,
    patientName, patientId, studyDate,
    nextPage, prevPage,
  } = useViewerStore();
  const { setShowPrintPreview, printCountRemaining } = usePrintStore();
  const { mode, toggleTheme } = useThemeStore();

  return (
    <div className="flex items-center justify-between px-2 py-1 bg-app-header-bg border-b border-app-border">
      {/* Left: Back to patients + page navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/')}
          className="px-2 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
          title="Back to patient list"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Patients
        </button>

        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="p-0.5 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm text-app-text select-none whitespace-nowrap">
          Page {currentPage} of {totalPages}
          <span className="text-app-accent font-semibold ml-1">({totalImages})</span>
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="p-0.5 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: Patient details */}
      <div className="flex items-center gap-3 min-w-0">
        {patientName && (
          <div className="flex items-center gap-3 text-xs min-w-0 overflow-hidden">
            <span className="font-bold text-app-accent truncate max-w-[200px]" title={patientName}>
              {patientName}
            </span>
            {patientId && (
              <span className="text-app-text-muted flex-shrink-0">ID: {patientId}</span>
            )}
            {studyDate && (
              <span className="text-app-text-muted flex-shrink-0">{studyDate}</span>
            )}
          </div>
        )}
      </div>

      {/* Right: Print count + Print button + Theme toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-app-text-secondary whitespace-nowrap">
          Prints:{' '}
          <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-500'}`}>
            {printCountRemaining}
          </span>
        </span>

        <button
          onClick={() => setShowPrintPreview(true)}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors flex items-center gap-1"
          title="Open print preview"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>

        <button
          onClick={toggleTheme}
          className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
          title={mode === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
