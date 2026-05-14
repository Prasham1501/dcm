/**
 * Aneuploidy Risk Modal — first-trimester combined screening (T21/T18/T13).
 * Math lives in lib/fmfRisk.ts; this component is just the form + the
 * result table.
 */
import { useEffect, useState } from 'react';
import { X, Calculator, Save, Loader2, Trash2 } from 'lucide-react';
import {
  combinedAneuploidyRisk, formatRisk, categoryColor, categoryLabel,
  type AneuploidyInputs, type AneuploidyResult,
} from '@/features/fetal/lib/fmfRisk';
import { useRiskStore } from '@/features/fetal/stores/riskStore';
import { useUIStore } from '@/stores/uiStore';

interface Props { open: boolean; onClose: () => void; }

type FormState = {
  maternalAge:    string;   // we keep them as strings while editing, parse on calc
  ntMoM:          string;
  nasalBone:      'present' | 'absent' | 'unknown';
  ductusVenosus:  'normal'  | 'reversed' | 'unknown';
  tricuspid:      'normal'  | 'regurg'   | 'unknown';
  majorMalformations: boolean;
};

const DEFAULT_FORM: FormState = {
  maternalAge: '', ntMoM: '',
  nasalBone: 'unknown', ductusVenosus: 'unknown', tricuspid: 'unknown',
  majorMalformations: false,
};

export function AneuploidyRiskModal({ open, onClose }: Props) {
  const stored = useRiskStore((s) => s.rows.aneuploidy);
  const save = useRiskStore((s) => s.save);
  const remove = useRiskStore((s) => s.remove);
  const saving = useRiskStore((s) => s.saving);
  const addToast = useUIStore((s) => s.addToast);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<AneuploidyResult | null>(null);

  // Re-hydrate when modal opens
  useEffect(() => {
    if (!open) return;
    if (stored?.inputs) {
      const inp = stored.inputs as AneuploidyInputs;
      setForm({
        maternalAge:         String(inp.maternalAge ?? ''),
        ntMoM:               String(inp.ntMoM ?? ''),
        nasalBone:           inp.nasalBone     ?? 'unknown',
        ductusVenosus:       inp.ductusVenosus ?? 'unknown',
        tricuspid:           inp.tricuspid     ?? 'unknown',
        majorMalformations:  !!inp.majorMalformations,
      });
      setResult(stored.results as AneuploidyResult);
    } else {
      setForm(DEFAULT_FORM);
      setResult(null);
    }
  }, [open, stored]);

  if (!open) return null;

  const toInputs = (): AneuploidyInputs => ({
    maternalAge:        parseFloat(form.maternalAge),
    ntMoM:              form.ntMoM ? parseFloat(form.ntMoM) : undefined,
    nasalBone:          form.nasalBone,
    ductusVenosus:      form.ductusVenosus,
    tricuspid:          form.tricuspid,
    majorMalformations: form.majorMalformations,
  });

  const handleCalculate = () => {
    if (!form.maternalAge || isNaN(parseFloat(form.maternalAge))) {
      addToast('Maternal age is required', 'error');
      return;
    }
    setResult(combinedAneuploidyRisk(toInputs()));
  };

  const handleSave = async () => {
    if (!result) handleCalculate();
    const res = result ?? combinedAneuploidyRisk(toInputs());
    try {
      await save('aneuploidy', toInputs(), res, true);
      addToast('Aneuploidy risk saved', 'success');
      onClose();
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    }
  };

  const handleClear = async () => {
    if (!stored) { setForm(DEFAULT_FORM); setResult(null); return; }
    if (!confirm('Remove the saved aneuploidy risk result?')) return;
    await remove('aneuploidy');
    setForm(DEFAULT_FORM); setResult(null);
    addToast('Result removed', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-rose-500" />
            <h2 className="text-base font-semibold">Aneuploidy Risk Calculator (T21 · T18 · T13)</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </header>

        <div className="p-5 grid grid-cols-2 gap-4">
          <Field label="Maternal age (years)" required>
            <input
              type="number" min={15} max={55} step="0.1"
              value={form.maternalAge}
              onChange={(e) => setForm({ ...form, maternalAge: e.target.value })}
              className={inputCls}
              placeholder="e.g. 32"
            />
          </Field>

          <Field label="NT MoM" hint="Multiple of median for CRL">
            <input
              type="number" min={0.1} max={10} step="0.01"
              value={form.ntMoM}
              onChange={(e) => setForm({ ...form, ntMoM: e.target.value })}
              className={inputCls}
              placeholder="e.g. 1.20"
            />
          </Field>

          <Field label="Nasal Bone">
            <select value={form.nasalBone} onChange={(e) => setForm({ ...form, nasalBone: e.target.value as FormState['nasalBone'] })} className={inputCls}>
              <option value="unknown">Not assessed</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </Field>

          <Field label="Ductus Venosus a-wave">
            <select value={form.ductusVenosus} onChange={(e) => setForm({ ...form, ductusVenosus: e.target.value as FormState['ductusVenosus'] })} className={inputCls}>
              <option value="unknown">Not assessed</option>
              <option value="normal">Normal</option>
              <option value="reversed">Reversed</option>
            </select>
          </Field>

          <Field label="Tricuspid Regurgitation">
            <select value={form.tricuspid} onChange={(e) => setForm({ ...form, tricuspid: e.target.value as FormState['tricuspid'] })} className={inputCls}>
              <option value="unknown">Not assessed</option>
              <option value="normal">Absent</option>
              <option value="regurg">Present</option>
            </select>
          </Field>

          <Field label="Major Malformations">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={form.majorMalformations}
                onChange={(e) => setForm({ ...form, majorMalformations: e.target.checked })}
              />
              Present (elevates T18 / T13 risk)
            </label>
          </Field>
        </div>

        {/* Action bar */}
        <div className="px-5 pb-3 flex items-center gap-2">
          <button
            onClick={handleCalculate}
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Calculate
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save to Report
          </button>
          {stored && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-auto"
            >
              <Trash2 size={12} /> Remove saved result
            </button>
          )}
        </div>

        {/* Result table */}
        {result && (
          <div className="px-5 pb-5">
            <ResultTable r={result} />
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Disclaimer: Risk estimates are produced by an internal implementation of the FMF combined screening model using published likelihood ratios (Nicolaides 2011, Kagan 2008). Clinical decisions require validated software and patient-specific counselling.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────

const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}{required && <span className="text-red-500"> *</span>}
        {hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function ResultTable({ r }: { r: AneuploidyResult }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-slate-100 dark:bg-slate-700 text-xs uppercase text-slate-600 dark:text-slate-300">
          <th className="text-left px-3 py-2 border border-slate-200 dark:border-slate-600">Trisomy</th>
          <th className="text-right px-3 py-2 border border-slate-200 dark:border-slate-600">A-priori (age)</th>
          <th className="text-right px-3 py-2 border border-slate-200 dark:border-slate-600">Composite LR</th>
          <th className="text-right px-3 py-2 border border-slate-200 dark:border-slate-600">Combined Risk</th>
          <th className="text-center px-3 py-2 border border-slate-200 dark:border-slate-600">Category</th>
        </tr>
      </thead>
      <tbody>
        {(['t21', 't18', 't13'] as const).map((k) => (
          <tr key={k}>
            <td className="px-3 py-2 border border-slate-200 dark:border-slate-600 font-semibold">
              {k === 't21' ? 'Trisomy 21 (Down)' : k === 't18' ? 'Trisomy 18 (Edwards)' : 'Trisomy 13 (Patau)'}
            </td>
            <td className="px-3 py-2 border border-slate-200 dark:border-slate-600 text-right font-mono text-xs">{formatRisk(r.apriori[k])}</td>
            <td className="px-3 py-2 border border-slate-200 dark:border-slate-600 text-right font-mono text-xs">{r.lr[k].toFixed(2)}</td>
            <td className="px-3 py-2 border border-slate-200 dark:border-slate-600 text-right font-mono font-semibold">{formatRisk(r.combined[k])}</td>
            <td className="px-3 py-2 border border-slate-200 dark:border-slate-600 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${categoryColor(r.category[k])}`}>
                {categoryLabel(r.category[k])}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
