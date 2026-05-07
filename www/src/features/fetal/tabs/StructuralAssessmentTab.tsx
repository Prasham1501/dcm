import { useEffect, useState } from 'react';
import { Save, Check, AlertCircle } from 'lucide-react';
import { BodyPartChecklist } from '@/features/fetal/components/BodyPartChecklist';
import { CHECKLISTS, type ChecklistKind } from '@/features/fetal/lib/anatomySchema';
import { useStructuralStore } from '@/features/fetal/stores/structuralStore';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useUIStore } from '@/stores/uiStore';

const SUB_TABS: { key: ChecklistKind; label: string }[] = [
  { key: 'body_part', label: 'Body Part' },
  { key: 'echo',      label: 'Fetal Echo' },
  { key: 'neuro',     label: 'Neurosonography' },
];

export function StructuralAssessmentTab() {
  const examination = useCurrentExamination();
  const examId = examination?.id ?? null;

  const loadForExamination = useStructuralStore((s) => s.loadForExamination);
  const save               = useStructuralStore((s) => s.save);
  const loading            = useStructuralStore((s) => s.loading);
  const saving             = useStructuralStore((s) => s.saving);
  const dirty              = useStructuralStore((s) => s.dirty);
  const error              = useStructuralStore((s) => s.error);

  const addToast = useUIStore((s) => s.addToast);
  const [subTab, setSubTab] = useState<ChecklistKind>('body_part');

  useEffect(() => {
    if (examId) {
      loadForExamination(examId).catch((e) =>
        addToast(`Failed to load structural data: ${(e as Error).message}`, 'error'),
      );
    }
  }, [examId, loadForExamination, addToast]);

  const handleSave = async () => {
    try {
      await save();
      addToast('Structural assessment saved', 'success');
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    }
  };

  if (!examId) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Select or create an examination to record structural assessment.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Sub-tab strip + save */}
      <div className="flex items-center justify-between mb-4">
        <nav className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded transition ${
                subTab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle size={12} /> Unsaved changes
            </span>
          )}
          {!dirty && !loading && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
      ) : (
        <BodyPartChecklist systems={CHECKLISTS[subTab]} />
      )}
    </div>
  );
}
