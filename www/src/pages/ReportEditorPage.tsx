/**
 * ReportEditorPage - Full-page rich text report editor.
 * Opens as a separate Electron popup window alongside the image viewer,
 * so doctors can view images on one screen and write reports on the other.
 * Reads launch data from localStorage key 'report-launch'.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReportStore, type SavedReport, type ReportTemplate } from '@/stores/reportStore';
import { useThemeStore } from '@/stores/themeStore';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Save,
  Printer,
  FileText,
  Trash2,
  Plus,
  Sun,
  Moon,
  X,
  ChevronLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { ReadingSet } from '@/lib/usgExtraction/types';
import { buildReportHtml } from '@/lib/usgExtraction/templates/buildReportHtml';

interface LaunchData {
  patientName: string;
  patientId: string;
  studyDate: string;
  timestamp: number;
}

const FONT_SIZES = [
  { label: '12px', value: '1' },
  { label: '14px', value: '2' },
  { label: '16px', value: '3' },
  { label: '18px', value: '4' },
  { label: '20px', value: '5' },
  { label: '22px', value: '6' },
  { label: '24px', value: '7' },
];

const TEXT_COLORS = [
  '#000000', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#2563eb', '#7c3aed', '#6b7280',
];

export function ReportEditorPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const launchChecked = useRef(false);

  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [studyDate, setStudyDate] = useState('');
  const [title, setTitle] = useState('');
  const [doctor, setDoctor] = useState('');
  const [status, setStatus] = useState<'draft' | 'final'>('draft');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTemplateNameInput, setShowTemplateNameInput] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [readingSet, setReadingSet] = useState<ReadingSet | null>(null);
  const [autoFillDone, setAutoFillDone] = useState(false);

  const { mode, toggleTheme } = useThemeStore();
  const {
    savedReports,
    templates,
    saveFullReport,
    getReportsForPatient,
    addRichTemplate,
    removeTemplate,
  } = useReportStore();

  // Load launch data from localStorage, then auto-load most recent report
  useEffect(() => {
    if (launchChecked.current) return;
    launchChecked.current = true;

    try {
      const raw = localStorage.getItem('report-launch');
      if (raw) {
        const data: LaunchData = JSON.parse(raw);
        if (Date.now() - data.timestamp < 30000) {
          const pid = data.patientId || '';
          setPatientName(data.patientName || '');
          setPatientId(pid);
          setStudyDate(data.studyDate || '');

          // Auto-load the most recent saved report for this patient
          if (pid) {
            const existing = useReportStore.getState().getReportsForPatient(pid);
            if (existing.length > 0) {
              const latest = [...existing].sort((a, b) => b.updatedAt - a.updatedAt)[0];
              setTimeout(() => {
                if (editorRef.current) {
                  editorRef.current.innerHTML = latest.content;
                }
                setTitle(latest.title);
                setDoctor(latest.doctor);
                setStatus(latest.status);
                setCurrentReportId(latest.id);
              }, 100); // wait for editor to mount
            }
          }
        }
        localStorage.removeItem('report-launch');
      }
    } catch {
      /* ignore parse errors */
    }
  }, []);

  // Load USG readings from localStorage bridge (written by viewerStore.runReadingsExtraction)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('usg-readings-latest');
      if (raw) {
        const rs: ReadingSet = JSON.parse(raw);
        // Only use if extracted within last 30 minutes and has readings
        if (rs.readings?.length > 0 && Date.now() - rs.extractedAt < 30 * 60 * 1000) {
          setReadingSet(rs);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!readingSet || !editorRef.current) return;
    const html = buildReportHtml(readingSet, studyDate);
    if (!html) return;
    // Insert at cursor or append
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
    } else {
      editorRef.current.innerHTML += html;
    }
    setAutoFillDone(true);
  }, [readingSet, studyDate]);

  const patientReports = patientId ? getReportsForPatient(patientId) : [];

  // Execute formatting command
  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }, []);

  // Save current report
  const handleSave = useCallback(() => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const id = currentReportId || undefined;

    saveFullReport({
      id: id,
      patientId,
      patientName,
      studyDate,
      content,
      title: title || 'Untitled Report',
      doctor,
      status,
    });

    if (!currentReportId) {
      // Find the newly created report
      const reports = getReportsForPatient(patientId);
      const newest = reports.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (newest) setCurrentReportId(newest.id);
    }

    setSaveMessage('Saved');
    setTimeout(() => setSaveMessage(''), 2000);
  }, [currentReportId, patientId, patientName, studyDate, title, doctor, status, saveFullReport, getReportsForPatient]);

  // Load a saved report into the editor
  const handleLoadReport = useCallback((report: SavedReport) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = report.content;
    setTitle(report.title);
    setDoctor(report.doctor);
    setStatus(report.status);
    setCurrentReportId(report.id);
  }, []);

  // Load a template into the editor
  const handleLoadTemplate = useCallback((template: ReportTemplate) => {
    if (!editorRef.current) return;
    if (template.content) {
      editorRef.current.innerHTML = template.content;
    } else {
      // Legacy template: compose from structured fields
      editorRef.current.innerHTML = `
        <h2>Findings</h2><p>${template.findings || ''}</p>
        <h2>Impression</h2><p>${template.impression || ''}</p>
        <h2>Recommendation</h2><p>${template.recommendation || ''}</p>
      `.trim();
    }
  }, []);

  // Save current content as template — shows inline input instead of prompt()
  const handleSaveTemplate = useCallback(() => {
    setTemplateNameInput('');
    setShowTemplateNameInput(true);
  }, []);

  const handleConfirmSaveTemplate = useCallback(() => {
    if (!editorRef.current || !templateNameInput.trim()) return;
    addRichTemplate({ name: templateNameInput.trim(), content: editorRef.current.innerHTML });
    setShowTemplateNameInput(false);
    setTemplateNameInput('');
  }, [addRichTemplate, templateNameInput]);

  // Print the report
  const handlePrint = useCallback(() => {
    if (!editorRef.current) return;
    const content = editorRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Report - ${title || 'Untitled'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #000; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
    .content { font-size: 13px; line-height: 1.7; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .status-final { background: #16a34a; color: white; }
    .status-draft { background: #eab308; color: black; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${title || 'Untitled Report'}</h1>
  <div class="meta">
    Patient: ${patientName} (${patientId}) | Study Date: ${studyDate}<br/>
    Doctor: ${doctor || 'N/A'} | Status: <span class="status status-${status}">${status.toUpperCase()}</span>
  </div>
  <div class="content">${content}</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [title, patientName, patientId, studyDate, doctor, status]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Detect popup vs inline
  const isPopup = typeof window !== 'undefined' && (window.opener != null || window.history.length <= 1);

  return (
    <div className="flex flex-col h-screen bg-app-bg text-app-text">
      {/* ===== HEADER BAR ===== */}
      <div className="flex items-center justify-between px-3 py-2 bg-app-header-bg border-b border-app-border shrink-0">
        <div className="flex items-center gap-4">
          {/* Close / Back button */}
          {isPopup ? (
            <button
              onClick={() => window.close()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
              title="Close report editor"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          ) : (
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
              title="Back to patients"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Patients
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-app-accent" />
            <span className="text-sm font-bold text-app-accent tracking-wide">Report Editor</span>
          </div>
          {patientName && (
            <div className="flex items-center gap-3 text-xs text-app-text/70">
              <span className="font-semibold text-app-text">{patientName}</span>
              <span>ID: {patientId}</span>
              <span>Study: {studyDate}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-xs text-green-500 font-semibold animate-pulse">{saveMessage}</span>
          )}

          {/* Status Toggle */}
          <button
            onClick={() => setStatus(s => s === 'draft' ? 'final' : 'draft')}
            className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
              status === 'final'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-yellow-500 text-black hover:bg-yellow-600'
            }`}
          >
            {status === 'draft' ? 'DRAFT' : 'FINAL'}
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-app-accent text-white rounded hover:bg-app-accent-hover transition-colors"
            title="Save report"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-app-border text-app-text rounded hover:bg-app-hover transition-colors"
            title="Print report"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-app-hover transition-colors"
            title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {mode === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-app-text" />}
          </button>
        </div>
      </div>

      {/* ===== FORMATTING TOOLBAR ===== */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 bg-app-surface border-b border-app-border shrink-0 flex-wrap">
        {/* Text Style */}
        <ToolbarButton onClick={() => exec('bold')} title="Bold (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italic (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Underline (Ctrl+U)"><Underline className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('strikethrough')} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarDivider />

        {/* Font Size */}
        <select
          onChange={(e) => exec('fontSize', e.target.value)}
          defaultValue="3"
          className="h-7 px-1 text-xs bg-app-bg border border-app-border rounded text-app-text cursor-pointer focus:outline-none focus:ring-1 focus:ring-app-accent"
          title="Font size"
        >
          {FONT_SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <ToolbarDivider />

        {/* Text Color */}
        <div className="relative">
          <ToolbarButton
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Text color"
          >
            <div className="w-3.5 h-3.5 rounded border border-app-border" style={{ background: 'linear-gradient(135deg, #dc2626, #2563eb, #16a34a)' }} />
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-1.5 bg-app-surface border border-app-border rounded shadow-lg z-50 flex gap-1">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { exec('foreColor', color); setShowColorPicker(false); }}
                  className="w-5 h-5 rounded border border-app-border hover:scale-125 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>

        <ToolbarDivider />

        {/* Headers */}
        <ToolbarButton onClick={() => exec('formatBlock', 'h1')} title="Heading 1">
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('formatBlock', 'h2')} title="Heading 2">
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('formatBlock', 'h3')} title="Heading 3">
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('justifyRight')} title="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton onClick={() => exec('undo')} title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec('redo')} title="Redo (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarDivider />

        {/* Clear formatting */}
        <ToolbarButton onClick={() => exec('removeFormat')} title="Clear formatting">
          <span className="text-xs">Clear</span>
        </ToolbarButton>

        {readingSet && (
          <>
            <ToolbarDivider />
            <button
              onClick={handleAutoFill}
              disabled={autoFillDone}
              title={
                autoFillDone
                  ? 'Readings already inserted — edit directly in the report'
                  : `Auto-fill measurements from images (source: ${readingSet.source})`
              }
              className={`flex items-center gap-1 px-2.5 h-7 text-xs font-semibold rounded transition-colors border ${
                autoFillDone
                  ? 'border-green-500/40 text-green-600 bg-green-50 dark:bg-green-900/20 cursor-default opacity-70'
                  : 'border-app-accent text-app-accent hover:bg-app-accent hover:text-white'
              }`}
            >
              {autoFillDone
                ? <><Sparkles className="w-3.5 h-3.5" /> Inserted</>
                : <><Sparkles className="w-3.5 h-3.5" /> Auto-fill from images</>
              }
            </button>
            <span className="text-xs text-app-text/40 ml-1">
              {readingSet.readings.length} reading{readingSet.readings.length !== 1 ? 's' : ''} · {readingSet.source}
            </span>
          </>
        )}
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col overflow-auto bg-neutral-200 dark:bg-neutral-800 p-6">
          {/* Title and Doctor fields */}
          <div className="max-w-[850px] w-full mx-auto mb-3 flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Report title..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded shadow-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
            <input
              type="text"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              placeholder="Doctor name..."
              className="w-56 px-3 py-2 text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 rounded shadow-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-app-accent"
            />
          </div>

          {/* The Editor (document page style) */}
          <div className="max-w-[850px] w-full mx-auto flex-1">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="min-h-[700px] bg-white text-neutral-900 p-10 rounded shadow-lg border border-neutral-300 focus:outline-none text-sm leading-relaxed"
              style={{
                fontFamily: "'Times New Roman', 'Georgia', serif",
                fontSize: '14px',
                lineHeight: '1.8',
              }}
              data-placeholder="Start typing your report..."
              onFocus={(e) => {
                if (e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
                  e.currentTarget.classList.remove('empty-editor');
                }
              }}
            />
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="w-64 bg-app-surface border-l border-app-border flex flex-col overflow-hidden shrink-0">
          {/* Templates Section */}
          <div className="flex-1 overflow-auto border-b border-app-border">
            <div className="flex items-center justify-between px-3 py-2 bg-app-header-bg border-b border-app-border">
              <span className="text-xs font-bold text-app-text uppercase tracking-wide">Templates</span>
              <button
                onClick={handleSaveTemplate}
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-app-accent text-white rounded hover:bg-app-accent-hover transition-colors"
                title="Save current content as template"
              >
                <Plus className="w-3 h-3" />
                Save as Template
              </button>
            </div>
            {/* Inline template name input — replaces prompt() */}
            {showTemplateNameInput && (
              <div className="px-3 py-2 bg-app-surface border-b border-app-border flex flex-col gap-1.5">
                <span className="text-[10px] text-app-text-secondary">Template name:</span>
                <input
                  type="text"
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSaveTemplate();
                    if (e.key === 'Escape') setShowTemplateNameInput(false);
                  }}
                  placeholder="e.g. OB Normal"
                  autoFocus
                  className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded text-app-text focus:outline-none focus:ring-1 focus:ring-app-accent"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleConfirmSaveTemplate}
                    disabled={!templateNameInput.trim()}
                    className="flex-1 px-2 py-0.5 text-[10px] font-semibold bg-app-accent text-white rounded hover:bg-app-accent-hover disabled:opacity-40 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowTemplateNameInput(false)}
                    className="px-2 py-0.5 text-[10px] border border-app-border rounded text-app-text hover:bg-app-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="p-2 space-y-1.5">
              {templates.length === 0 && (
                <p className="text-xs text-app-text/50 text-center py-4">No templates saved yet</p>
              )}
              {templates.map((tpl) => (
                <div key={tpl.id} className="p-2 bg-app-bg rounded border border-app-border hover:border-app-accent/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-app-text truncate flex-1" title={tpl.name}>{tpl.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleLoadTemplate(tpl)}
                      className="flex-1 px-2 py-0.5 text-[10px] font-semibold bg-app-accent/10 text-app-accent border border-app-accent/30 rounded hover:bg-app-accent hover:text-white transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => removeTemplate(tpl.id)}
                      className="px-1.5 py-0.5 text-[10px] text-red-500 border border-red-300 dark:border-red-800 rounded hover:bg-red-500 hover:text-white transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Reports Section */}
          <div className="flex-1 overflow-auto">
            <div className="px-3 py-2 bg-app-header-bg border-b border-app-border">
              <span className="text-xs font-bold text-app-text uppercase tracking-wide">Saved Reports</span>
              {patientId && (
                <span className="text-[10px] text-app-text/50 ml-1">({patientReports.length})</span>
              )}
            </div>
            <div className="p-2 space-y-1.5">
              {!patientId && (
                <p className="text-xs text-app-text/50 text-center py-4">No patient loaded</p>
              )}
              {patientId && patientReports.length === 0 && (
                <p className="text-xs text-app-text/50 text-center py-4">No saved reports for this patient</p>
              )}
              {patientReports
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((report) => (
                <div
                  key={report.id}
                  className={`p-2 rounded border transition-colors ${
                    currentReportId === report.id
                      ? 'bg-app-accent/10 border-app-accent'
                      : 'bg-app-bg border-app-border hover:border-app-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-app-text truncate flex-1" title={report.title}>
                      {report.title}
                    </span>
                    <span className={`ml-1 px-1.5 py-0.5 text-[9px] font-bold rounded ${
                      report.status === 'final'
                        ? 'bg-green-600 text-white'
                        : 'bg-yellow-500 text-black'
                    }`}>
                      {report.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-app-text/50 mb-1.5">
                    {formatDate(report.updatedAt)}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleLoadReport(report)}
                      className="flex-1 px-2 py-0.5 text-[10px] font-semibold bg-app-accent/10 text-app-accent border border-app-accent/30 rounded hover:bg-app-accent hover:text-white transition-colors"
                    >
                      Load
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder CSS for empty editor */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          font-style: italic;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

/* ===== Sub-components ===== */

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded text-app-text hover:bg-app-hover hover:text-app-accent transition-colors"
      onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-app-border mx-0.5" />;
}

export default ReportEditorPage;
