/**
 * Preterm Birth Risk Modal — cervical-length-based (To/Skentou/Nicolaides).
 */
import { useEffect, useState } from 'react';
import { X, Calculator, Save, Loader2, Trash2 } from 'lucide-react';
import {
  pretermBirthRisk, formatRisk, categoryColor, categoryLabel,
  type PretermInputs, type PretermResult,
} from '@/features/fetal/lib/fmfRisk';
import { useRiskStore } from '@/features/fetal/stores/riskStore';
import { useUIStore } from '@/stores/uiStore';

interface Props { open: boolean; onClose: () => void; }

const DEFAULT: PretermInputs = {
  cervicalLengthMm: NaN,
  priorSpontaneousPTB: false,
  multipleGestation: false,
  conisation: false,
};

const inputCls = "w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500";

export function PretermBirthRiskModal({ open, onClose }: Props) {
  const stored = useRiskStore((s) => s.rows.preterm);
  const save = useRiskStore((s) => s.save);
  const remove = useRiskStore((s) => s.remove);
  const saving = useRiskStore((s) => s.saving);
  const addToast = useUIStore((s) => s.addToast);

  const [cl, setCl] = useState('');
  const [priorPTB, setPriorPTB]   = useState(false);
  const [multiple, setMultiple]   = useState(false);
  const [coni, setConi]           = useState(false);
  const [result, setResult]       = useState<PretermResult | null>(null);

  useEffect(() => {
    if (!open) return;
    if (stored?.inputs) {
      const i = stored.inputs as PretermInputs;
      setCl(Number.isFinite(i.cervicalLengthMm) ? String(i.cervicalLengthMm) : '');
      setPriorPTB(!!i.priorSpontaneousPTB);
      setMultiple(!!i.multipleGestation);
      setConi(!!i.conisation);
      setResult(stored.results as PretermResult);
    } else {
      setCl(''); setPriorPTB(false); setMultiple(false); setConi(false); setResult(null);
    }
  }, [open, stored]);

  if (!open) return null;

  const toInputs = (): PretermInputs => ({
    cervicalLengthMm:    parseFloat(cl),
    priorSpontaneousPTB: priorPTB,
    multipleGestation:   multiple,
    conisation:          coni,
  });

  const handleCalculate = () => {
    if (!cl || isNaN(parseFloat(cl))) { addToast('Cervical length is required', 'error'); return; }
    setResult(pretermBirthRisk(toInputs()));
  };

  const handleSave = async () => {
    const res = result ?? pretermBirthRisk(toInputs());
    try {
      await save('preterm', toInputs(), res, true);
      addToast('Preterm birth risk saved', 'success');
      onClose();
    } catch (e) { addToast(`Save failed: ${(e as Error).message}`, 'error'); }
  };

  const handleClear = async () => {
    if (!stored) { setCl(''); setResult(null); return; }
    if (!confirm('Remove the saved preterm birth risk result?')) return;
    await remove('preterm');
    setCl(''); setPriorPTB(false); setMultiple(false); setConi(false); setResult(null);
    addToast('Result removed', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-purple-500" />
            <h2 className="text-base font-semibold">Preterm Birth Risk (sPTB &lt; 34 weeks)</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Cervical length (mm) <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(measured by TVS at 19–24 weeks)</span>
            </span>
            <input
              type="number" step="0.1" min={0} max={70}
              value={cl} onChange={(e) => setCl(e.target.value)}
              className={inputCls} placeholder="e.g. 30"
            />
          </label>

          <div className="grid grid-cols-1 gap-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={priorPTB} onChange={(e) => setPriorPTB(e.target.checked)} />
              Prior spontaneous preterm birth
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
              Multiple gestation (twins, triplets…)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={coni} onChange={(e) => setConi(e.target.checked)} />
              Prior cervical surgery (conisation / LLETZ)
            </label>
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
            <div className="p-4 rounded border border-purple-300 bg-purple-50/40 dark:bg-purple-900/10">
              <div className="text-xs uppercase text-slate-500 tracking-wide mb-1">sPTB &lt; 34 weeks risk</div>
              <div className="font-mono text-3xl font-semibold">{formatRisk(result.sPTBunder34)}</div>
              <div className="mt-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${categoryColor(result.category)}`}>
                  {categoryLabel(result.category)}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Disclaimer: Risk derived from a piecewise odds-ratio adaptation of the cervical-length screening literature (To/Skentou/Nicolaides UOG 2006). Not a substitute for clinical judgement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
