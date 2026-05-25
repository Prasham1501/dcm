/**
 * TemplatePickerModal — second step of the report-router picker. After the
 * operator chose a report type (Fetal Medicine / General Radiology / …)
 * this modal lists their saved templates for that type plus a "Blank
 * report" option. Picking either calls onPick, which stores the chosen
 * template id in reportStore.pendingTemplateId and continues with the
 * type's `openCreate` flow — the inline editor reads the pending template
 * on mount and pre-fills.
 *
 * Tagged templates (template.type === selectedTypeId) appear first; legacy
 * untagged templates show up under every type for back-compat.
 */
import { X, FilePlus, FileText, ChevronLeft, Trash2 } from 'lucide-react';
import type { ReportTemplate } from '@/stores/reportStore';
import { useReportStore } from '@/stores/reportStore';

interface Props {
  typeId: string;
  typeName: string;
  patientName: string;
  onPick: (templateId: string | null) => void;   // null = blank report
  onBack: () => void;
  onClose: () => void;
}

export function TemplatePickerModal({ typeId, typeName, patientName, onPick, onBack, onClose }: Props) {
  const templates = useReportStore((s) => s.templates);
  const removeTemplate = useReportStore((s) => s.removeTemplate);

  // Tagged templates first, then untagged (back-compat with templates created
  // before the type field existed — they show under every type).
  const visible: ReportTemplate[] = templates
    .filter((t) => !t.type || t.type === typeId)
    .sort((a, b) => {
      if (!!a.type === !!b.type) return b.createdAt - a.createdAt;
      return a.type ? -1 : 1;
    });

  const confirmDelete = (e: React.MouseEvent, t: ReportTemplate) => {
    e.stopPropagation();
    if (confirm(`Delete template "${t.name}"? This cannot be undone.`)) {
      removeTemplate(t.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[480px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-2 min-w-0">
            <button
              onClick={onBack}
              className="p-1 -ml-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 mt-0.5"
              title="Back to report types"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">Choose template</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {typeName} report for <b>{patientName || 'this patient'}</b>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 max-h-[400px] overflow-y-auto">
          <ul className="space-y-1.5">
            {/* Blank option — always first */}
            <li>
              <button
                onClick={() => onPick(null)}
                className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-lg grid place-items-center bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <FilePlus size={20} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-sm text-slate-800 dark:text-slate-100">Blank report</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Start with an empty editor</span>
                </span>
              </button>
            </li>

            {visible.length === 0 ? (
              <li className="px-3 py-4 text-xs text-center text-slate-500 dark:text-slate-400">
                No saved templates yet for {typeName}.<br />
                Save one from the report editor to see it here.
              </li>
            ) : (
              visible.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onPick(t.id)}
                    className="group w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                  >
                    <span className="flex-shrink-0 w-10 h-10 rounded-lg grid place-items-center bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <FileText size={20} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{t.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {t.type ? `Tagged ${t.type}` : 'Available everywhere'}
                        {' · '}
                        Saved {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span
                      onClick={(e) => confirmDelete(e, t)}
                      role="button"
                      className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-red-100 text-red-500 dark:hover:bg-red-900/30"
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 rounded-b-xl">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tip: build a template inside the editor, then save it so it appears here next time.
          </p>
        </div>
      </div>
    </div>
  );
}
