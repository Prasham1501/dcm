/**
 * TemplatePickerModal — full-screen modal version of the template & placeholder
 * picker. Two panes side-by-side: templates on the left (with live preview)
 * and grouped placeholder catalog on the right.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, FileText, Sparkles, Loader2, Search, Pencil, Save, FilePlus } from 'lucide-react';
import { templatesApi, type TemplateSummary } from '@/features/fetal/api/templatesApi';
import { useReportComposerStore } from '@/features/fetal/stores/reportComposerStore';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useUIStore } from '@/stores/uiStore';
import {
  groupedPlaceholders, resolvePlaceholders, type PlaceholderContext,
} from '@/features/fetal/lib/placeholders';
import { RichTextEditor } from '@/features/fetal/components/RichTextEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  context: PlaceholderContext | null;
}

type Tab = 'templates' | 'placeholders';

export function TemplatePickerModal({ open, onClose, context }: Props) {
  const examination = useCurrentExamination();
  const addToast = useUIStore((s) => s.addToast);
  const setContent  = useReportComposerStore((s) => s.setContent);
  const currentBody = useReportComposerStore((s) => s.contentBody);

  const [tab, setTab]            = useState<Tab>('templates');
  const [list, setList]          = useState<TemplateSummary[]>([]);
  const [loading, setLoading]    = useState(false);
  const [chosenId, setChosenId]  = useState<number | null>(null);
  const [rawBody, setRawBody]    = useState<string>('');     // unresolved template body (editable)
  const [preview, setPreview]    = useState<string>('');     // resolved for the preview pane
  const [previewBusy, setPreviewBusy] = useState(false);
  const [filterAll, setFilterAll]     = useState(false);
  const [phQuery, setPhQuery]         = useState('');
  const [editing, setEditing]         = useState(false);     // edit mode toggle
  const [savingTpl, setSavingTpl]     = useState(false);
  const [chosenName, setChosenName]   = useState<string>('');

  // Reload list whenever modal opens or exam_type filter changes
  useEffect(() => {
    if (!open || !examination) return;
    setLoading(true);
    templatesApi.list(filterAll ? undefined : examination.exam_type)
      .then((rows) => setList(rows))
      .catch((e) => addToast(`Could not load templates: ${(e as Error).message}`, 'error'))
      .finally(() => setLoading(false));
  }, [open, filterAll, examination?.exam_type, addToast]); // eslint-disable-line

  // Load both raw body (for editing) and resolved preview when selection changes.
  useEffect(() => {
    if (!chosenId) { setRawBody(''); setPreview(''); setEditing(false); setChosenName(''); return; }
    setPreviewBusy(true);
    templatesApi.get(chosenId)
      .then((t) => {
        setRawBody(t.body || '');
        setChosenName(t.template_name);
        setPreview(context ? resolvePlaceholders(t.body || '', context) : (t.body || ''));
      })
      .catch((e) => addToast(`Load failed: ${(e as Error).message}`, 'error'))
      .finally(() => setPreviewBusy(false));
  }, [chosenId, context, addToast]);

  // Live re-resolve the preview when the user edits the raw body in-place.
  useEffect(() => {
    if (!context) return;
    setPreview(resolvePlaceholders(rawBody, context));
  }, [rawBody, context]);

  const placeholderGroups = useMemo(() => groupedPlaceholders(), []);

  if (!open) return null;

  const handleApply = (replaceExisting: boolean) => {
    if (!preview) return;
    const next = replaceExisting ? preview : (currentBody ? currentBody + preview : preview);
    setContent(next);
    onClose();
    addToast('Template applied to Report Content', 'success');
  };

  const handleSaveTemplate = async () => {
    if (!chosenId) return;
    const chosen = list.find((t) => t.id === chosenId);
    if (!chosen) return;
    setSavingTpl(true);
    try {
      await templatesApi.save({
        template_key:  chosen.template_key,            // same key → upserts
        template_name: chosenName || chosen.template_name,
        exam_type:     chosen.exam_type ?? undefined,
        body:          rawBody,
      });
      addToast('Template updated', 'success');
      setEditing(false);
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const handleSaveAsNew = async () => {
    const name = prompt('New template name:', `${chosenName || 'Untitled'} (copy)`);
    if (!name) return;
    const key = `fetal_custom_${Date.now()}`;
    setSavingTpl(true);
    try {
      const newId = await templatesApi.save({
        template_key:  key,
        template_name: name,
        exam_type:     examination?.exam_type,
        body:          rawBody,
      });
      const refreshed = await templatesApi.list(filterAll ? undefined : examination?.exam_type);
      setList(refreshed);
      setChosenId(newId);
      setChosenName(name);
      addToast(`Saved as "${name}"`, 'success');
      setEditing(false);
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const insertPlaceholder = (token: string) => {
    const insert = `{{${token}}}`;
    const next = currentBody ? `${currentBody} ${insert}` : insert;
    setContent(next);
    addToast(`Inserted ${insert}`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <h2 className="text-base font-semibold">Templates &amp; Placeholders</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab('templates')}
              className={`px-3 py-1.5 text-xs font-medium rounded ${tab === 'templates' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Templates ({list.length})
            </button>
            <button
              onClick={() => setTab('placeholders')}
              className={`px-3 py-1.5 text-xs font-medium rounded ${tab === 'placeholders' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Placeholders
            </button>
            <button onClick={onClose} className="p-1 ml-2 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        {tab === 'templates' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Template list */}
            <aside className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={filterAll} onChange={(e) => setFilterAll(e.target.checked)} />
                  Show all (ignore exam type)
                </label>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 p-4"><Loader2 size={11} className="animate-spin" /> Loading…</div>
                ) : list.length === 0 ? (
                  <div className="text-xs text-slate-400 italic p-4">No templates.</div>
                ) : (
                  list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setChosenId(t.id)}
                      className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${chosenId === t.id ? 'bg-blue-100/60 dark:bg-blue-900/30' : ''}`}
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.template_name}</div>
                      {t.exam_type && (
                        <div className="text-[10px] font-mono uppercase text-slate-400 mt-0.5">{t.exam_type}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* Preview / edit pane */}
            <section className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2 min-w-0">
                  {editing ? (
                    <input
                      value={chosenName}
                      onChange={(e) => setChosenName(e.target.value)}
                      placeholder="Template name"
                      className="px-2 py-0.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{chosenName || 'No template'}</span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {editing ? '· editing template' : '· preview with placeholders resolved'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {previewBusy && <Loader2 size={12} className="animate-spin text-slate-400" />}
                  {chosenId != null && (
                    <button
                      onClick={() => setEditing((v) => !v)}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editing ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    >
                      <Pencil size={11} /> {editing ? 'Done' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {chosenId == null ? (
                  <div className="text-sm text-slate-400 italic">Select a template to preview it here.</div>
                ) : editing ? (
                  <RichTextEditor
                    value={rawBody}
                    onChange={setRawBody}
                    minHeight={320}
                    ariaLabel="Template body"
                    placeholder="Edit the template body. Use the Placeholders tab to insert tokens like {{patient_name}}."
                  />
                ) : preview ? (
                  <div
                    className="prose prose-sm max-w-none text-sm text-slate-700 dark:text-slate-200 dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: preview }}
                  />
                ) : (
                  <div className="text-sm text-slate-400">Loading preview…</div>
                )}
              </div>

              <footer className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-2 bg-slate-50 dark:bg-slate-900/40 flex-wrap">
                {/* Left: template management actions */}
                <div className="flex items-center gap-2">
                  {editing && chosenId != null && (
                    <>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={savingTpl || !rawBody.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded"
                      >
                        {savingTpl ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Save template
                      </button>
                      <button
                        onClick={handleSaveAsNew}
                        disabled={savingTpl || !rawBody.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-800 dark:text-slate-200 rounded"
                      >
                        <FilePlus size={11} /> Save as new
                      </button>
                    </>
                  )}
                </div>

                {/* Right: insert into report */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApply(false)}
                    disabled={!preview}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 text-slate-800 dark:text-slate-200 rounded"
                  >
                    Append to content
                  </button>
                  <button
                    onClick={() => handleApply(true)}
                    disabled={!preview}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded"
                  >
                    <Sparkles size={12} /> Replace content
                  </button>
                </div>
              </footer>
            </section>
          </div>
        ) : (
          // ── Placeholders tab ───────────────────────────────────────────
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 relative">
              <Search size={12} className="absolute left-6 top-3.5 text-slate-400" />
              <input
                type="text"
                value={phQuery}
                onChange={(e) => setPhQuery(e.target.value)}
                placeholder="Filter placeholders…"
                className="w-full pl-7 pr-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(placeholderGroups).map(([group, defs]) => {
                const filtered = defs.filter((p) =>
                  phQuery === '' ||
                  p.token.includes(phQuery.toLowerCase()) ||
                  p.label.toLowerCase().includes(phQuery.toLowerCase()),
                );
                if (filtered.length === 0) return null;
                return (
                  <section key={group} className="mb-4">
                    <h3 className="text-[10px] uppercase font-bold tracking-wide text-slate-400 mb-1.5">{group}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {filtered.map((p) => {
                        const resolved = context ? p.resolve(context) : '';
                        return (
                          <button
                            key={p.token}
                            onClick={() => insertPlaceholder(p.token)}
                            className="text-left px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-blue-600">{`{{${p.token}}}`}</span>
                              <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{p.label}</span>
                            </div>
                            {resolved && resolved !== '—' && (
                              <div className="text-[10px] text-slate-500 mt-0.5 truncate">→ {resolved}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
