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
  Pencil,
} from 'lucide-react';
import type { ReadingSet, Reading } from '@/lib/usgExtraction/types';
import { buildReportHtml } from '@/lib/usgExtraction/templates/buildReportHtml';

/** Run full extraction chain from the panel — tries DICOM tags first, then OCR */
async function runOcrExtraction(
  studyUID: string,
  setStatus: (s: 'idle' | 'running' | 'done' | 'failed') => void,
  setReadingSet: (rs: ReadingSet | null) => void,
) {
  setStatus('running');
  try {
    const { useCRViewerStore } = await import('@/stores/crViewerStore');
    const crImages = useCRViewerStore.getState().images;
    const filePaths = crImages.map((img: any) => img.filePath).filter(Boolean);

    // Also fetch metadata if not yet available
    const api = (window as any).electronAPI;
    if (api?.invoke && filePaths.length > 0 && !useReportStore.getState().dicomMetadata) {
      try {
        const meta = await api.invoke('extract-dicom-metadata', { filePaths });
        if (meta && Object.keys(meta).length > 0) {
          useReportStore.getState().setDicomMetadata(meta);
        }
      } catch { /* best-effort */ }
    }

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
  const dicomMeta = useReportStore((s) => s.dicomMetadata);

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

  // Auto-show Insert panel when Report opens with results ready
  // (readings are available but not yet inserted → show table immediately)
  // No separate effect needed — the editable table renders when hasReadings && !autoFillDone

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

      {/* ── Header (fixed) ───────────────────────────────────── */}
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

      {/* ── Patient / DICOM metadata (fixed top) ─────────────── */}
      {dicomMeta && Object.keys(dicomMeta).length > 0 && (
        <DicomMetadataBar metadata={dicomMeta} />
      )}

      {/* ── Meta fields (title + doctor, fixed) ──────────────── */}
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

      {/* ── Extraction status / scan / insert banner ──────────── */}
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
          {extractStatus !== 'running' && (
            <button
              onClick={handleManualScan}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded border border-app-border text-app-text-secondary hover:bg-app-hover transition-colors"
              title="Re-scan image for measurements"
            >
              <ScanSearch className="w-3 h-3" />
              Scan
            </button>
          )}
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
            <strong>Accuracy notice:</strong> Values extracted via{' '}
            {readingSet?.source === 'vision-llm' ? 'AI vision' : 'OCR'}{' '}
            — verify before finalising. Click any value to edit.
          </p>
        </div>
      )}

      {/* ── Editable readings table (before editor) ──────────── */}
      {hasReadings && !autoFillDone && (
        <EditableReadingsTable
          readingSet={readingSet!}
          onReadingsChange={(updated) => {
            setActiveReadingSet({ ...readingSet!, readings: updated });
          }}
        />
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

      {/* ── Editor (doctor can type before/after inserted readings) ── */}
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

/* ── Editable Readings Table ──────────────────────────────── */
function EditableReadingsTable({
  readingSet,
  onReadingsChange,
}: {
  readingSet: ReadingSet;
  onReadingsChange: (updated: Reading[]) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditVal(String(readingSet.readings[idx].value));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (editIdx === null) return;
    const updated = [...readingSet.readings];
    updated[editIdx] = { ...updated[editIdx], value: editVal };
    onReadingsChange(updated);
    setEditIdx(null);
  };

  const deleteReading = (idx: number) => {
    const updated = readingSet.readings.filter((_, i) => i !== idx);
    onReadingsChange(updated);
  };

  // Group by category
  const groups: Record<string, { idx: number; r: Reading }[]> = {};
  readingSet.readings.forEach((r, idx) => {
    const cat = r.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ idx, r });
  });

  return (
    <div className="max-h-48 overflow-y-auto border-b border-app-border shrink-0 bg-app-surface/50">
      <div className="px-3 py-1 flex items-center gap-1.5 border-b border-app-border/50">
        <Pencil className="w-3 h-3 text-app-text-secondary" />
        <span className="text-[10px] font-semibold text-app-text-secondary uppercase tracking-wide">
          Review & Edit Readings
        </span>
        <span className="text-[10px] text-app-text-secondary ml-auto">Click value to edit</span>
      </div>
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          {Object.keys(groups).length > 1 && (
            <div className="px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-app-accent/70 bg-app-accent/5">
              {cat}
            </div>
          )}
          <table className="w-full text-xs">
            <tbody>
              {items.map(({ idx, r }) => (
                <tr key={idx} className="border-b border-app-border/30 hover:bg-app-hover/50 group">
                  <td className="pl-3 pr-1 py-0.5 text-app-text-secondary whitespace-nowrap max-w-[140px] truncate" title={r.label}>
                    {r.label}
                  </td>
                  <td className="px-1 py-0.5 text-app-text font-medium">
                    {editIdx === idx ? (
                      <input
                        ref={inputRef}
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }}
                        className="w-full px-1 py-0 text-xs bg-white dark:bg-neutral-800 border border-app-accent rounded outline-none text-app-text"
                      />
                    ) : (
                      <span
                        onClick={() => startEdit(idx)}
                        className="cursor-pointer hover:text-app-accent hover:underline decoration-dotted inline-block min-w-[40px]"
                        title="Click to edit"
                      >
                        {r.value} {r.unit || ''}
                      </span>
                    )}
                  </td>
                  <td className="pr-2 py-0.5 w-6">
                    <button
                      onClick={() => deleteReading(idx)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── DICOM Metadata Bar ───────────────────────────────────── */
const META_LABELS: Record<string, string> = {
  patientName: 'Patient',
  patientId: 'ID',
  patientAge: 'Age',
  patientSex: 'Sex',
  studyDate: 'Date',
  studyDescription: 'Study',
  bodyPart: 'Body Part',
  manufacturer: 'Machine',
  modelName: 'Model',
  institutionName: 'Institution',
  referringPhysician: 'Ref. Physician',
  operatorName: 'Operator',
  protocolName: 'Protocol',
  accessionNumber: 'Accession',
  modality: 'Modality',
  stationName: 'Station',
  softwareVersion: 'SW Version',
};

function DicomMetadataBar({ metadata }: { metadata: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);

  // Split into primary (always shown) and secondary (expandable)
  const primaryKeys = ['patientName', 'patientAge', 'patientSex', 'modality', 'bodyPart', 'studyDate'];
  const primary = primaryKeys.filter((k) => metadata[k]).map((k) => ({ key: k, label: META_LABELS[k] || k, value: metadata[k] }));
  const secondary = Object.entries(metadata)
    .filter(([k, v]) => !primaryKeys.includes(k) && v)
    .map(([k, v]) => ({ key: k, label: META_LABELS[k] || k, value: v }));

  return (
    <div className="border-b border-app-border shrink-0 bg-blue-500/5">
      <div className="flex items-center gap-2 px-3 py-1 flex-wrap">
        {primary.map(({ key, label, value }) => (
          <span key={key} className="text-[10px] text-app-text-secondary">
            <span className="font-semibold text-app-text">{label}:</span> {value}
          </span>
        ))}
        {secondary.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-app-accent hover:underline ml-auto flex items-center gap-0.5"
          >
            {expanded ? 'Less' : `+${secondary.length} more`}
            {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>
      {expanded && secondary.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pb-1">
          {secondary.map(({ key, label, value }) => (
            <span key={key} className="text-[10px] text-app-text-secondary">
              <span className="font-semibold text-app-text">{label}:</span> {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
