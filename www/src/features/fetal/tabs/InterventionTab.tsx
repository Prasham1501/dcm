/**
 * InterventionTab — log of fetal procedures + counselling notes.
 *
 *   Top section: list of procedures (CVS, amniocentesis, intra-uterine
 *   transfusion, fetal MRI, etc.) with date, operator, indication,
 *   findings, complications, outcome. Each row inline-editable; per-row
 *   "include in report" toggle.
 *
 *   Bottom section: free-text counselling notes (RichTextEditor).
 *   Autosaves 1.5s after editing stops.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, Loader2, Save } from 'lucide-react';
import { useInterventionStore } from '@/features/fetal/stores/interventionStore';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useUIStore } from '@/stores/uiStore';
import { RichTextEditor } from '@/features/fetal/components/RichTextEditor';
import type { InterventionProcedure } from '@/features/fetal/api/interventionsApi';

const PROCEDURE_TYPES = [
  'Chorionic Villus Sampling',
  'Amniocentesis',
  'Cordocentesis',
  'Intra-uterine Transfusion',
  'Fetal Shunt Insertion',
  'Selective Laser Ablation (TTTS)',
  'Cervical Cerclage',
  'Fetal MRI',
  'Genetic Counselling',
  'Other',
];

export function InterventionTab() {
  const examination = useCurrentExamination();
  const examId = examination?.id ?? null;
  const addToast = useUIStore((s) => s.addToast);

  const procedures      = useInterventionStore((s) => s.procedures);
  const counselling     = useInterventionStore((s) => s.counselling);
  const loadForExam     = useInterventionStore((s) => s.loadForExamination);
  const addProcedure    = useInterventionStore((s) => s.addProcedure);
  const updateProcedure = useInterventionStore((s) => s.updateProcedure);
  const removeProcedure = useInterventionStore((s) => s.removeProcedure);
  const setCounselling  = useInterventionStore((s) => s.setCounselling);
  const saveCounselling = useInterventionStore((s) => s.saveCounselling);
  const saving          = useInterventionStore((s) => s.saving);
  const loading         = useInterventionStore((s) => s.loading);
  const error           = useInterventionStore((s) => s.error);

  const [adding, setAdding] = useState(false);

  // Load on mount / exam change
  useEffect(() => {
    if (examId) loadForExam(examId).catch((e) => addToast(`Load failed: ${(e as Error).message}`, 'error'));
  }, [examId, loadForExam, addToast]);

  // Debounced counselling autosave
  useEffect(() => {
    if (!examId) return;
    const t = setTimeout(() => { void saveCounselling(); }, 1500);
    return () => clearTimeout(t);
  }, [counselling, examId, saveCounselling]);

  if (!examId) {
    return <div className="p-6 text-sm text-slate-500">Select or create an examination to log interventions.</div>;
  }

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addProcedure({
        procedure_type: PROCEDURE_TYPES[0],
        procedure_date: new Date().toISOString().slice(0, 10),
      });
      addToast('Procedure added', 'success');
    } catch (e) {
      addToast(`Add failed: ${(e as Error).message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, type: string) => {
    if (!confirm(`Delete "${type}"?`)) return;
    try {
      await removeProcedure(id);
      addToast('Procedure deleted', 'success');
    } catch (e) {
      addToast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {error && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
          {error}
        </div>
      )}

      {/* ── Procedures ─────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <header className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-purple-500" />
            <span className="text-sm font-semibold">Procedures &amp; Interventions</span>
            <span className="text-[11px] text-slate-500">({procedures.length})</span>
            {saving && <Loader2 size={11} className="animate-spin text-slate-400 ml-1" />}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Add procedure
          </button>
        </header>

        {loading ? (
          <div className="p-6 text-xs text-slate-500 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </div>
        ) : procedures.length === 0 ? (
          <div className="p-6 text-xs text-slate-400 italic">No procedures logged for this examination yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {procedures.map((p) => (
              <ProcedureRow
                key={p.id}
                row={p}
                onPatch={(patch) => { if (p.id) return updateProcedure(p.id, patch); }}
                onDelete={() => { if (p.id) handleDelete(p.id, p.procedure_type); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Counselling notes ──────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <header className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Counselling Notes</span>
            <span className="text-[11px] text-slate-500">Autosaved 1.5s after editing</span>
          </div>
          <button
            onClick={() => saveCounselling()}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-800 dark:text-slate-200 rounded"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save now
          </button>
        </header>
        <div className="p-4">
          <RichTextEditor
            value={counselling}
            onChange={setCounselling}
            placeholder="Counselling discussion: information shared, questions answered, decisions made, follow-up plan…"
            minHeight={180}
            ariaLabel="Counselling notes"
          />
        </div>
      </section>
    </div>
  );
}

// ── Individual procedure row (inline editing) ─────────────────────

function ProcedureRow({
  row, onPatch, onDelete,
}: {
  row: InterventionProcedure;
  onPatch: (patch: Partial<InterventionProcedure>) => Promise<void> | void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState(row);

  // Re-sync when an external refresh comes in (after a save).
  useEffect(() => { setLocal(row); }, [row.id, row.updated_at]); // eslint-disable-line

  const patch = (k: keyof InterventionProcedure, v: string | number | null) => {
    setLocal({ ...local, [k]: v } as InterventionProcedure);
  };

  // Flush on blur — single round-trip per field edit.
  const flush = (k: keyof InterventionProcedure) => {
    if ((row as any)[k] === (local as any)[k]) return;
    void onPatch({ [k]: (local as any)[k] });
  };

  return (
    <div className="p-4 space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Field label="Procedure">
          <select
            value={local.procedure_type}
            onChange={(e) => { patch('procedure_type', e.target.value); void onPatch({ procedure_type: e.target.value }); }}
            className={inputCls}
          >
            {PROCEDURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            {/* Allow free text if the saved type isn't in our preset list */}
            {!PROCEDURE_TYPES.includes(local.procedure_type) && <option value={local.procedure_type}>{local.procedure_type}</option>}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={local.procedure_date ?? ''}
            onChange={(e) => patch('procedure_date', e.target.value || null)}
            onBlur={() => flush('procedure_date')}
            className={inputCls}
          />
        </Field>
        <Field label="Operator">
          <input
            type="text"
            value={local.operator ?? ''}
            onChange={(e) => patch('operator', e.target.value || null)}
            onBlur={() => flush('operator')}
            placeholder="Operator / Dr."
            className={inputCls}
          />
        </Field>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 flex-1">
            <input
              type="checkbox"
              checked={!!local.include_in_report}
              onChange={(e) => { patch('include_in_report', e.target.checked ? 1 : 0); void onPatch({ include_in_report: e.target.checked ? 1 : 0 }); }}
            />
            Include in report
          </label>
          <button
            onClick={onDelete}
            title="Delete procedure"
            className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Field label="Indication">
          <textarea
            rows={2}
            value={local.indication ?? ''}
            onChange={(e) => patch('indication', e.target.value || null)}
            onBlur={() => flush('indication')}
            placeholder="Why was the procedure performed?"
            className={inputCls + ' resize-y'}
          />
        </Field>
        <Field label="Findings">
          <textarea
            rows={2}
            value={local.findings ?? ''}
            onChange={(e) => patch('findings', e.target.value || null)}
            onBlur={() => flush('findings')}
            placeholder="What did the procedure show?"
            className={inputCls + ' resize-y'}
          />
        </Field>
        <Field label="Complications">
          <textarea
            rows={2}
            value={local.complications ?? ''}
            onChange={(e) => patch('complications', e.target.value || null)}
            onBlur={() => flush('complications')}
            placeholder="Any complications, none if nil."
            className={inputCls + ' resize-y'}
          />
        </Field>
        <Field label="Outcome / Plan">
          <textarea
            rows={2}
            value={local.outcome ?? ''}
            onChange={(e) => patch('outcome', e.target.value || null)}
            onBlur={() => flush('outcome')}
            placeholder="Outcome and next steps."
            className={inputCls + ' resize-y'}
          />
        </Field>
      </div>
    </div>
  );
}

const inputCls = "w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase font-medium tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
