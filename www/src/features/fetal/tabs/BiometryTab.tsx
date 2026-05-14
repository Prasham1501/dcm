import { useEffect, useState, useCallback } from 'react';
import { BarChart2, Save, Activity, ShieldAlert, Clock } from 'lucide-react';
import { useBiometryStore, FTS_FIELDS, SECOND_TRIMESTER_FIELDS } from '@/features/fetal/stores/biometryStore';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useRiskStore } from '@/features/fetal/stores/riskStore';
import { useUIStore } from '@/stores/uiStore';
import { deriveDatingFromLmp } from '@/features/fetal/lib/dating';
import type { ExamType } from '@/features/fetal/types';
import { ReferenceChart } from '@/features/fetal/components/ReferenceChart';
import { AneuploidyRiskModal } from '@/features/fetal/calculators/AneuploidyRiskModal';
import { PreeclampsiaRiskModal } from '@/features/fetal/calculators/PreeclampsiaRiskModal';
import { PretermBirthRiskModal } from '@/features/fetal/calculators/PretermBirthRiskModal';
import { formatRisk } from '@/features/fetal/lib/fmfRisk';

interface ChartModal {
  fieldKey: string;
  label: string;
  unit: string;
  authorId: number;
}

/** All unique field definitions (union of FTS + 2nd trimester) */
const ALL_FIELDS: { key: string; label: string; unit: string }[] = (() => {
  const seen = new Set<string>();
  const out: { key: string; label: string; unit: string }[] = [];
  for (const f of [...FTS_FIELDS, ...SECOND_TRIMESTER_FIELDS]) {
    if (!seen.has(f.key)) { seen.add(f.key); out.push(f); }
  }
  return out;
})();

function getFieldsForExamType(type: ExamType, fields: Record<string, { value: number | null }>) {
  // Base fields for the exam type
  const base = type === 'FTS' ? FTS_FIELDS : SECOND_TRIMESTER_FIELDS;
  const baseKeys = new Set(base.map(f => f.key));
  // Also include any field that has a value (from extraction) even if not in the base set
  const extras = ALL_FIELDS.filter(f => !baseKeys.has(f.key) && fields[f.key]?.value !== null && fields[f.key]?.value !== undefined);
  return [...base, ...extras];
}

function calcPercentile(value: number, mean: number, sd: number): number {
  // Approximation of standard normal CDF via Abramowitz & Stegun
  const z = (value - mean) / sd;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))));
  const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return +(z >= 0 ? phi * 100 : (1 - phi) * 100).toFixed(1);
}

function pctColor(pct: number | null): string {
  if (pct === null) return '';
  if (pct < 5 || pct > 95) return 'text-red-600 font-semibold';
  if (pct < 10 || pct > 90) return 'text-amber-600';
  return 'text-green-600';
}

function pctBgColor(pct: number | null): string {
  if (pct === null) return '';
  if (pct < 5 || pct > 95) return 'bg-red-50 dark:bg-red-900/20';
  if (pct < 10 || pct > 90) return 'bg-amber-50 dark:bg-amber-900/20';
  return '';
}

export function BiometryTab() {
  const current = useCurrentExamination();
  const addToast = useUIStore((s) => s.addToast);

  const {
    fields, authors, loading, saving, error,
    loadForExamination, loadAuthors,
    setFieldValue, setFieldAuthor, setFieldMeta,
    save,
  } = useBiometryStore();

  const [chartModal, setChartModal] = useState<ChartModal | null>(null);
  const [riskModal, setRiskModal] = useState<null | 'aneuploidy' | 'preeclampsia' | 'preterm'>(null);

  const { loadChartData } = useBiometryStore();

  const riskRows         = useRiskStore((s) => s.rows);
  const loadRisks        = useRiskStore((s) => s.loadForExamination);

  useEffect(() => {
    if (current?.id) {
      loadForExamination(current.id);
      loadAuthors();
      loadRisks(current.id);
    }
  }, [current?.id, loadForExamination, loadAuthors, loadRisks]);

  const dating = deriveDatingFromLmp(current?.lmp_date ?? null, current?.exam_date ?? null);

  // Find reference row closest to current GA for percentile calculation
  const getClosestRef = useCallback(async (fieldKey: string, authorId: number) => {
    if (dating.gaWeeks === null) return null;
    const pts = await loadChartData(fieldKey, authorId);
    if (!pts.length) return null;
    return pts.reduce((best, p) =>
      Math.abs(p.ga_weeks - dating.gaWeeks!) < Math.abs(best.ga_weeks - dating.gaWeeks!) ? p : best
    );
  }, [dating.gaWeeks, loadChartData]);

  const handleBlur = useCallback(async (fieldKey: string) => {
    const f = fields[fieldKey];
    if (f?.value === null || f.value === undefined) return;

    const authorCode = f.referenceAuthor ?? authors[0]?.code;
    const author = authors.find((a) => a.code === authorCode);
    if (!author) return;

    const ref = await getClosestRef(fieldKey, author.id);
    if (!ref || !ref.mean || !ref.sd) return;

    const pct = calcPercentile(f.value, ref.mean, ref.sd);
    const z = +((f.value - ref.mean) / ref.sd).toFixed(2);
    const isAbnormal = pct < 5 || pct > 95;
    setFieldMeta(fieldKey, { percentile: pct, zScore: z, isAbnormal });
  }, [fields, authors, getClosestRef, setFieldMeta]);

  const handleSave = async () => {
    try {
      await save();
      addToast('Biometry saved', 'success');
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    }
  };

  const openChart = (fieldDef: { key: string; label: string; unit: string }) => {
    const f = fields[fieldDef.key];
    const authorCode = f?.referenceAuthor ?? authors[0]?.code;
    const author = authors.find((a) => a.code === authorCode);
    if (!author) {
      addToast('No reference data available for this field', 'error');
      return;
    }
    setChartModal({ fieldKey: fieldDef.key, label: fieldDef.label, unit: fieldDef.unit, authorId: author.id });
  };

  if (!current) return null;
  if (loading) return <div className="p-6 text-sm text-slate-500">Loading biometry…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">Error: {error}</div>;

  const fieldDefs = getFieldsForExamType(current.exam_type, fields);

  return (
    <div className="p-4">
      {/* Dating header */}
      <div className="mb-4 flex items-center gap-4 text-xs bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
        <span className="text-slate-500">Gestational Age:</span>
        <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
          {dating.gaDisplay}
        </span>
        {dating.edd && (
          <>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">EDD:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{dating.edd}</span>
          </>
        )}
        {!current.lmp_date && (
          <span className="text-amber-600 text-xs italic">
            Set LMP in examination header to see GA
          </span>
        )}
      </div>

      {/* First Trimester Risk panel */}
      <div className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          First-Trimester Risk Assessment
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          <RiskButton
            icon={<Activity size={14} className="text-rose-500" />}
            label="Aneuploidy"
            sub="T21 · T18 · T13"
            valueSummary={
              riskRows.aneuploidy?.results
                ? `T21 ${formatRisk((riskRows.aneuploidy.results as { combined: { t21: number } }).combined.t21)}`
                : null
            }
            onClick={() => setRiskModal('aneuploidy')}
          />
          <RiskButton
            icon={<ShieldAlert size={14} className="text-amber-500" />}
            label="Preeclampsia"
            sub="Wright 2-stage model"
            valueSummary={
              riskRows.preeclampsia?.results
                ? `Preterm ${formatRisk((riskRows.preeclampsia.results as { pretermPE: number }).pretermPE)}`
                : null
            }
            onClick={() => setRiskModal('preeclampsia')}
          />
          <RiskButton
            icon={<Clock size={14} className="text-purple-500" />}
            label="Preterm Birth"
            sub="Cervical length < 34 wk"
            valueSummary={
              riskRows.preterm?.results
                ? `sPTB ${formatRisk((riskRows.preterm.results as { sPTBunder34: number }).sPTBunder34)}`
                : null
            }
            onClick={() => setRiskModal('preterm')}
          />
        </div>
      </div>

      {/* Biometry table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left w-44">Parameter</th>
              <th className="px-4 py-2 text-left w-24">Unit</th>
              <th className="px-4 py-2 text-left w-28">Value</th>
              <th className="px-4 py-2 text-left w-36">Reference</th>
              <th className="px-4 py-2 text-left w-24">Percentile</th>
              <th className="px-4 py-2 text-left w-20">Z-score</th>
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {fieldDefs.map(({ key, label, unit }) => {
              const f = fields[key];
              const pct = f?.percentile ?? null;
              return (
                <tr
                  key={key}
                  className={`border-t border-slate-100 dark:border-slate-700 ${pctBgColor(pct)}`}
                >
                  <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                    {label}
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={f?.value ?? ''}
                      onChange={(e) =>
                        setFieldValue(key, e.target.value === '' ? null : +e.target.value)
                      }
                      onBlur={() => handleBlur(key)}
                      className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={f?.referenceAuthor ?? ''}
                      onChange={(e) => {
                        setFieldAuthor(key, e.target.value);
                        // Recalculate on author change if value exists
                        if (f?.value !== null && f?.value !== undefined) {
                          setTimeout(() => handleBlur(key), 0);
                        }
                      }}
                      className="w-full text-xs px-1 py-1 rounded border border-slate-300 dark:border-slate-600
                                 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300
                                 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— select —</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.code}>{a.display_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className={`px-4 py-2 font-mono text-sm ${pctColor(pct)}`}>
                    {pct !== null ? `${pct}%` : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {f?.zScore !== null && f?.zScore !== undefined ? f.zScore.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => openChart({ key, label, unit })}
                      title="View reference chart"
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600"
                    >
                      <BarChart2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Save button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700
                     disabled:opacity-50 text-white text-sm rounded"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Biometry'}
        </button>
        <span className="text-xs text-slate-400">
          Values outside p5–p95 are highlighted red.
        </span>
      </div>

      {/* Reference chart modal */}
      {chartModal && (
        <ReferenceChart
          parameter={chartModal.fieldKey}
          parameterLabel={chartModal.label}
          unit={chartModal.unit}
          authorId={chartModal.authorId}
          patientValue={fields[chartModal.fieldKey]?.value ?? null}
          patientGaWeeks={dating.gaWeeks}
          onClose={() => setChartModal(null)}
        />
      )}

      {/* Risk calculators */}
      <AneuploidyRiskModal    open={riskModal === 'aneuploidy'}    onClose={() => setRiskModal(null)} />
      <PreeclampsiaRiskModal  open={riskModal === 'preeclampsia'}  onClose={() => setRiskModal(null)} />
      <PretermBirthRiskModal  open={riskModal === 'preterm'}       onClose={() => setRiskModal(null)} />
    </div>
  );
}

function RiskButton({
  icon, label, sub, valueSummary, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  valueSummary: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left flex items-center gap-3 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="block text-[11px] text-slate-500">{sub}</span>
      </span>
      {valueSummary ? (
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex-shrink-0">
          {valueSummary}
        </span>
      ) : (
        <span className="text-[10px] uppercase text-slate-400 flex-shrink-0">Calculate</span>
      )}
    </button>
  );
}
