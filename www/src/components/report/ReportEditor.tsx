import { useState, useEffect } from 'react';
import { useReportStore, type ReportTemplate } from '@/stores/reportStore';
import { FileText, X, Copy, Check, Save, Printer, Plus, Trash2, ChevronDown } from 'lucide-react';

export function ReportEditor() {
  const {
    showReportEditor,
    editingPatientId,
    editingPatientName,
    closeReportEditor,
    getReport,
    saveReport,
    printReport,
    templates,
    addTemplate,
    removeTemplate,
  } = useReportStore();

  const [title, setTitle] = useState('Radiology Report');
  const [doctor, setDoctor] = useState('');
  const [status, setStatus] = useState<'draft' | 'final'>('draft');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [date, setDate] = useState('');

  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Load existing report when opening
  useEffect(() => {
    if (showReportEditor && editingPatientId) {
      const existing = getReport(editingPatientId);
      if (existing) {
        setTitle(existing.title || 'Radiology Report');
        setDoctor(existing.doctor || '');
        setStatus((existing.status === 'final' ? 'final' : 'draft') as 'draft' | 'final');
        setFindings(existing.findings || '');
        setImpression(existing.impression || '');
        setRecommendation(existing.recommendation || '');
        setDate(existing.date || new Date().toLocaleDateString());
      } else {
        setTitle('Radiology Report');
        setDoctor('');
        setStatus('draft');
        setFindings('');
        setImpression('');
        setRecommendation('');
        setDate(new Date().toLocaleDateString());
      }
    }
  }, [showReportEditor, editingPatientId, getReport]);

  if (!showReportEditor) return null;

  const handleCopyPatientInfo = async () => {
    const text = `Patient: ${editingPatientName}\nID: ${editingPatientId}\nDate: ${date}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleSave = () => {
    if (!editingPatientId) return;
    saveReport(editingPatientId, {
      title,
      doctor,
      status,
      findings,
      impression,
      recommendation,
      date: date || new Date().toLocaleDateString(),
    });
  };

  const handlePrint = () => {
    if (!editingPatientId) return;
    handleSave();
    printReport(editingPatientId);
  };

  const handleLoadTemplate = (template: ReportTemplate) => {
    setFindings(template.findings);
    setImpression(template.impression);
    setRecommendation(template.recommendation);
    setShowTemplates(false);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    addTemplate({
      name: templateName.trim(),
      findings,
      impression,
      recommendation,
    });
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-app-bg border border-app-border rounded-lg shadow-2xl flex flex-col"
        style={{ width: '720px', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-app-header-bg border-b border-app-border rounded-t-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-app-accent" />
            <span className="font-semibold text-app-text text-sm">Report Editor</span>
            <span className="text-xs text-app-text-secondary">&mdash; {editingPatientName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Copy patient info */}
            <button
              onClick={handleCopyPatientInfo}
              className="p-1.5 rounded hover:bg-app-hover text-app-text-secondary transition-colors"
              title="Copy patient info"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Templates dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-app-surface hover:bg-app-hover text-app-text border border-app-border transition-colors"
              >
                Templates <ChevronDown className="w-3 h-3" />
              </button>
              {showTemplates && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowTemplates(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-app-surface border border-app-border rounded-lg shadow-xl min-w-[200px] max-h-[200px] overflow-y-auto">
                    {templates.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-app-text-muted">
                        No templates saved
                      </div>
                    ) : (
                      templates.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-app-hover group"
                        >
                          <button
                            onClick={() => handleLoadTemplate(t)}
                            className="text-xs text-app-text truncate flex-1 text-left"
                          >
                            {t.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTemplate(t.id);
                            }}
                            className="p-0.5 rounded hover:bg-red-500/20 text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Save as template */}
            <div className="relative">
              <button
                onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-app-accent hover:bg-app-accent-hover text-white transition-colors"
                title="Save as template"
              >
                <Plus className="w-3 h-3" /> Save Template
              </button>
              {showSaveTemplate && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSaveTemplate(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-3 min-w-[220px]">
                    <div className="text-xs font-semibold text-app-text mb-2">
                      Template Name
                    </div>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                      className="w-full px-2 py-1 text-xs bg-app-bg border border-app-border rounded text-app-text mb-2"
                      placeholder="e.g. Chest X-Ray Normal"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTemplate}
                      className="w-full px-2 py-1 rounded text-xs bg-app-accent hover:bg-app-accent-hover text-white transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Close */}
            <button
              onClick={closeReportEditor}
              className="p-1.5 rounded hover:bg-app-hover text-app-text-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Row: Title + Doctor + Status + Date */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
                Doctor
              </label>
              <input
                type="text"
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text"
                placeholder="Dr. Name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'final')}
                className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text"
              >
                <option value="draft">Draft</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text"
              />
            </div>
          </div>

          {/* Findings */}
          <div>
            <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
              Findings
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={5}
              className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text resize-y leading-relaxed"
              placeholder="Enter findings..."
            />
          </div>

          {/* Impression */}
          <div>
            <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
              Impression
            </label>
            <textarea
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text resize-y leading-relaxed"
              placeholder="Enter impression..."
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-1">
              Recommendation
            </label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text resize-y leading-relaxed"
              placeholder="Enter recommendation..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-app-border">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold bg-app-accent hover:bg-app-accent-hover text-white transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> Save Report
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold bg-app-surface hover:bg-app-hover text-app-text border border-app-border transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
