/**
 * Preeclampsia Risk Modal — Wright two-stage model (simplified).
 */
import { useEffect, useState } from 'react';
import { X, Calculator, Save, Loader2, Trash2 } from 'lucide-react';
import {
  preeclampsiaRisk, formatRisk, categoryColor, categoryLabel,
  type PreeclampsiaInputs, type PreeclampsiaResult,
} from '@/features/fetal/lib/fmfRisk';
import { useRiskStore } from '@/features/fetal/stores/riskStore';
import { useUIStore } from '@/stores/uiStore';

interface Props { open: boolean; onClose: () => void; }

type Form = {
  maternalAge: string; bmi: string;
  race: PreeclampsiaInputs['race']; parity: PreeclampsiaInputs['parity'];
  chronicHTN: boolean; diabetes: boolean; ivfPregnancy: boolean;
  mapMoM: string; utaPiMoM: string; pappAMoM: string; plgfMoM: string;
};

const DEFAULT_FORM: Form = {
  maternalAge: '', bmi: '',
  race: 'white', parity: 'nulliparous',
  chronicHTN: false, diabetes: false, ivfPregnancy: false,
  mapMoM: '', utaPiMoM: '', pappAMoM: '', plgfMoM: '',
};

const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500";

export function PreeclampsiaRiskModal({ open, onClose }: Props) {
  const stored = useRiskStore((s) => s.rows.preeclampsia);
  const save = useRiskStore((s) => s.save);
  const remove = useRiskStore((s) => s.remove);
  const saving = useRiskStore((s) => s.saving);
  const addToast = useUIStore((s) => s.addToast);

  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [result, setResult] = useState<PreeclampsiaResult | null>(null);

  useEffect(() => {
    if (!open) return;
    if (stored?.inputs) {
      const inp = stored.inputs as PreeclampsiaInputs;
      setForm({
        maternalAge: String(inp.maternalAge ?? ''),
        bmi:         String(inp.bmi ?? ''),
        race:        inp.race    ?? 'white',
        parity:      inp.parity  ?? 'nulliparous',
        chronicHTN:   !!inp.chronicHTN,
        diabetes:     !!inp.diabetes,
        ivfPregnancy: !!inp.ivfPregnancy,
        mapMoM:   inp.mapMoM   != null ? String(inp.mapMoM)   : '',
        utaPiMoM: inp.utaPiMoM != null ? String(inp.utaPiMoM) : '',
        pappAMoM: inp.pappAMoM != null ? String(inp.pappAMoM) : '',
        plgfMoM:  inp.plgfMoM  != null ? String(inp.plgfMoM)  : '',
      });
      setResult(stored.results as PreeclampsiaResult);
    } else {
      setForm(DEFAULT_FORM); setResult(null);
    }
  }, [open, stored]);

  if (!open) return null;

  const toInputs = (): PreeclampsiaInputs => ({
    maternalAge: parseFloat(form.maternalAge),
    bmi:         parseFloat(form.bmi),
    race:        form.race,
    parity:      form.parity,
    chronicHTN:   form.chronicHTN,
    diabetes:     form.diabetes,
    ivfPregnancy: form.ivfPregnancy,
    mapMoM:   form.mapMoM   ? parseFloat(form.mapMoM)   : undefined,
    utaPiMoM: form.utaPiMoM ? parseFloat(form.utaPiMoM) : undefined,
    pappAMoM: form.pappAMoM ? parseFloat(form.pappAMoM) : undefined,
    plgfMoM:  form.plgfMoM  ? parseFloat(form.plgfMoM)  : undefined,
  });

  const handleCalculate = () => {
    if (!form.maternalAge || !form.bmi) { addToast('Maternal age and BMI required', 'error'); return; }
    setResult(preeclampsiaRisk(toInputs()));
  };

  const handleSave = async () => {
    const res = result ?? preeclampsiaRisk(toInputs());
    try {
      await save('preeclampsia', toInputs(), res, true);
      addToast('Preeclampsia risk saved', 'success');
      onClose();
    } catch (e) { addToast(`Save failed: ${(e as Error).message}`, 'error'); }
  };

  const handleClear = async () => {
    if (!stored) { setForm(DEFAULT_FORM); setResult(null); return; }
    if (!confirm('Remove the saved preeclampsia risk result?')) return;
    await remove('preeclampsia');
    setForm(DEFAULT_FORM); setResult(null);
    addToast('Result removed', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold">Preeclampsia Risk (FMF, Wright et al)</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </header>

        <div className="p-5 grid grid-cols-2 gap-4">
          <Field label="Maternal age" required>
            <input type="number" min={15} max={55} value={form.maternalAge} onChange={(e) => setForm({ ...form, maternalAge: e.target.value })} className={inputCls} />
          </Field>
          <Field label="BMI (kg/m²)" required>
            <input type="number" step="0.1" value={form.bmi} onChange={(e) => setForm({ ...form, bmi: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Ethnicity">
            <select value={form.race} onChange={(e) => setForm({ ...form, race: e.target.value as Form['race'] })} className={inputCls}>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="south_asian">South Asian</option>
              <option value="east_asian">East Asian</option>
              <option value="mixed">Mixed</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Parity / history">
            <select value={form.parity} onChange={(e) => setForm({ ...form, parity: e.target.value as Form['parity'] })} className={inputCls}>
              <option value="nulliparous">Nulliparous</option>
              <option value="multiparous_no_pe">Multiparous (no prior PE)</option>
              <option value="multiparous_with_pe">Multiparous (prior PE)</option>
            </select>
          </Field>

          <Field label="MAP MoM" hint="Mean Arterial Pressure">
            <input type="number" step="0.01" value={form.mapMoM} onChange={(e) => setForm({ ...form, mapMoM: e.target.value })} className={inputCls} placeholder="e.g. 1.10" />
          </Field>
          <Field label="UtA-PI MoM" hint="Uterine Artery PI">
            <input type="number" step="0.01" value={form.utaPiMoM} onChange={(e) => setForm({ ...form, utaPiMoM: e.target.value })} className={inputCls} placeholder="e.g. 1.20" />
          </Field>
          <Field label="PAPP-A MoM">
            <input type="number" step="0.01" value={form.pappAMoM} onChange={(e) => setForm({ ...form, pappAMoM: e.target.value })} className={inputCls} placeholder="e.g. 0.80" />
          </Field>
          <Field label="PlGF MoM">
            <input type="number" step="0.01" value={form.plgfMoM} onChange={(e) => setForm({ ...form, plgfMoM: e.target.value })} className={inputCls} placeholder="e.g. 0.70" />
          </Field>

          <div className="col-span-2 grid grid-cols-3 gap-2 mt-1">
            <Toggle label="Chronic hypertension"  value={form.chronicHTN}   onChange={(v) => setForm({ ...form, chronicHTN: v })} />
            <Toggle label="Pre-existing diabetes" value={form.diabetes}     onChange={(v) => setForm({ ...form, diabetes: v })} />
            <Toggle label="IVF pregnancy"         value={form.ivfPregnancy} onChange={(v) => setForm({ ...form, ivfPregnancy: v })} />
          </div>
        </div>

        <div className="px-5 pb-3 flex items-center gap-2">
          <button onClick={handleCalculate} className="px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded">Calculate</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save to Report
          </button>
          {stored && (
            <button onClick={handleClear} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded ml-auto">
              <Trash2 size={12} /> Remove saved result
            </button>
          )}
        </div>

        {result && (
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="Preterm PE (< 37 weeks)" risk={result.pretermPE} category={result.category} primary />
              <ResultCard label="Term PE (≥ 37 weeks)"    risk={result.termPE}    category={result.category} />
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Disclaimer: Simplified implementation of the FMF two-stage screening model (Wright 2019). Use validated software for clinical decision making.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ResultCard({ label, risk, category, primary }: {
  label: string; risk: number;
  category: PreeclampsiaResult['category']; primary?: boolean;
}) {
  return (
    <div className={`p-4 rounded border ${primary ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30'}`}>
      <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">{label}</div>
      <div className="font-mono text-2xl font-semibold">{formatRisk(risk)}</div>
      <div className="mt-1.5">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${categoryColor(category)}`}>
          {categoryLabel(category)}
        </span>
      </div>
    </div>
  );
}
