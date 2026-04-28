/**
 * CRToolbar — Top toolbar for the CR viewer.
 * Contains: Format selector, navigation arrows, Arrange, Preview, Print, Stamp buttons.
 */
import { useState } from 'react';
import { useCRViewerStore, CR_LAYOUTS, type CRLayout } from '@/stores/crViewerStore';
import { useReportStore } from '@/stores/reportStore';
import {
  ChevronLeft, ChevronRight, Printer, ListOrdered, FileText,
} from 'lucide-react';
import { CRPrintPreview } from './CRPrintPreview';

export function CRToolbar() {
  const {
    currentLayout, setLayout, totalImages,
    isArrangeMode, toggleArrangeMode,
    nextPage, prevPage, currentPage, totalPages,
    patientName, patientId, studyDate,
  } = useCRViewerStore();

  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printFilter, setPrintFilter] = useState<'All' | 'Current'>('All');

  return (
    <>
      <div className="flex items-center gap-1.5 2xl:gap-2 px-2 2xl:px-3 py-1 2xl:py-2 bg-app-surface border-b border-app-border">
        {/* Format / Layout selector */}
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <span className="text-[10px] 2xl:text-xs font-bold text-app-accent uppercase tracking-wider">Format</span>
          <select
            value={currentLayout.id}
            onChange={(e) => {
              const layout = CR_LAYOUTS.find(l => l.id === e.target.value);
              if (layout) setLayout(layout);
            }}
            className="text-xs 2xl:text-sm px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
          >
            {CR_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-0.5 ml-0.5">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="p-1 2xl:p-1.5 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          </button>
          <button
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="p-1 2xl:p-1.5 rounded border border-app-border text-app-accent hover:bg-app-hover disabled:opacity-30 transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          </button>
        </div>

        {/* Arrange button */}
        <button
          onClick={toggleArrangeMode}
          className={`flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold rounded border-2 transition-colors ${
            isArrangeMode
              ? 'border-green-500 bg-green-500/20 text-green-400'
              : 'border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white'
          }`}
          title="Arrange images in viewports"
        >
          <ListOrdered className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Arrange
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Info */}
        <span className="text-[10px] text-app-text-muted">
          Total Images {totalImages} | Selected {useCRViewerStore.getState().selectedViewport + 1}
        </span>

        {/* Image filter dropdown */}
        <select
          className="text-xs 2xl:text-sm px-2 2xl:px-3 py-1 2xl:py-1.5 bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:border-app-accent focus:outline-none"
          value={printFilter}
          onChange={(e) => setPrintFilter(e.target.value as 'All' | 'Current')}
        >
          <option value="All">All</option>
          <option value="Current">Current</option>
        </select>

        {/* Print button */}
        <button
          onClick={() => setShowPrintPreview(true)}
          className="flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Print"
        >
          <Printer className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Print
        </button>

        {/* Report button - highlighted */}
        <button
          onClick={() => {
            useReportStore.getState().openReportEditor(patientId, patientName, studyDate);
            useReportStore.getState().setShowInlineReport(true);
          }}
          className="flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-white bg-app-accent rounded hover:opacity-90 transition-colors"
          title="Create Report"
        >
          <FileText className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
          Report
        </button>
      </div>

      {/* Modals */}
      {showPrintPreview && <CRPrintPreview onClose={() => setShowPrintPreview(false)} initialPageMode={printFilter === 'Current' ? 'current' : 'all'} />}
    </>
  );
}
