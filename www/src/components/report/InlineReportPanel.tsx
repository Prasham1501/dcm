/**
 * InlineReportPanel — Professional Word-like report editor.
 * Full rich-text editing with toggle formatting, collapsible sections,
 * and integrated findings workflow.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReportStore, type SavedReport } from '@/stores/reportStore';
import { useViewerStore } from '@/stores/viewerStore';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2, Save, Printer, X,
  Sparkles, ChevronDown, ChevronUp, Loader2, ScanSearch, AlertTriangle, ShieldCheck,
  Pencil, Type, Minus, Eraser,
  Superscript, Subscript, Highlighter,
  RotateCcw, TableProperties, PanelLeftClose, PanelLeft, FileText,
} from 'lucide-react';
import type { ReadingSet, Reading } from '@/lib/usgExtraction/types';
import { buildReportHtml } from '@/lib/usgExtraction/templates/buildReportHtml';
import {
  computeOBData, formatGA, parseGAtoWeeks, ordinal,
  FLAG_COLORS, type OBComputedReading, type OBComputedResult,
} from '@/lib/usgExtraction/obCalculations';
import { GrowthChartPanel, type GrowthChartPoint } from './GrowthChart';
import { FindingsPanel } from './FindingsPanel';
import { PrintPreviewModal } from './PrintPreviewModal';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';

/* ── Font options ─────────────────────────────────────────── */
const FONT_FAMILIES = [
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Courier New', label: 'Courier New' },
];

const FONT_SIZES = ['8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

const HEADING_OPTIONS = [
  { value: 'p', label: 'Normal' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
];

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#B22222', '#CC0000', '#FF0000', '#FF6600',
  '#008000', '#006600', '#00AA00', '#00CC66',
  '#0000CC', '#0066CC', '#3399FF', '#6633CC',
];

const HIGHLIGHT_COLORS = [
  'transparent', '#FFFF00', '#00FF00', '#00FFFF',
  '#FF69B4', '#FFA500', '#ADD8E6', '#90EE90',
];

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

  // Viewer context
  const viewerPatientId   = useViewerStore((s) => s.patientId);
  const viewerPatientName = useViewerStore((s) => s.patientName);
  const viewerStudyDate   = useViewerStore((s) => s.studyDate);
  const patientId   = viewerPatientId   || editingPatientId   || '';
  const patientName = viewerPatientName || editingPatientName || '';
  const studyDate   = viewerStudyDate   || editingStudyDate   || '';

  // Extraction state
  const readingSet   = useReportStore((s) => s.activeReadingSet) as ReadingSet | null;
  const extractStatus = useReportStore((s) => s.extractionStatus);
  const setActiveReadingSet = useReportStore((s) => s.setActiveReadingSet);
  const setExtractionStatus = useReportStore((s) => s.setExtractionStatus);
  const hasReadings = (readingSet?.readings?.length ?? 0) > 0;
  const isHighConfidence = readingSet?.source === 'dicom-sr';
  const isLowConfidence  = hasReadings && (readingSet?.source === 'pixel-ocr' || readingSet?.source === 'vision-llm');
  const dicomMeta = useReportStore((s) => s.dicomMetadata);

  // Hospital config for header display
  const hospitalName = useHospitalConfigStore((s) => s.hospitalName);
  const hAddr1 = useHospitalConfigStore((s) => s.address1);
  const hAddr2 = useHospitalConfigStore((s) => s.address2);
  const hCity = useHospitalConfigStore((s) => s.city);
  const hState = useHospitalConfigStore((s) => s.state);
  const hPincode = useHospitalConfigStore((s) => s.pincode);
  const hPhone = useHospitalConfigStore((s) => s.phone);
  const hEmail = useHospitalConfigStore((s) => s.email);
  const hWebsite = useHospitalConfigStore((s) => s.website);
  const hLogoDataUrl = useHospitalConfigStore((s) => s.logoDataUrl);
  const hRegistration = useHospitalConfigStore((s) => s.registration);
  const footerLayout = useHospitalConfigStore((s) => s.footerLayout);
  const customFooterLeft = useHospitalConfigStore((s) => s.customFooterLeft);
  const customFooterCenter = useHospitalConfigStore((s) => s.customFooterCenter);
  const customFooterRight = useHospitalConfigStore((s) => s.customFooterRight);
  const customFooterText = useHospitalConfigStore((s) => s.customFooterText);
  const enableFooter = useHospitalConfigStore((s) => s.enableFooter);

  const [title, setTitle]   = useState('');
  const [doctor, setDoctor] = useState('');
  const [status, setStatus] = useState<'draft' | 'final'>('draft');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [autoFillDone, setAutoFillDone] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // UI state
  const [showFindings, setShowFindings] = useState(false);
  const [showReadings, setShowReadings] = useState(true);
  const [showMetadata, setShowMetadata] = useState(false);
  const [formatState, setFormatState] = useState<Record<string, boolean>>({});
  const [showFontColor, setShowFontColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // OB data for FindingsPanel
  const panelOBData = useMemo(() => {
    if (!hasReadings) return null;
    const readings = readingSet!.readings;
    const hasOB = readings.some(r => r.category === 'obstetric');
    if (!hasOB) return null;
    const gaReading = readings.find(r => r.key === 'GA' || r.key.startsWith('GA_'));
    const machineGA = gaReading ? String(gaReading.value) : undefined;
    return computeOBData(readings, machineGA);
  }, [hasReadings, readingSet]);

  /* ── Insert HTML into editor ─────────────────────────────── */
  const insertHtmlIntoEditor = useCallback((html: string) => {
    if (!editorRef.current || !html) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(range.createContextualFragment(html));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editorRef.current.innerHTML += html;
    }
  }, []);

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

  /* ── execCommand wrapper ─────────────────────────────────── */
  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    updateFormatState();
  }, []);

  /* ── Track active formatting state (for toggle buttons) ──── */
  const updateFormatState = useCallback(() => {
    const state: Record<string, boolean> = {};
    const checks = ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
      'insertUnorderedList', 'insertOrderedList',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
    for (const cmd of checks) {
      try { state[cmd] = document.queryCommandState(cmd); } catch { state[cmd] = false; }
    }
    setFormatState(state);
  }, []);

  /* ── Save handler ────────────────────────────────────────── */
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
    insertHtmlIntoEditor(html);
    setAutoFillDone(true);
  }, [readingSet, studyDate, insertHtmlIntoEditor]);

  const handlePrint = useCallback(() => {
    if (!editorRef.current) return;
    setShowPrintPreview(true);
  }, []);

  const loadReport = useCallback((report: SavedReport) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = report.content;
    setTitle(report.title);
    setDoctor(report.doctor);
    setStatus(report.status);
    setCurrentReportId(report.id);
  }, []);

  const patientReports = patientId ? getReportsForPatient(patientId) : [];

  /* ═══════════════════════════════════════════════════════════ */
  /*  RENDER                                                     */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full bg-neutral-100 dark:bg-neutral-900 border-l-2 border-app-accent/30 text-app-text text-sm overflow-hidden">

      {/* ═══ TOP BAR ═══════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b border-app-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-app-accent flex-shrink-0" />
          <span className="font-bold text-app-accent text-xs uppercase tracking-wider whitespace-nowrap">Report Editor</span>
          {patientName && (
            <span className="text-[11px] text-app-text/50 truncate max-w-[150px] hidden sm:inline" title={patientName}>
              — {patientName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {saveMsg && <span className="text-[11px] text-green-500 font-semibold animate-pulse">{saveMsg}</span>}
          <button
            onClick={() => setStatus(s => s === 'draft' ? 'final' : 'draft')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-full tracking-wide transition-colors ${
              status === 'final'
                ? 'bg-green-600 text-white'
                : 'bg-amber-400/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-300'
            }`}
          >{status === 'draft' ? 'DRAFT' : 'FINAL'}</button>
          <ToolbarIconBtn onClick={handleSave} tip="Save (Ctrl+S)" accent><Save className="w-4 h-4" /></ToolbarIconBtn>
          <ToolbarIconBtn onClick={handlePrint} tip="Print"><Printer className="w-4 h-4" /></ToolbarIconBtn>
          <ToolbarIconBtn onClick={() => setShowInlineReport(false)} tip="Close" danger><X className="w-4 h-4" /></ToolbarIconBtn>
        </div>
      </div>

      {/* ═══ PATIENT META + TITLE + DOCTOR (collapsible) ═══════ */}
      <div className="shrink-0 border-b border-app-border bg-app-surface/50">
        {/* DICOM Metadata row */}
        {dicomMeta && Object.keys(dicomMeta).length > 0 && (
          <div className="px-3 py-1 border-b border-app-border/40">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="flex items-center gap-1 w-full text-[10px] text-app-text-secondary hover:text-app-text"
            >
              <TableProperties className="w-3 h-3" />
              <span className="font-medium">DICOM Info</span>
              <span className="text-app-text-secondary/50">
                {dicomMeta.patientAge && `· ${dicomMeta.patientAge}`}
                {dicomMeta.patientSex && `/${dicomMeta.patientSex}`}
                {dicomMeta.modality && ` · ${dicomMeta.modality}`}
              </span>
              {showMetadata ? <ChevronUp className="w-2.5 h-2.5 ml-auto" /> : <ChevronDown className="w-2.5 h-2.5 ml-auto" />}
            </button>
            {showMetadata && <DicomMetadataBar metadata={dicomMeta} />}
          </div>
        )}

        {/* Title + Doctor row */}
        <div className="flex gap-1.5 px-3 py-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Report title…"
            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-app-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-app-accent/50 text-app-text placeholder-app-text-secondary/50"
          />
          <input
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="Doctor name…"
            className="w-32 px-2 py-1 text-xs bg-white dark:bg-neutral-800 border border-app-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-app-accent/50 text-app-text placeholder-app-text-secondary/50"
          />
        </div>
      </div>

      {/* ═══ EXTRACTION BANNER ═════════════════════════════════ */}
      <div className={`flex items-center justify-between px-3 py-1 border-b shrink-0 ${
        hasReadings
          ? isHighConfidence ? 'bg-green-500/10 border-green-500/20' : 'bg-sky-500/8 border-sky-500/20'
          : 'bg-app-surface/30 border-app-border/50'
      }`}>
        <div className="flex items-center gap-1.5 text-[11px] min-w-0">
          {extractStatus === 'running' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin text-app-text-secondary" />
              <span className="text-app-text-secondary">Extracting…</span></>
          ) : hasReadings ? (
            <>
              {isHighConfidence
                ? <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                : <Sparkles className="w-3.5 h-3.5 text-sky-500" />}
              <span className="text-app-text font-medium">{readingSet?.readings.length} measurements</span>
              <span className={`text-[10px] ${isHighConfidence ? 'text-green-600' : 'text-amber-500'}`}>
                ({isHighConfidence ? 'DICOM' : readingSet?.source === 'vision-llm' ? 'AI' : 'OCR'})
              </span>
            </>
          ) : (
            <span className="text-app-text-secondary text-[10px]">{extractStatus === 'failed' ? 'Scan failed' : 'No measurements'}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {extractStatus !== 'running' && (
            <button onClick={handleManualScan}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border border-app-border/60 text-app-text-secondary hover:bg-app-hover transition-colors"
            ><ScanSearch className="w-3 h-3" />Scan</button>
          )}
          {hasReadings && !autoFillDone && (
            <button onClick={() => setShowReadings(!showReadings)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border border-sky-400/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors"
            ><Pencil className="w-3 h-3" />{showReadings ? 'Hide' : 'Review'}</button>
          )}
          {hasReadings && (
            <button onClick={handleAutoFill} disabled={autoFillDone}
              className={`flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                autoFillDone
                  ? 'border-green-500/30 text-green-600 cursor-default'
                  : 'border-app-accent text-app-accent hover:bg-app-accent hover:text-white'
              }`}
            ><Sparkles className="w-3 h-3" />{autoFillDone ? 'Inserted ✓' : 'Insert Readings'}</button>
          )}
          <button onClick={() => setShowFindings(!showFindings)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors ${
              showFindings
                ? 'border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                : 'border-app-border/60 text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            {showFindings ? <PanelLeftClose className="w-3 h-3" /> : <PanelLeft className="w-3 h-3" />}
            Findings
          </button>
        </div>
      </div>

      {/* Accuracy warning */}
      {isLowConfidence && (
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/8 border-b border-amber-500/20 shrink-0">
          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            <b>Verify values</b> — extracted via {readingSet?.source === 'vision-llm' ? 'AI' : 'OCR'}. Click to edit.
          </p>
        </div>
      )}

      {/* ═══ READINGS TABLE (collapsible) ══════════════════════ */}
      {hasReadings && !autoFillDone && showReadings && (
        <EditableReadingsTable
          readingSet={readingSet!}
          onReadingsChange={(updated) => setActiveReadingSet({ ...readingSet!, readings: updated })}
        />
      )}

      {/* ═══ MAIN CONTENT AREA ═════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* ═══ WORD-LIKE TOOLBAR ══════════════════════════════ */}
          <div className="shrink-0 bg-app-surface border-b border-app-border px-1 py-0.5">
            {/* Row 1: Font family, size, heading */}
            <div className="flex items-center gap-1 flex-wrap mb-0.5">
              <select
                onChange={(e) => exec('fontName', e.target.value)}
                defaultValue="Times New Roman"
                className="h-6 px-1 text-[10px] bg-white dark:bg-neutral-800 border border-app-border/50 rounded text-app-text w-28 focus:outline-none cursor-pointer"
                title="Font Family"
              >
                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
              </select>

              <select
                onChange={(e) => exec('fontSize', e.target.value)}
                defaultValue="3"
                className="h-6 px-1 text-[10px] bg-white dark:bg-neutral-800 border border-app-border/50 rounded text-app-text w-12 focus:outline-none cursor-pointer"
                title="Font Size"
              >
                {FONT_SIZES.map((s, i) => <option key={s} value={String(i + 1)}>{s}</option>)}
              </select>

              <select
                onChange={(e) => exec('formatBlock', e.target.value)}
                defaultValue="p"
                className="h-6 px-1 text-[10px] bg-white dark:bg-neutral-800 border border-app-border/50 rounded text-app-text w-20 focus:outline-none cursor-pointer"
                title="Paragraph Style"
              >
                {HEADING_OPTIONS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>

            {/* Row 2: Formatting buttons */}
            <div className="flex items-center gap-0 flex-wrap">
              <FmtBtn active={formatState.bold} onClick={() => exec('bold')} tip="Bold (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.italic} onClick={() => exec('italic')} tip="Italic (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.underline} onClick={() => exec('underline')} tip="Underline (Ctrl+U)"><Underline className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.strikeThrough} onClick={() => exec('strikeThrough')} tip="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.superscript} onClick={() => exec('superscript')} tip="Superscript"><Superscript className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.subscript} onClick={() => exec('subscript')} tip="Subscript"><Subscript className="w-3.5 h-3.5" /></FmtBtn>

              <ToolbarSep />

              {/* Font color */}
              <div className="relative">
                <FmtBtn onClick={() => { setShowFontColor(!showFontColor); setShowHighlight(false); }} tip="Font Color">
                  <div className="flex flex-col items-center">
                    <Type className="w-3 h-3" />
                    <div className="w-3.5 h-0.5 bg-red-600 rounded-full mt-px" />
                  </div>
                </FmtBtn>
                {showFontColor && (
                  <ColorPicker
                    colors={TEXT_COLORS}
                    onSelect={(c) => { exec('foreColor', c); setShowFontColor(false); }}
                    onClose={() => setShowFontColor(false)}
                  />
                )}
              </div>

              {/* Highlight */}
              <div className="relative">
                <FmtBtn onClick={() => { setShowHighlight(!showHighlight); setShowFontColor(false); }} tip="Highlight">
                  <div className="flex flex-col items-center">
                    <Highlighter className="w-3 h-3" />
                    <div className="w-3.5 h-0.5 bg-yellow-400 rounded-full mt-px" />
                  </div>
                </FmtBtn>
                {showHighlight && (
                  <ColorPicker
                    colors={HIGHLIGHT_COLORS}
                    onSelect={(c) => { exec('hiliteColor', c === 'transparent' ? 'transparent' : c); setShowHighlight(false); }}
                    onClose={() => setShowHighlight(false)}
                  />
                )}
              </div>

              <ToolbarSep />

              <FmtBtn active={formatState.justifyLeft} onClick={() => exec('justifyLeft')} tip="Align Left"><AlignLeft className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.justifyCenter} onClick={() => exec('justifyCenter')} tip="Center"><AlignCenter className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.justifyRight} onClick={() => exec('justifyRight')} tip="Align Right"><AlignRight className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.justifyFull} onClick={() => exec('justifyFull')} tip="Justify"><AlignJustify className="w-3.5 h-3.5" /></FmtBtn>

              <ToolbarSep />

              <FmtBtn active={formatState.insertUnorderedList} onClick={() => exec('insertUnorderedList')} tip="Bullet List"><List className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn active={formatState.insertOrderedList} onClick={() => exec('insertOrderedList')} tip="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></FmtBtn>

              <ToolbarSep />

              <FmtBtn onClick={() => exec('indent')} tip="Increase Indent"><span className="text-[10px] font-bold">→⎸</span></FmtBtn>
              <FmtBtn onClick={() => exec('outdent')} tip="Decrease Indent"><span className="text-[10px] font-bold">⎸←</span></FmtBtn>

              <ToolbarSep />

              <FmtBtn onClick={() => exec('insertHorizontalRule')} tip="Horizontal Line"><Minus className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn onClick={() => exec('removeFormat')} tip="Clear Formatting"><Eraser className="w-3.5 h-3.5" /></FmtBtn>

              <ToolbarSep />

              <FmtBtn onClick={() => exec('undo')} tip="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></FmtBtn>
              <FmtBtn onClick={() => exec('redo')} tip="Redo (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></FmtBtn>
            </div>
          </div>

          {/* ═══ EDITOR AREA (A4-style paper) ══════════════════ */}
          <div className="flex-1 overflow-y-auto bg-neutral-200/60 dark:bg-neutral-800/60 p-4 sm:p-6">
            <div
              className="bg-white dark:bg-neutral-50 text-neutral-900 rounded-lg shadow-md border border-neutral-300/60 mx-auto"
              style={{ maxWidth: '780px', fontFamily: "'Times New Roman', Georgia, serif" }}
            >
              {/* ── Hospital Header (non-editable) ── */}
              <div className="select-none" style={{ padding: '30px 50px 0 50px' }}>
                <div style={{ display: 'flex', alignItems: 'center', paddingBottom: '8px', borderBottom: '2px solid #333', marginBottom: '6px' }}>
                  {/* LEFT: Logo */}
                  {hLogoDataUrl && (
                    <div style={{ flexShrink: 0 }}>
                      <img src={hLogoDataUrl} alt="" style={{ maxHeight: '55px', maxWidth: '70px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {/* CENTER: Name + Address + Contact */}
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a', letterSpacing: '0.5px' }}>{hospitalName}</div>
                    {(() => {
                      const addrLine = [hAddr1, hAddr2, [hCity, hState, hPincode].filter(Boolean).join(', ')].filter(Boolean).join(', ');
                      return addrLine ? <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{addrLine}</div> : null;
                    })()}
                    {(() => {
                      const parts: string[] = [];
                      if (hPhone) parts.push(`Tel: ${hPhone}`);
                      if (hEmail) parts.push(hEmail);
                      if (hWebsite) parts.push(hWebsite);
                      if (hRegistration) parts.push(`Reg: ${hRegistration}`);
                      return parts.length > 0
                        ? <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{parts.join('  |  ')}</div>
                        : null;
                    })()}
                  </div>
                </div>

                {/* ── Patient Demographics Bar ── */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 20px',
                  padding: '6px 10px', background: '#f5f5f5', border: '1px solid #ddd',
                  borderRadius: '3px', marginBottom: '8px', fontSize: '11px',
                }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ color: '#777', minWidth: '65px' }}>Patient:</span>
                    <span style={{ fontWeight: 600, color: '#222' }}>{patientName || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ color: '#777', minWidth: '65px' }}>ID:</span>
                    <span style={{ fontWeight: 600, color: '#222' }}>{patientId || '—'}</span>
                  </div>
                  {dicomMeta?.patientAge && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ color: '#777', minWidth: '65px' }}>Age:</span>
                      <span style={{ fontWeight: 600, color: '#222' }}>{dicomMeta.patientAge}</span>
                    </div>
                  )}
                  {dicomMeta?.patientSex && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ color: '#777', minWidth: '65px' }}>Sex:</span>
                      <span style={{ fontWeight: 600, color: '#222' }}>{dicomMeta.patientSex === 'M' ? 'Male' : dicomMeta.patientSex === 'F' ? 'Female' : dicomMeta.patientSex}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ color: '#777', minWidth: '65px' }}>Study Date:</span>
                    <span style={{ fontWeight: 600, color: '#222' }}>{studyDate || '—'}</span>
                  </div>
                  {dicomMeta?.modality && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ color: '#777', minWidth: '65px' }}>Modality:</span>
                      <span style={{ fontWeight: 600, color: '#222' }}>{dicomMeta.modality}</span>
                    </div>
                  )}
                  {dicomMeta?.referringPhysician && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ color: '#777', minWidth: '65px' }}>Ref. Doctor:</span>
                      <span style={{ fontWeight: 600, color: '#222' }}>{dicomMeta.referringPhysician}</span>
                    </div>
                  )}
                </div>

                {/* ── Report Title ── */}
                <div style={{
                  fontSize: '15px', fontWeight: 'bold', textAlign: 'center',
                  margin: '6px 0 4px', padding: '4px 0', borderBottom: '1px solid #ccc',
                  textTransform: 'uppercase', letterSpacing: '1px', color: '#333',
                }}>
                  {title || 'Ultrasonography Report'}
                </div>
              </div>

              {/* ── Editable Content ── */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="focus:outline-none"
                style={{
                  fontFamily: "'Times New Roman', Georgia, serif",
                  fontSize: '16px',
                  lineHeight: '1.9',
                  minHeight: '400px',
                  padding: '16px 50px 40px 50px',
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                onKeyUp={updateFormatState}
                onMouseUp={updateFormatState}
                onSelect={updateFormatState}
                onClick={() => { setShowFontColor(false); setShowHighlight(false); }}
              />

              {/* ── Doctor Signature area (non-editable) ── */}
              {doctor && (
                <div className="select-none" style={{ padding: '0 50px 10px 50px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <div style={{ textAlign: 'center', minWidth: '180px' }}>
                      <div style={{ borderTop: '1px solid #555', marginBottom: '4px', width: '100%' }} />
                      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{doctor}</div>
                      <div style={{ fontSize: '10px', color: '#666' }}>Radiologist / Sonologist</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Footer (config-driven) ── */}
              {(() => {
                if (!enableFooter) return null;
                const hasFooter = footerLayout.left !== 'none' || footerLayout.center !== 'none' || footerLayout.right !== 'none';
                if (!hasFooter) return null;
                const renderSlot = (slot: string, align: 'left' | 'center' | 'right') => {
                  const ta = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
                  const customText = align === 'left' ? (customFooterLeft || customFooterText)
                    : align === 'center' ? (customFooterCenter || customFooterText)
                    : (customFooterRight || customFooterText);
                  let content: React.ReactNode = null;
                  switch (slot) {
                    case 'logo':
                      content = hLogoDataUrl ? <img src={hLogoDataUrl} alt="" style={{ maxHeight: '30px', maxWidth: '80px', objectFit: 'contain' }} /> : null;
                      break;
                    case 'name':
                      content = <span style={{ fontWeight: 600 }}>{hospitalName}</span>;
                      break;
                    case 'address': {
                      const addr = [hAddr1, hAddr2, [hCity, hState, hPincode].filter(Boolean).join(', ')].filter(Boolean).join(', ');
                      content = <span>{addr}{hPhone ? ` | Tel: ${hPhone}` : ''}</span>;
                      break;
                    }
                    case 'custom':
                      content = customText ? <span>{customText}</span> : null;
                      break;
                    default:
                      return null;
                  }
                  if (!content) return null;
                  return <div style={{ flex: 1, textAlign: ta }}>{content}</div>;
                };
                return (
                  <div className="select-none" style={{
                    padding: '6px 50px', borderTop: '1px solid #ccc', marginTop: '10px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '9px', color: '#888',
                  }}>
                    {renderSlot(footerLayout.left, 'left')}
                    {renderSlot(footerLayout.center, 'center')}
                    {renderSlot(footerLayout.right, 'right')}
                  </div>
                );
              })()}
            </div>
          </div>

        {/* ── FINDINGS BOTTOM PANEL ─────────────────────────── */}
        {showFindings && (
          <div className="shrink-0 border-t-2 border-app-accent/30 flex flex-col bg-app-bg overflow-hidden" style={{ height: '280px' }}>
            <div className="flex items-center justify-between px-3 py-1 bg-app-surface border-b border-app-border shrink-0">
              <span className="text-[11px] font-bold text-app-accent uppercase tracking-wider">Findings & Impression</span>
              <button onClick={() => setShowFindings(false)} className="text-app-text-secondary hover:text-app-text">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <FindingsPanel
                detectedTemplate={readingSet?.templateKey}
                obData={panelOBData}
                onInsert={(html) => { insertHtmlIntoEditor(html); }}
                compact
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══ STATUS BAR (bottom) ═══════════════════════════════ */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-app-surface border-t border-app-border shrink-0 text-[10px] text-app-text-secondary relative">
        <div className="flex items-center gap-3">
          {patientReports.length > 0 && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 hover:text-app-text transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              {patientReports.length} saved report{patientReports.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <span className="text-app-text-secondary/50">{status === 'draft' ? 'Draft' : 'Finalised'} · {new Date().toLocaleDateString()}</span>

        {/* Saved reports dropdown */}
        {showTemplates && patientReports.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-white dark:bg-neutral-800 border border-app-border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
            {[...patientReports].sort((a, b) => b.updatedAt - a.updatedAt).map((r) => (
              <div key={r.id}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-app-hover border-b border-app-border/20 last:border-0 cursor-pointer"
                onClick={() => { loadReport(r); setShowTemplates(false); }}
              >
                <div className="min-w-0">
                  <div className="text-xs text-app-text truncate font-medium">{r.title}</div>
                  <div className="text-[10px] text-app-text-secondary">{new Date(r.updatedAt).toLocaleDateString()} · {r.doctor || 'No doctor'}</div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.status === 'final' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ PRINT PREVIEW MODAL ═══════════════════════════════ */}
      {showPrintPreview && (
        <PrintPreviewModal
          title={title}
          doctor={doctor}
          status={status}
          patientName={patientName}
          patientId={patientId}
          studyDate={studyDate}
          content={editorRef.current?.innerHTML || ''}
          dicomMeta={dicomMeta}
          reportId={currentReportId}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Sub-components                                            */
/* ═══════════════════════════════════════════════════════════ */

/** Formatting toolbar button with active/toggle state */
function FmtBtn({ active, onClick, tip, children }: {
  active?: boolean;
  onClick: () => void;
  tip: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={tip}
      className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-app-accent/15 text-app-accent border border-app-accent/30'
          : 'text-app-text-secondary hover:bg-app-hover hover:text-app-text border border-transparent'
      }`}
    >
      {children}
    </button>
  );
}

/** Toolbar separator */
function ToolbarSep() {
  return <div className="w-px h-5 bg-app-border/40 mx-0.5" />;
}

/** Header icon button */
function ToolbarIconBtn({ onClick, tip, accent, danger, children }: {
  onClick: () => void;
  tip: string;
  accent?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={`p-1 rounded transition-colors ${
        accent ? 'text-app-accent hover:bg-app-accent/10' :
        danger ? 'text-app-text-secondary hover:bg-red-500/15 hover:text-red-400' :
        'text-app-text-secondary hover:bg-app-hover'
      }`}
    >
      {children}
    </button>
  );
}

/** Color picker dropdown */
function ColorPicker({ colors, onSelect, onClose }: {
  colors: string[];
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-neutral-800 border border-app-border rounded-lg shadow-lg p-1.5 grid grid-cols-4 gap-1 w-28">
        {colors.map(c => (
          <button
            key={c}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(c); }}
            className="w-5 h-5 rounded border border-neutral-300 dark:border-neutral-600 hover:scale-125 transition-transform"
            style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
            title={c === 'transparent' ? 'None' : c}
          >
            {c === 'transparent' && <X className="w-3 h-3 text-red-400 mx-auto" />}
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Editable Readings Table with OB intelligence               */
/* ═══════════════════════════════════════════════════════════ */
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

  const hasOB = readingSet.readings.some(r => r.category === 'obstetric');
  const gaReading = readingSet.readings.find(r => r.key === 'GA' || r.key.startsWith('GA_'));
  const machineGA = gaReading ? String(gaReading.value) : undefined;
  const obData = hasOB ? computeOBData(readingSet.readings, machineGA) : null;

  const obMap = new Map<string, OBComputedReading>();
  if (obData) { for (const r of obData.readings) obMap.set(r.key, r); }

  const groups: Record<string, { idx: number; r: Reading }[]> = {};
  readingSet.readings.forEach((r, idx) => {
    const cat = r.category || 'general';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ idx, r });
  });

  const biometryKeys = new Set(['BPD', 'HC', 'AC', 'FL', 'CRL', 'HL']);
  const [showCharts, setShowCharts] = useState(true);

  const chartPoints: GrowthChartPoint[] = [];
  if (obData && obData.referenceGA) {
    const chartableKeys = ['BPD', 'HC', 'AC', 'FL'];
    for (const r of obData.readings) {
      const base = r.key.replace(/_\d+$/, '');
      if (!chartableKeys.includes(base)) continue;
      if (chartPoints.some(p => p.key === base)) continue;
      const numVal = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
      if (isNaN(numVal)) continue;
      chartPoints.push({ key: base, value: numVal, gaWeeks: obData.referenceGA!, percentile: r.percentile });
    }
    if (obData.computedEFW && obData.computedEFW.percentile != null) {
      chartPoints.push({ key: 'EFW', value: obData.computedEFW.value, gaWeeks: obData.referenceGA!, percentile: obData.computedEFW.percentile });
    }
  }

  return (
    <div className="max-h-80 overflow-y-auto border-b border-app-border shrink-0 bg-app-surface/30">
      {/* OB Summary bar */}
      {obData && (obData.compositeGA || obData.computedEFW) && (
        <div className="px-3 py-1.5 bg-blue-500/5 border-b border-blue-500/15 flex flex-wrap gap-3 text-[11px]">
          {obData.compositeGA && (
            <span className="text-blue-700 dark:text-blue-300">
              <b>Composite GA:</b> {obData.compositeGA}
              {machineGA && <span className="text-app-text-secondary ml-1">(Machine: {machineGA})</span>}
            </span>
          )}
          {obData.computedEFW && (
            <span className={obData.computedEFW.flag === 'normal' ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}>
              <b>EFW:</b> {obData.computedEFW.value}g
              {obData.computedEFW.percentile != null && ` (${ordinal(obData.computedEFW.percentile!)} %ile)`}
            </span>
          )}
          {obData.afiResult && (
            <span className={obData.afiResult.interpretation === 'Normal' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
              <b>AFI:</b> {obData.afiResult.value}cm — {obData.afiResult.interpretation}
            </span>
          )}
        </div>
      )}

      {/* Growth charts */}
      {chartPoints.length > 0 && (
        <div className="border-b border-app-border/50">
          <button onClick={() => setShowCharts(!showCharts)}
            className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold text-app-text-secondary uppercase tracking-wide hover:bg-app-hover/50"
          >
            <span>Growth Charts ({chartPoints.length})</span>
            {showCharts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showCharts && <GrowthChartPanel points={chartPoints} chartWidth={185} chartHeight={130} />}
        </div>
      )}

      {/* Readings table */}
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          {Object.keys(groups).length > 1 && (
            <div className="px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-app-accent/60 bg-app-accent/5">{cat}</div>
          )}
          <table className="w-full text-xs">
            <tbody>
              {cat === 'obstetric' && hasOB && items.some(({ r }) => biometryKeys.has(r.key.replace(/_\d+$/, ''))) && (
                <tr className="text-[9px] text-app-text-secondary">
                  <td className="pl-3 pr-1 py-0">Parameter</td>
                  <td className="px-1 py-0">Value</td>
                  <td className="px-1 py-0">Est. GA</td>
                  <td className="px-1 py-0 text-center">%ile</td>
                  <td className="w-6"></td>
                </tr>
              )}
              {items.map(({ idx, r }) => {
                const ob = obMap.get(r.key);
                const isBiometry = biometryKeys.has(r.key.replace(/_\d+$/, ''));
                const flag = ob?.flag || 'normal';
                const flagStyle = FLAG_COLORS[flag];

                return (
                  <tr key={idx} className="border-b border-app-border/20 hover:bg-app-hover/30 group">
                    <td className="pl-3 pr-1 py-0.5 text-app-text-secondary whitespace-nowrap max-w-[120px] truncate" title={r.label}>{r.label}</td>
                    <td className="px-1 py-0.5 text-app-text font-medium">
                      {editIdx === idx ? (
                        <input ref={inputRef} value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }}
                          className="w-full px-1 py-0 text-xs bg-white dark:bg-neutral-800 border border-app-accent rounded outline-none text-app-text"
                        />
                      ) : (
                        <span onClick={() => startEdit(idx)}
                          className="cursor-pointer hover:text-app-accent hover:underline decoration-dotted inline-block min-w-[40px]"
                          title="Click to edit"
                        >{r.value} {r.unit || ''}</span>
                      )}
                    </td>
                    <td className="px-1 py-0.5 text-[10px] text-app-text-secondary">{ob?.estimatedGA && isBiometry ? ob.estimatedGA : ''}</td>
                    <td className="px-1 py-0.5 text-center">
                      {ob?.percentile != null && isBiometry ? (
                        <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-semibold ${flagStyle.bg} ${flagStyle.text}`}>
                          {ordinal(ob.percentile!)} {FLAG_COLORS[flag].label}
                        </span>
                      ) : ''}
                    </td>
                    <td className="pr-2 py-0.5 w-6">
                      <button onClick={() => deleteReading(idx)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        title="Remove"
                      ><X className="w-3 h-3" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  DICOM Metadata Bar                                        */
/* ═══════════════════════════════════════════════════════════ */
const META_LABELS: Record<string, string> = {
  patientName: 'Patient', patientId: 'ID', patientAge: 'Age', patientSex: 'Sex',
  studyDate: 'Date', studyDescription: 'Study', bodyPart: 'Body Part',
  manufacturer: 'Machine', modelName: 'Model', institutionName: 'Institution',
  referringPhysician: 'Ref. Physician', operatorName: 'Operator', protocolName: 'Protocol',
  accessionNumber: 'Accession', modality: 'Modality', stationName: 'Station', softwareVersion: 'SW Version',
};

function DicomMetadataBar({ metadata }: { metadata: Record<string, string> }) {
  const entries = Object.entries(metadata).filter(([, v]) => v);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-1 py-1 mt-1">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[10px] text-app-text-secondary">
          <span className="font-semibold text-app-text">{META_LABELS[k] || k}:</span> {v}
        </span>
      ))}
    </div>
  );
}
