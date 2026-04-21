/**
 * InlineReportPanel — Compact 30% split-screen report editor.
 * Rendered inside ViewerPage / DualViewerPage alongside the image viewport.
 * Reads patient context from viewerStore; persists via reportStore.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReportStore, type SavedReport } from '@/stores/reportStore';
import { useViewerStore } from '@/stores/viewerStore';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo2, Redo2, Save, Printer, X,
  Sparkles, ChevronDown, ChevronUp, Loader2, ScanSearch, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import type { ReadingSet } from '@/lib/usgExtraction/types';
import { buildReportHtml } from '@/lib/usgExtraction/templates/buildReportHtml';

/** Run full extraction chain from the panel — tries DICOM tags first, then OCR */
async function runOcrExtraction(
  studyUID: string,
  setStatus: (s: 'idle' | 'running' | 'done' | 'failed') => void,
  setReadingSet: (rs: ReadingSet | null) => void,
) {
  setStatus('running');
  try {
    // Get file paths from active CR viewer store (if available)
    const { useCRViewerStore } = await import('@/stores/crViewerStore');
    const crImages = useCRViewerStore.getState().images;
    const filePaths = crImages.map((img: any) => img.filePath).filter(Boolean);

    const { extractReadings } = await import('@/lib/usgExtraction/extractReadings');
    const result = await extractReadings({
      studyUID,
      orthancStudyId: '',
      orthancInstanceIds: [],
      imageUrls: crImages.map((img: any) => img.imageUrl),
      filePaths,
      hfToken: '',
    });
    setReadingSet(result.readings.length > 0 ? result : null);
    setStatus('done');
  } catch (err) {
    console.warn('[InlineReportPanel] manual scan failed:', err);
    setStatus('failed');
  }
}

export function InlineReportPanel() {
  const editorRef = useRef<HTMLDivElement>(null);

  // Report store
  const {
    savedReports, templates,
    saveFullReport, getReportsForPatient,
    setShowInlineReport,
    editingPatientId, editingPatientName, editingStudyDate,
  } = useReportStore();

  // Viewer context (same window, always available)
  // Falls back to reportStore context when opened from DualViewer
  const viewerPatientId   = useViewerStore((s) => s.patientId);
  const viewerPatientName = useViewerStore((s) => s.patientName);
  const viewerStudyDate   = useViewerStore((s) => s.studyDate);
  const patientId   = viewerPatientId   || editingPatientId   || '';
  const patientName = viewerPatientName || editingPatientName || '';
  const studyDate   = viewerStudyDate   || editingStudyDate   || '';

  // Read shared extraction state from reportStore so all viewers (ViewerPage, CRViewerPage,
  // DualViewerPage) can surface the auto-fill banner — viewerStore is empty for CR/Dual viewers.
  const readingSet   = useReportStore((s) => s.activeReadingSet) as ReadingSet | null;
  const extractStatus = useReportStore((s) => s.extractionStatus);
  const setActiveReadingSet = useReportStore((s) => s.setActiveReadingSet);
  const setExtractionStatus = useReportStore((s) => s.setExtractionStatus);
  const hasReadings = (readingSet?.readings?.length ?? 0) > 0;
  // 'dicom-sr' = structured DICOM data → 100% accurate; OCR/vision = may have errors
  const isHighConfidence = readingSet?.source === 'dicom-sr';
  const isLowConfidence  = hasReadings && (readingSet?.source === 'pixel-ocr' || readingSet?.source === 'vision-llm');

  const [title, setTitle]   = useState('');
  const [doctor, setDoctor] = useState('');
  const [status, setStatus] = useState<'draft' | 'final'>('draft');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [autoFillDone, setAutoFillDone] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleManualScan = useCallback(() => {
    const uid = patientId || 'manual';
    runOcrExtraction(uid, setExtractionStatus, setActiveReadingSet);
  }, [patientId, setExtractionStatus, setActiveReadingSet]);

  // Load latest report for this patient on open
  useEffect(() => {
    if (!patientId) return;
    const reports = getReportsForPatient(patientId);
    if (reports.length > 0) {
      const latest = [...reports].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = latest.content;
        setTitle(latest.title);
        setDoctor(latest.doctor);
        setStatus(latest.status);
        setCurrentReportId(latest.id);
      }, 50);
    } else {
      setTitle(`USG Report — ${patientName}`);
      setAutoFillDone(false);
    }
  }, [patientId]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  }, []);

  const handleSave = useCallback(() => {
    if (!editorRef.current) return;
    saveFullReport({
      id: currentReportId || undefined,
      patientId,
      patientName,
      studyDate,
      content: editorRef.current.innerHTML,
      title: title || 'Untitled',
      doctor,
      status,
    });
    if (!currentReportId) {
      const reports = getReportsForPatient(patientId);
      const newest = reports.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (newest) setCurrentReportId(newest.id);
    }
    setSaveMsg('Saved ✓');
    setTimeout(() => setSaveMsg(''), 2000);
  }, [currentReportId, patientId, patientName, studyDate, title, doctor, status, saveFullReport, getReportsForPatient]);

  const handleAutoFill = useCallback(() => {
    if (!readingSet || readingSet.readings.length === 0 || !editorRef.current) return;
    const html = buildReportHtml(readingSet, studyDate);
    if (!html) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(range.createContextualFragment(html));
    } else {
      editorRef.current.innerHTML += html;
    }
    setAutoFillDone(true);
  }, [readingSet, studyDate]);

  const handlePrint = useCallback(() => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Report</title>
      <style>body{font-family:'Times New Roman',serif;padding:32px;max-width:700px;margin:0 auto}
      h2{font-size:14px;color:#555;margin-top:18px}.meta{font-size:11px;color:#666;margin:8px 0}
      @media print{body{padding:16px}}</style></head>
      <body><h1 style="font-size:18px;border-bottom:2px solid #333;padding-bottom:6px">${title || 'Report'}</h1>
      <div class="meta">Patient: ${patientName} (${patientId}) | Study: ${studyDate} | Doctor: ${doctor}</div>
      <div>${content}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }, [title, patientName, patientId, studyDate, doctor]);

  const loadReport = useCallback((report: SavedReport) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = report.content;
    setTitle(report.title);
    setDoctor(report.doctor);
    setStatus(report.status);
    setCurrentReportId(report.id);
  }, []);

  const patientReports = patientId ? getReportsForPatient(patientId) : [];

  return (
    <div className="flex flex-col h-full bg-app-bg border-l-2 border-app-accent/40 text-app-text text-sm overflow-hidden">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-app-header-bg border-b border-app-border shrink-0 gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-app-accent text-xs uppercase tracking-wide whitespace-nowrap">Report</span>
          {patientName && (
            <span className="text-xs text-app-text/60 truncate max-w-[120px]" title={patientName}>{patientName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {saveMsg && <span className="text-xs text-green-500 font-semibold">{saveMsg}</span>}
          <button
            onClick={() => setStatus(s => s === 'draft' ? 'final' : 'draft')}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
              status === 'final' ? 'bg-green-600 text-white' : 'bg-yellow-500 text-black'
            }`}
          >{status === 'draft' ? 'DRAFT' : 'FINAL'}</button>
          <button onClick={handleSave} className="p-1 rounded hover:bg-app-hover text-app-accent" title="Save (Ctrl+S)">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={handlePrint} className="p-1 rounded hover:bg-app-hover text-app-text-secondary" title="Print">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={() => setShowInlineReport(false)} className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-app-text-secondary" title="Close report panel">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Auto-fill banner ─────────────────────────────────── */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b shrink-0 ${
        hasReadings
          ? isHighConfidence
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-app-accent/10 border-app-accent/30'
          : 'bg-app-surface border-app-border'
      }`}>
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          {extractStatus === 'running' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin text-app-text-secondary flex-shrink-0" />
              <span className="text-app-text-secondary">Extracting measurements…</span></>
          ) : hasReadings ? (
            <>
              {isHighConfidence
                ? <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                : <Sparkles className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
              }
              <span className="text-app-text font-medium">{readingSet?.readings.length} measurement{(readingSet?.readings.length ?? 0) !== 1 ? 's' : ''} found</span>
              <span className={`text-[10px] ml-1 ${isHighConfidence ? 'text-green-500' : 'text-amber-500'}`}>
                ({isHighConfidence ? '100% accurate · DICOM tags' : readingSet?.source === 'vision-llm' ? 'AI vision' : 'OCR'})
              </span>
            </>
          ) : (
            <span className="text-app-text-secondary text-[10px]">
              {extractStatus === 'failed' ? 'Scan failed —' : 'No measurements found —'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Manual scan button — always available when not running */}
          {extractStatus !== 'running' && (
            <button
              onClick={handleManualScan}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border border-app-border text-app-text-secondary hover:bg-app-hover transition-colors"
              title="Re-scan image for measurements using all methods (DICOM tags → OCR → AI)"
            >
              <ScanSearch className="w-3 h-3" />
              Scan
            </button>
          )}
          {/* Insert button — only when readings available */}
          {hasReadings && (
            <button
              onClick={handleAutoFill}
              disabled={autoFillDone}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border transition-colors ${
                autoFillDone
                  ? 'border-green-500/40 text-green-600 opacity-60 cursor-default'
                  : 'border-app-accent text-app-accent hover:bg-app-accent hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              {autoFillDone ? 'Inserted' : 'Insert'}
            </button>
          )}
        </div>
      </div>

      {/* ── Accuracy warning (OCR / AI only) ─────────────────── */}
      {isLowConfidence && (
        <div className="flex items-start gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug">
            <strong>Accuracy notice:</strong> Measurements were extracted via{' '}
            {readingSet?.source === 'vision-llm' ? 'AI vision analysis' : 'OCR image scanning'}{' '}
            and may not be 100% accurate. Please verify all values against the original image before finalising the report.
          </p>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-app-surface border-b border-app-border shrink-0 flex-wrap">
        <TBtn onClick={() => exec('bold')} title="Bold"><Bold className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('italic')} title="Italic"><Italic className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('underline')} title="Underline"><Underline className="w-3 h-3" /></TBtn>
        <div className="w-px h-4 bg-app-border mx-0.5" />
        <TBtn onClick={() => exec('formatBlock', 'h2')} title="H2"><span className="text-[10px] font-bold">H2</span></TBtn>
        <TBtn onClick={() => exec('formatBlock', 'p')} title="Paragraph"><span className="text-[10px]">P</span></TBtn>
        <div className="w-px h-4 bg-app-border mx-0.5" />
        <TBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-3 h-3" /></TBtn>
        <div className="w-px h-4 bg-app-border mx-0.5" />
        <TBtn onClick={() => exec('justifyLeft')} title="Left"><AlignLeft className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('justifyCenter')} title="Center"><AlignCenter className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('justifyRight')} title="Right"><AlignRight className="w-3 h-3" /></TBtn>
        <div className="w-px h-4 bg-app-border mx-0.5" />
        <TBtn onClick={() => exec('undo')} title="Undo"><Undo2 className="w-3 h-3" /></TBtn>
        <TBtn onClick={() => exec('redo')} title="Redo"><Redo2 className="w-3 h-3" /></TBtn>
      </div>

      {/* ── Meta fields ──────────────────────────────────────── */}
      <div className="flex gap-1.5 px-2 py-1.5 border-b border-app-border shrink-0">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Report title…"
          className="flex-1 px-2 py-1 text-xs bg-app-surface border border-app-border rounded focus:outline-none focus:border-app-accent text-app-text placeholder-app-text-secondary"
        />
        <input
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          placeholder="Doctor…"
          className="w-28 px-2 py-1 text-xs bg-app-surface border border-app-border rounded focus:outline-none focus:border-app-accent text-app-text placeholder-app-text-secondary"
        />
      </div>

      {/* ── Editor ───────────────────────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="flex-1 overflow-y-auto px-3 py-3 focus:outline-none text-sm leading-relaxed bg-white text-neutral-900"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: '13px', lineHeight: '1.75' }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            handleSave();
          }
        }}
      />

      {/* ── Saved reports accordion ──────────────────────────── */}
      {patientReports.length > 0 && (
        <div className="shrink-0 border-t border-app-border bg-app-surface">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-app-text-secondary hover:text-app-text"
          >
            <span>Saved reports ({patientReports.length})</span>
            {showTemplates ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showTemplates && (
            <div className="max-h-32 overflow-y-auto divide-y divide-app-border">
              {[...patientReports].sort((a, b) => b.updatedAt - a.updatedAt).map((r) => (
                <div key={r.id} className="flex items-center justify-between px-2 py-1 hover:bg-app-hover">
                  <div className="min-w-0">
                    <div className="text-xs text-app-text truncate">{r.title}</div>
                    <div className="text-[10px] text-app-text-secondary">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => loadReport(r)}
                    className="text-xs text-app-accent hover:underline ml-2 shrink-0"
                  >Load</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded text-app-text hover:bg-app-hover transition-colors"
    >
      {children}
    </button>
  );
}
