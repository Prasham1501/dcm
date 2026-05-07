import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useExaminationStore, useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useBiometryStore } from '@/features/fetal/stores/biometryStore';
import { useStructuralStore } from '@/features/fetal/stores/structuralStore';
import { useUIStore } from '@/stores/uiStore';
import { deriveDatingFromLmp, formatDateDisplay } from '@/features/fetal/lib/dating';
import { BiometryTab } from '@/features/fetal/tabs/BiometryTab';
import { StructuralAssessmentTab } from '@/features/fetal/tabs/StructuralAssessmentTab';
import type { ExamType } from '@/features/fetal/types';

const TABS = [
  { key: 'biometry',     label: 'Biometry' },
  { key: 'structural',   label: 'Structural Assessment' },
  { key: 'abnormal',     label: 'Abnormal Structural Assessment' },
  { key: 'intervention', label: 'Intervention' },
  { key: 'report',       label: 'Report' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function FetalExaminationWorkspace() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);

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
  const clearStructural = useStructuralStore((s) => s.clear);

  const [activeTab, setActiveTab] = useState<TabKey>('biometry');
  const [examPickerOpen, setExamPickerOpen] = useState(false);
  const [lmpDraft, setLmpDraft] = useState('');
  const [examDateDraft, setExamDateDraft] = useState('');

  useEffect(() => {
    if (!patientId) return;
    loadForPatient(patientId).catch((e) =>
      addToast(`Failed to load examinations: ${(e as Error).message}`, 'error'),
    );
  }, [patientId, loadForPatient, addToast]);

  // Sync local draft values when active examination changes
  useEffect(() => {
    setLmpDraft(current?.lmp_date ?? '');
    setExamDateDraft(current?.exam_date ?? '');
    clearBiometry();
    clearStructural();
  }, [current?.id, clearBiometry, clearStructural]); // eslint-disable-line react-hooks/exhaustive-deps

  const dating = useMemo(
    () => deriveDatingFromLmp(current?.lmp_date ?? null, current?.exam_date ?? null),
    [current?.lmp_date, current?.exam_date],
  );

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

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Top header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/fetal')}
            className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Back to patient list"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-xs text-slate-500">Patient ID</div>
            <div className="font-mono text-sm">{patientId}</div>
          </div>
        </div>

        {/* Examination selector */}
        <div className="relative">
          {current ? (
            <button
              onClick={() => setExamPickerOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              <span>{current.exam_label}</span>
              <span className="text-slate-400">·</span>
              <span>{formatDateDisplay(current.exam_date)}</span>
              <span className="text-slate-400">·</span>
              <span className="text-blue-600 font-mono">{dating.gaDisplay}</span>
              <ChevronDown size={14} />
            </button>
          ) : (
            <span className="text-sm text-slate-400">No examinations yet</span>
          )}

          {examPickerOpen && examinations.length > 0 && (
            <div
              className="absolute right-0 mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg z-10 max-h-64 overflow-auto"
              onMouseLeave={() => setExamPickerOpen(false)}
            >
              {examinations.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setCurrent(e.id); setExamPickerOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    e.id === current?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="font-medium">{e.exam_label}</div>
                  <div className="text-xs text-slate-500">
                    {formatDateDisplay(e.exam_date)} · {e.exam_type} · {e.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {current && (
            <button
              onClick={handleDeleteCurrent}
              className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
              title="Delete examination"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={handleAddExamination}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
          >
            <Plus size={16} /> New Examination
          </button>
        </div>
      </header>

      {/* Date sub-header (LMP + Exam Date) */}
      {current && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-2 flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="text-xs font-medium w-20">LMP Date</span>
            <input
              type="date"
              value={lmpDraft}
              onChange={(e) => setLmpDraft(e.target.value)}
              onBlur={() => saveDateField('lmp_date', lmpDraft)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                         text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <span className="text-xs font-medium w-20">Exam Date</span>
            <input
              type="date"
              value={examDateDraft}
              onChange={(e) => setExamDateDraft(e.target.value)}
              onBlur={() => saveDateField('exam_date', examDateDraft)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                         text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <span className="text-xs text-slate-400 ml-2">
            GA: <span className="font-mono text-blue-600">{dating.gaDisplay}</span>
            {dating.edd && (
              <> · EDD: <span className="font-mono">{dating.edd}</span></>
            )}
          </span>

          <label className="flex items-center gap-2 ml-auto text-slate-600 dark:text-slate-300">
            <span className="text-xs font-medium">Exam Type</span>
            <select
              value={current.exam_type}
              onChange={(e) => patchCurrent({ exam_type: e.target.value as ExamType })}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600
                         bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="FTS">FTS (First Trimester)</option>
              <option value="SECOND_TRIMESTER">2nd Trimester</option>
              <option value="THIRD_TRIMESTER">3rd Trimester</option>
              <option value="FETAL_ECHO">Fetal Echo</option>
              <option value="NEURO">Neurosonography</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>
      )}

      {/* Loading / error */}
      {loading && <div className="px-6 py-2 text-xs text-slate-500">Loading examinations…</div>}
      {error && <div className="px-6 py-2 text-xs text-red-600">Error: {error}</div>}

      {!loading && !current && examinations.length === 0 && (
        <div className="max-w-2xl mx-auto mt-16 text-center bg-white dark:bg-slate-800 p-10 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">No examinations yet</h2>
          <p className="text-sm text-slate-500 mb-6">
            Click <em>New Examination</em> to start a fetal study for this patient.
          </p>
          <button
            onClick={handleAddExamination}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            <Plus size={16} className="inline mr-1" /> New Examination
          </button>
        </div>
      )}

      {current && (
        <>
          {/* Tab strip */}
          <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <main className="flex-1 overflow-auto">
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
          </main>
        </>
      )}
    </div>
  );
}

function TabStub({ label, note }: { label: string; note: string }) {
  return (
    <div className="p-6">
      <div className="max-w-3xl bg-white dark:bg-slate-800 p-8 rounded-lg shadow text-center">
        <h2 className="text-lg font-semibold mb-2">{label}</h2>
        <p className="text-sm text-slate-500">{note}</p>
      </div>
    </div>
  );
}
