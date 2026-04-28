import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewerStore } from '@/stores/viewerStore';
import { usePrintStore } from '@/stores/printStore';
import { useThemeStore } from '@/stores/themeStore';
import { useCustomAnnotationStore } from '@/stores/customAnnotationStore';
import { useReportStore } from '@/stores/reportStore';
import { resetViewport } from '@/lib/viewerTools';
import {
  Sun, Moon, ChevronLeft, ChevronRight, Printer, X, Copy, Check,
  PanelRightClose, PanelRightOpen, Undo2, RotateCcw, CheckSquare, Trash2, ImagePlus, FileText,
} from 'lucide-react';

export function ViewerHeader({ showThumbnails = true, onToggleThumbnails }: { showThumbnails?: boolean; onToggleThumbnails?: () => void }) {
  const navigate = useNavigate();
  const {
    currentPage, totalPages, totalImages, images,
    patientName, patientId, studyDate,
    nextPage, prevPage,
    selectAllViewports, selectedViewportIndices, selectedViewport,
    deleteImageFromViewport, insertAllViewports,
  } = useViewerStore();
  const { setShowPrintPreview, printCountRemaining } = usePrintStore();
  const { mode, toggleTheme } = useThemeStore();
  const showInlineReport = useReportStore((s) => s.showInlineReport);
  const setShowInlineReport = useReportStore((s) => s.setShowInlineReport);
  const [copied, setCopied] = useState(false);
  const hasImages = images.length > 0;

  const handleCopyHeader = () => {
    const parts = [patientName, patientId ? `ID: ${patientId}` : '', studyDate].filter(Boolean);
    const text = parts.join('  ');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // Detect if we're in a popup window
  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  return (
    <div className="flex items-center justify-between px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-header-bg border-b border-app-border">
      {/* Left: Back to patients / Close + page navigation */}
      <div className="flex items-center gap-3">
        {isPopup ? (
          <button
            onClick={() => window.close()}
            className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
            title="Close CR viewer"
          >
            <X className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
            Close
          </button>
        ) : (
          <button
            onClick={() => navigate('/')}
            className="px-2 py-1 2xl:px-3 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex items-center gap-1"
            title="Back to patient list"
          >
            <ChevronLeft className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
            Patients
          </button>
        )}
        <span className="text-xs 2xl:text-sm font-bold text-app-accent uppercase tracking-wide">CR Viewer</span>

        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="p-1 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs 2xl:text-sm text-app-text select-none whitespace-nowrap">
          Page {currentPage} of {totalPages}
          <span className="text-app-accent font-bold ml-1">({totalImages})</span>
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="p-1 text-app-accent hover:bg-app-hover rounded disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Patient details */}
      <div className="hidden sm:flex items-center gap-4 min-w-0">
        {patientName && (
          <div className="flex items-center gap-1.5 2xl:gap-4 text-xs 2xl:text-sm min-w-0 overflow-hidden">
            <span className="font-bold text-app-accent truncate max-w-[120px] md:max-w-[200px] 2xl:max-w-[350px]" title={patientName}>
              {patientName}
            </span>
            {patientId && (
              <span className="text-app-text font-semibold flex-shrink-0">ID: {patientId}</span>
            )}
            {studyDate && (
              <span className="hidden md:inline text-app-text font-semibold flex-shrink-0">{studyDate}</span>
            )}
            <button
              onClick={handleCopyHeader}
              className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary flex-shrink-0"
              title="Copy patient info to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-green-500" /> : <Copy className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Right: Action buttons + Print + Report + Theme */}
      <div className="flex items-center gap-1 2xl:gap-2 flex-shrink-0">
        {/* Undo */}
        <button
          onClick={() => useCustomAnnotationStore.getState().undo()}
          className="p-1 rounded border border-app-border text-app-text-secondary hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        {/* Reset All */}
        <button
          onClick={() => {
            useCustomAnnotationStore.getState().resetAll();
            document.querySelectorAll('[data-viewport-index]').forEach((el) => {
              try { resetViewport(el as HTMLDivElement); } catch { /* ignore */ }
            });
            useViewerStore.getState().clearViewportOverrides();
          }}
          className="p-1 rounded border border-app-border text-app-text-secondary hover:bg-red-500/20 hover:text-red-400 transition-colors"
          title="Reset All"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Insert All */}
        <button
          onClick={insertAllViewports}
          disabled={!hasImages}
          className="p-1 rounded border border-app-border text-app-text-secondary hover:bg-green-500/20 hover:text-green-400 transition-colors disabled:opacity-30"
          title="Insert all"
        >
          <ImagePlus className="w-3.5 h-3.5" />
        </button>

        {/* Select All */}
        <button
          onClick={selectAllViewports}
          className="p-1 rounded border border-app-border text-app-text-secondary hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
          title="Select all (Ctrl+A)"
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          onClick={() => {
            const indices = selectedViewportIndices.length > 1
              ? [...selectedViewportIndices].sort((a, b) => b - a)
              : [selectedViewport];
            indices.forEach(vi => deleteImageFromViewport(vi));
          }}
          disabled={!hasImages}
          className="p-1 rounded border border-app-border text-app-text-secondary hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-30"
          title="Delete image"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-app-border mx-0.5" />

        {/* Print count */}
        <span className="hidden lg:inline text-[10px] 2xl:text-sm text-app-text-secondary whitespace-nowrap">
          <span className={`font-bold ${printCountRemaining < 50 ? 'text-red-500' : 'text-green-500'}`}>
            {printCountRemaining}
          </span>
        </span>

        {/* Print */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="px-2 py-1 text-[10px] 2xl:text-sm font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors flex items-center gap-1"
          title="Print"
        >
          <Printer className="w-3 h-3" />
          Print
        </button>

        {/* Report - highlighted */}
        <button
          onClick={() => setShowInlineReport(!showInlineReport)}
          className={`px-2 py-1 text-[10px] 2xl:text-sm font-semibold border-2 border-app-accent rounded transition-colors flex items-center gap-1 ${showInlineReport ? 'text-white bg-app-accent hover:opacity-90' : 'text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'}`}
          title={showInlineReport ? 'Hide Report Panel' : 'Show Report Panel'}
        >
          <FileText className="w-3 h-3" />
          Report
        </button>

        {onToggleThumbnails && (
          <button
            onClick={onToggleThumbnails}
            className="p-1 2xl:p-1.5 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}
          >
            {showThumbnails ? <PanelRightClose className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" /> : <PanelRightOpen className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" />}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-1 2xl:p-1.5 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
          title={mode === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {mode === 'light' ? <Moon className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" /> : <Sun className="w-4 h-4 2xl:w-4.5 2xl:h-4.5" />}
        </button>
      </div>
    </div>
  );
}
