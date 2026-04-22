/**
 * PrintPreviewModal — Shows a live preview of the report before printing.
 * Allows paper size selection (A4, A5, Letter) and confirms print.
 * Prints from iframe so Windows native print dialog shows full preview + all options.
 * Tracks print count and prompts on re-print.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, AlertTriangle } from 'lucide-react';
import { generatePrintHtml } from '@/lib/reportPrintTemplate';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';
import { useReportStore } from '@/stores/reportStore';

interface PrintPreviewModalProps {
  title: string;
  doctor: string;
  status: 'draft' | 'final';
  patientName: string;
  patientId: string;
  studyDate: string;
  content: string;
  dicomMeta?: Record<string, string> | null;
  reportId: string | null;
  onClose: () => void;
}

type PaperSize = 'a4' | 'a5' | 'letter';

const PAPER_SIZES: { value: PaperSize; label: string; desc: string }[] = [
  { value: 'a4', label: 'A4', desc: '210 × 297 mm' },
  { value: 'a5', label: 'A5', desc: '148 × 210 mm' },
  { value: 'letter', label: 'Letter', desc: '8.5 × 11 in' },
];

export function PrintPreviewModal({
  title, doctor, status, patientName, patientId, studyDate, content, dicomMeta, reportId,
  onClose,
}: PrintPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [showReprintConfirm, setShowReprintConfirm] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { markReportPrinted, getReportPrintCount } = useReportStore();
  const printCount = reportId ? getReportPrintCount(reportId) : 0;

  // Generate preview HTML
  const previewHtml = useCallback(() => {
    const hcfg = useHospitalConfigStore.getState();
    return generatePrintHtml(
      {
        hospitalName: hcfg.hospitalName,
        address1: hcfg.address1, address2: hcfg.address2, address3: hcfg.address3,
        city: hcfg.city, state: hcfg.state, pincode: hcfg.pincode,
        phone: hcfg.phone, email: hcfg.email, website: hcfg.website,
        registration: hcfg.registration, logoDataUrl: hcfg.logoDataUrl,
        enableFooter: hcfg.enableFooter,
        footerLayout: hcfg.footerLayout,
        customFooterLeft: hcfg.customFooterLeft, customFooterCenter: hcfg.customFooterCenter,
        customFooterRight: hcfg.customFooterRight, customFooterText: hcfg.customFooterText,
      },
      { title, doctor, status, patientName, patientId, studyDate, content, dicomMeta, paperSize },
    );
  }, [title, doctor, status, patientName, patientId, studyDate, content, dicomMeta, paperSize]);

  // Update iframe content whenever preview changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const html = previewHtml();
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [previewHtml]);

  // Print using Electron's IPC (Chromium dialog with preview) or fallback to iframe print
  const doPrint = useCallback(async () => {
    if (reportId) {
      markReportPrinted(reportId);
    }
    const html = previewHtml();
    const api = (window as any).electronAPI;
    if (api?.printReportDialog) {
      // Electron: uses hidden BrowserWindow + silent:false → Chromium print dialog WITH preview
      const pageSizeMap: Record<PaperSize, string> = { a4: 'A4', a5: 'A5', letter: 'Letter' };
      try {
        await api.printReportDialog({ htmlContent: html, paperSize: pageSizeMap[paperSize] });
      } catch (e) {
        console.warn('Electron print dialog failed, falling back:', e);
      }
    } else {
      // Browser fallback: open new window
      const w = window.open('', '_blank', 'width=800,height=900');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
      }
    }
  }, [previewHtml, reportId, markReportPrinted, paperSize]);

  const handlePrint = useCallback(() => {
    if (printCount > 0 && !showReprintConfirm) {
      setShowReprintConfirm(true);
      return;
    }
    doPrint();
  }, [printCount, showReprintConfirm, doPrint]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-app-bg rounded-xl shadow-2xl flex flex-col overflow-hidden border border-app-border"
        style={{ width: '92vw', maxWidth: '1200px', height: '94vh', maxHeight: '920px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-app-header-bg border-b border-app-border shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-app-accent" />
            <span className="font-bold text-app-accent text-sm uppercase tracking-wider">Print Preview</span>
            {printCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-semibold">
                Printed {printCount}×
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-500/15 text-app-text-secondary hover:text-red-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Full Preview */}
          <div className="flex-1 overflow-auto bg-neutral-300/40 dark:bg-neutral-900/60 p-6 flex justify-center items-start">
            <div
              className="bg-white rounded-lg shadow-xl overflow-hidden border border-neutral-300"
              style={{
                width: '100%',
                maxWidth: '650px',
                minHeight: '700px',
              }}
            >
              <iframe
                ref={iframeRef}
                className="w-full border-0"
                style={{ minHeight: '850px', height: '100%' }}
                title="Print Preview"
              />
            </div>
          </div>

          {/* Right: Controls */}
          <div className="w-56 shrink-0 border-l border-app-border bg-app-surface flex flex-col p-4 gap-4">
            {/* Paper Size */}
            <div>
              <label className="text-[10px] font-bold text-app-text-secondary uppercase tracking-widest mb-2 block">
                Paper Size
              </label>
              <div className="flex flex-col gap-1.5">
                {PAPER_SIZES.map(ps => (
                  <button
                    key={ps.value}
                    onClick={() => { setPaperSize(ps.value); setShowReprintConfirm(false); }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                      paperSize === ps.value
                        ? 'border-app-accent bg-app-accent/10 text-app-accent'
                        : 'border-app-border text-app-text-secondary hover:bg-app-hover'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">{ps.label}</div>
                      <div className="text-[10px] text-app-text-secondary/70">{ps.desc}</div>
                    </div>
                    {paperSize === ps.value && <CheckCircle2 className="w-4 h-4 text-app-accent" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Report Info */}
            <div className="text-[10px] text-app-text-secondary space-y-1 border-t border-app-border pt-3">
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-bold ${status === 'final' ? 'text-green-600' : 'text-amber-500'}`}>
                  {status === 'final' ? 'FINAL' : 'DRAFT'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Patient:</span>
                <span className="font-medium text-app-text truncate max-w-[120px]">{patientName}</span>
              </div>
              {doctor && (
                <div className="flex justify-between">
                  <span>Doctor:</span>
                  <span className="font-medium text-app-text truncate max-w-[120px]">{doctor}</span>
                </div>
              )}
            </div>

            {/* Reprint warning */}
            {showReprintConfirm && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[11px] text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Already Printed
                </div>
                <p>This report was previously printed {printCount} time{printCount > 1 ? 's' : ''}. Print again?</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={doPrint}
                    className="flex-1 px-2 py-1 text-[10px] font-bold rounded bg-app-accent text-white hover:bg-app-accent/90"
                  >
                    Yes, Print
                  </button>
                  <button
                    onClick={() => setShowReprintConfirm(false)}
                    className="flex-1 px-2 py-1 text-[10px] font-bold rounded border border-app-border text-app-text-secondary hover:bg-app-hover"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Hint */}
            <div className="text-[9px] text-app-text-secondary/60 leading-snug">
              The Windows print dialog will open with full preview and all print options (copies, orientation, color, page range, etc.)
            </div>

            {/* Print Button */}
            <div className="mt-auto">
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-app-accent text-white font-bold text-sm hover:bg-app-accent/90 transition-colors shadow-md"
              >
                <Printer className="w-4 h-4" />
                {printCount > 0 ? 'Reprint' : 'Print Report'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
