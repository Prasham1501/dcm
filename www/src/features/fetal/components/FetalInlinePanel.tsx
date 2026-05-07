/**
 * FetalInlinePanel — Compact fetal examination workspace designed to embed
 * as an inline side-panel inside the CRViewerPage (50/50 split with images).
 *
 * Matches the InlineReportPanel style: extraction status banner at top,
 * "Insert" button when readings are ready, auto-percentile calculation.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Plus, Trash2, ChevronDown, X, Zap, Loader2,
  ShieldCheck, ScanSearch, AlertTriangle, Sparkles,
} from 'lucide-react';
import { useExaminationStore, useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useBiometryStore } from '@/features/fetal/stores/biometryStore';
import { useStructuralStore } from '@/features/fetal/stores/structuralStore';
import { useUIStore } from '@/stores/uiStore';
import { useReportStore } from '@/stores/reportStore';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { deriveDatingFromLmp, formatDateDisplay } from '@/features/fetal/lib/dating';
import { BiometryTab } from '@/features/fetal/tabs/BiometryTab';
import { StructuralAssessmentTab } from '@/features/fetal/tabs/StructuralAssessmentTab';
import type { ExamType } from '@/features/fetal/types';

const TABS = [
  { key: 'biometry',     label: 'Biometry' },
  { key: 'structural',   label: 'Structural' },
  { key: 'abnormal',     label: 'Abnormal' },
  { key: 'intervention', label: 'Intervention' },
  { key: 'report',       label: 'Report' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Count how many obstetric readings are in the reading set */
function countObReadings(): { total: number; obstetric: number; keys: string[] } {
  const rs = useReportStore.getState().activeReadingSet;
  if (!rs) return { total: 0, obstetric: 0, keys: [] };
  const obKeys = ['BPD', 'HC', 'AC', 'FL', 'CRL', 'HL', 'EFW', 'NT', 'NB', 'IT', 'FHR', 'AFI'];
  const matched = rs.readings.filter(r => {
    const k = r.key.replace(/_\d+$/, '').toUpperCase();
    return obKeys.includes(k) || (r.category === 'obstetric');
  });
  return {
    total: rs.readings.length,
    obstetric: matched.length,
    keys: [...new Set(matched.map(r => r.key.replace(/_\d+$/, '').toUpperCase()))],
  };
}

export function FetalInlinePanel() {
  const fetalPatientId = useReportStore((s) => s.fetalPatientId);
  const setShowFetalPanel = useReportStore((s) => s.setShowFetalPanel);
  const addToast = useUIStore((s) => s.addToast);

  const patientId = fetalPatientId ?? '';

  const examinations     = useExaminationStore((s) => s.examinations);
  const loading          = useExaminationStore((s) => s.loading);
  const error            = useExaminationStore((s) => s.error);
  const loadForPatient   = useExaminationStore((s) => s.loadForPatient);
  const setCurrent       = useExaminationStore((s) => s.setCurrent);
  const patchCurrent     = useExaminationStore((s) => s.patchCurrent);
  const createForPatient = useExaminationStore((s) => s.createForPatient);
  const removeExamination = useExaminationStore((s) => s.removeExamination);
  const current = useCurrentExamination();

  const clearBiometry = useBiometryStore((s) => s.clear);
  const applyReadings = useBiometryStore((s) => s.applyReadings);
  const recalcAllPercentiles = useBiometryStore((s) => s.recalcAllPercentiles);
  const clearStructural = useStructuralStore((s) => s.clear);

  const activeReadingSet = useReportStore((s) => s.activeReadingSet);
  const extractionStatus = useReportStore((s) => s.extractionStatus);

  const [activeTab, setActiveTab] = useState<TabKey>('biometry');
  const [examPickerOpen, setExamPickerOpen] = useState(false);
  const [lmpDraft, setLmpDraft] = useState('');
  const [examDateDraft, setExamDateDraft] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [inserted, setInserted] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    loadForPatient(patientId).catch((e) =>
      addToast(`Failed to load examinations: ${(e as Error).message}`, 'error'),
    );
  }, [patientId, loadForPatient, addToast]);

  useEffect(() => {
    setLmpDraft(current?.lmp_date ?? '');
    setExamDateDraft(current?.exam_date ?? '');
    clearBiometry();
    clearStructural();
    setInserted(false);
  }, [current?.id, clearBiometry, clearStructural]); // eslint-disable-line react-hooks/exhaustive-deps

  const dating = useMemo(
    () => deriveDatingFromLmp(current?.lmp_date ?? null, current?.exam_date ?? null),
    [current?.lmp_date, current?.exam_date],
  );

  /** Manually trigger extraction from DICOM images */
  const handleExtract = useCallback(async () => {
    const crImages = useCRViewerStore.getState().images;
    const filePaths = crImages.map((img: any) => img.filePath).filter(Boolean);

    if (filePaths.length === 0) {
      addToast('No images loaded — open a study first', 'error');
      return;
    }

    setExtracting(true);
    try {
      const { extractReadings } = await import('@/lib/usgExtraction/extractReadings');
      const result = await extractReadings({
        studyUID: patientId || 'auto',
        orthancStudyId: '',
        orthancInstanceIds: [],
        imageUrls: crImages.map((img: any) => img.imageUrl),
        filePaths,
        hfToken: '',
      });

      useReportStore.getState().setActiveReadingSet(result.readings.length > 0 ? result : null);
      useReportStore.getState().setExtractionStatus('done');

      if (result.readings.length > 0) {
        addToast(`Extracted ${result.readings.length} measurements (${result.source})`, 'success');
      } else {
        addToast('No measurements found in images', 'error');
      }
    } catch (err) {
      console.warn('[FetalInlinePanel] extraction failed:', err);
      addToast(`Extraction failed: ${(err as Error).message}`, 'error');
      useReportStore.getState().setExtractionStatus('failed');
    } finally {
      setExtracting(false);
    }
  }, [patientId, addToast]);

  /** Insert extracted readings into biometry fields + recalculate percentiles */
  const handleInsert = useCallback(async () => {
    if (!activeReadingSet || !current) return;

    const applied = applyReadings(activeReadingSet.readings);

    if (applied.length > 0) {
      addToast(
        `Inserted ${applied.length}: ${applied.map(a => `${a.fieldKey}=${a.value}${a.unit}`).join(', ')}`,
        'success',
      );

      // Recalculate percentiles for all filled fields
      if (dating.gaWeeks !== null) {
        setTimeout(async () => {
          const count = await recalcAllPercentiles(dating.gaWeeks);
          if (count > 0) {
            addToast(`Calculated percentiles for ${count} measurements`, 'success');
          }
        }, 200);
      }
    } else {
      addToast('No matching biometry fields found in extracted readings', 'error');
    }

    setInserted(true);
  }, [activeReadingSet, current, applyReadings, recalcAllPercentiles, dating.gaWeeks, addToast]);

  const handleAddExamination = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await createForPatient({ patient_id: patientId, exam_type: 'FTS' as ExamType, exam_date: today });
      addToast('Examination created', 'success');
    } catch (e) {
      addToast(`Failed to create examination: ${(e as Error).message}`, 'error');
    }
  };

  const handleDeleteCurrent = async () => {
    if (!current) return;
    if (!confirm(`Delete "${current.exam_label}"? This cannot be undone.`)) return;
    try {
      await removeExamination(current.id);
      addToast('Examination deleted', 'success');
    } catch (e) {
      addToast(`Failed to delete: ${(e as Error).message}`, 'error');
    }
  };

  const saveDateField = async (field: 'lmp_date' | 'exam_date', value: string) => {
    if (!current) return;
    try {
      await patchCurrent({ [field]: value || null });
    } catch (e) {
      addToast(`Failed to save: ${(e as Error).message}`, 'error');
    }
  };

  // Derived: extraction state for the banner
  const hasReadings = activeReadingSet && activeReadingSet.readings.length > 0;
  const obInfo = hasReadings ? countObReadings() : { total: 0, obstetric: 0, keys: [] };
  const isRunning = extractionStatus === 'running' || extracting;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-l border-app-border">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-pink-600 uppercase tracking-wide">Fetal Report</span>
          <span className="text-xs text-slate-400 font-mono">{patientId}</span>
        </div>
        <div className="flex items-center gap-1">
          {current && (
            <button
              onClick={handleDeleteCurrent}
              className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
              title="Delete examination"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={handleAddExamination}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            title="New Examination"
          >
            <Plus size={12} /> New
          </button>
          <button
            onClick={() => setShowFetalPanel(false)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 ml-1"
            title="Close fetal panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Extraction status banner (matches InlineReportPanel style) ── */}
      {current && (
        <div className="px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          {isRunning ? (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 size={14} className="animate-spin" />
              <span className="font-medium">Extracting measurements from images…</span>
            </div>
          ) : hasReadings ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                {activeReadingSet!.source === 'dicom-sr' ? (
                  <ShieldCheck size={14} className="text-green-600" />
                ) : (
                  <Sparkles size={14} className="text-amber-500" />
                )}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {obInfo.obstetric} biometry
                </span>
                <span className="text-slate-400">of {obInfo.total} total</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  activeReadingSet!.source === 'dicom-sr'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {activeReadingSet!.source === 'dicom-sr' ? 'DICOM' : activeReadingSet!.source === 'pixel-ocr' ? 'OCR' : 'AI'}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {!inserted ? (
                  <button
                    onClick={handleInsert}
                    className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded"
                    title="Insert extracted values into biometry fields"
                  >
                    <Zap size={12} />
                    Insert Readings
                  </button>
                ) : (
                  <button
                    onClick={() => { setInserted(false); handleInsert(); }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-medium rounded"
                    title="Re-insert readings (will overwrite current values)"
                  >
                    Re-insert
                  </button>
                )}
              </div>
            </div>
          ) : extractionStatus === 'failed' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertTriangle size={14} />
                <span>Extraction failed</span>
              </div>
              <button
                onClick={handleExtract}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                <ScanSearch size={12} />
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {extractionStatus === 'done' ? 'No measurements found' : 'Waiting for extraction…'}
              </span>
              <button
                onClick={handleExtract}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded font-medium"
              >
                <ScanSearch size={12} />
                Scan
              </button>
            </div>
          )}

          {hasReadings && activeReadingSet!.source !== 'dicom-sr' && !inserted && (
            <div className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={10} />
              Verify values — extracted via {activeReadingSet!.source === 'pixel-ocr' ? 'OCR' : 'AI'}. Click Insert to apply.
            </div>
          )}

          {hasReadings && obInfo.keys.length > 0 && !inserted && (
            <div className="mt-1 text-[10px] text-slate-400">
              Found: {obInfo.keys.join(', ')}
            </div>
          )}

          {inserted && (
            <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <ShieldCheck size={10} />
              Values inserted into biometry table
            </div>
          )}
        </div>
      )}

      {/* Examination picker */}
      {current && (
        <div className="px-3 py-1.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 relative">
          <button
            onClick={() => setExamPickerOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 w-full justify-between"
          >
            <span className="truncate">{current.exam_label} · {formatDateDisplay(current.exam_date)} · <span className="text-blue-600 font-mono">{dating.gaDisplay}</span></span>
            <ChevronDown size={12} />
          </button>

          {examPickerOpen && examinations.length > 0 && (
            <div
              className="absolute left-3 right-3 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg z-10 max-h-48 overflow-auto"
              onMouseLeave={() => setExamPickerOpen(false)}
            >
              {examinations.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setCurrent(e.id); setExamPickerOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    e.id === current?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="font-medium">{e.exam_label}</div>
                  <div className="text-[10px] text-slate-500">{formatDateDisplay(e.exam_date)} · {e.exam_type} · {e.status}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date fields row */}
      {current && (
        <div className="px-3 py-1.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="font-medium">LMP</span>
            <input
              type="date"
              value={lmpDraft}
              onChange={(e) => setLmpDraft(e.target.value)}
              onBlur={() => saveDateField('lmp_date', lmpDraft)}
              className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                         text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
            <span className="font-medium">Exam</span>
            <input
              type="date"
              value={examDateDraft}
              onChange={(e) => setExamDateDraft(e.target.value)}
              onBlur={() => saveDateField('exam_date', examDateDraft)}
              className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                         text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>
          <select
            value={current.exam_type}
            onChange={(e) => patchCurrent({ exam_type: e.target.value as ExamType })}
            className="px-1.5 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-600
                       bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300
                       focus:outline-none focus:ring-1 focus:ring-blue-500 ml-auto"
          >
            <option value="FTS">FTS</option>
            <option value="SECOND_TRIMESTER">2nd Tri</option>
            <option value="THIRD_TRIMESTER">3rd Tri</option>
            <option value="FETAL_ECHO">Echo</option>
            <option value="NEURO">Neuro</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      )}

      {/* Loading / error states */}
      {loading && <div className="px-3 py-2 text-xs text-slate-500">Loading examinations…</div>}
      {error && <div className="px-3 py-2 text-xs text-red-600">Error: {error}</div>}

      {!loading && !current && examinations.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold mb-2">No examinations yet</h3>
            <p className="text-xs text-slate-500 mb-4">Click New to start a fetal study.</p>
            <button
              onClick={handleAddExamination}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              <Plus size={12} className="inline mr-1" /> New Examination
            </button>
          </div>
        </div>
      )}

      {current && (
        <>
          {/* Tab strip */}
          <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 flex gap-0.5 overflow-x-auto flex-shrink-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === t.key
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'biometry' && <BiometryTab />}
            {activeTab === 'structural' && <StructuralAssessmentTab />}
            {activeTab === 'abnormal' && (
              <TabStub label="Abnormal Structural Assessment" note="Findings → Syndromes → Genes browsers. (Phase 4)" />
            )}
            {activeTab === 'intervention' && (
              <TabStub label="Intervention" note="Procedures and counselling notes. (Phase 8)" />
            )}
            {activeTab === 'report' && (
              <TabStub label="Report" note="Composer with per-section include/exclude + PDF. (Phase 6)" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TabStub({ label, note }: { label: string; note: string }) {
  return (
    <div className="p-4">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow text-center">
        <h3 className="text-sm font-semibold mb-1">{label}</h3>
        <p className="text-xs text-slate-500">{note}</p>
      </div>
    </div>
  );
}
