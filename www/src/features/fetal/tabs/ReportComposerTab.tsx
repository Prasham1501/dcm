/**
 * ReportComposerTab — Phase 6.
 *
 *   - Gathers data from every other fetal store + hospital config + structural API
 *   - Renders an in-app preview of the final report
 *   - Each section has a "Remove from Report" toggle
 *   - Free-text Content + Recommendations editors
 *   - Print and Save Final actions
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Printer, Save, FileCheck2, EyeOff, Eye, Loader2, FileText } from 'lucide-react';
import { useCurrentExamination } from '@/features/fetal/stores/examinationStore';
import { useBiometryStore }   from '@/features/fetal/stores/biometryStore';
import { useStructuralStore } from '@/features/fetal/stores/structuralStore';
import { useDstStore }        from '@/features/fetal/stores/dstStore';
import { useRiskStore }       from '@/features/fetal/stores/riskStore';
import { useInterventionStore } from '@/features/fetal/stores/interventionStore';
import { useReportComposerStore, type ReportSectionKey } from '@/features/fetal/stores/reportComposerStore';
import { useHospitalConfigStore } from '@/stores/hospitalConfigStore';
import { usePatientStore } from '@/stores/patientStore';
import { useUIStore } from '@/stores/uiStore';
import { deriveDatingFromLmp } from '@/features/fetal/lib/dating';
import { buildReportHtml, printReport, type ReportData } from '@/features/fetal/lib/reportHtml';
import { reportSaveApi } from '@/features/fetal/api/reportSaveApi';
import { structuralApi, type StructuralRow } from '@/features/fetal/api/structuralApi';
import { TemplatePickerModal } from '@/features/fetal/components/TemplatePickerModal';
import { RichTextEditor } from '@/features/fetal/components/RichTextEditor';
import { resolvePlaceholders, type PlaceholderContext } from '@/features/fetal/lib/placeholders';

const SECTION_LABELS: { key: ReportSectionKey; label: string; required?: boolean }[] = [
  { key: 'header',          label: 'Header / Branding', required: true },
  { key: 'patient',         label: 'Patient demographics' },
  { key: 'dating',          label: 'Dating (LMP / GA / EDD)' },
  { key: 'biometry',        label: 'Fetal Biometry' },
  { key: 'structural',      label: 'Structural Assessment' },
  { key: 'risk',            label: 'Risk Assessment' },
  { key: 'findings',        label: 'Diagnoses & Investigations' },
  { key: 'intervention',    label: 'Interventions & Counselling' },
  { key: 'content',         label: 'Report Content (free text)' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'charts',          label: 'Growth Charts' },
];

export function ReportComposerTab() {
  const examination = useCurrentExamination();
  const examId = examination?.id ?? null;
  const addToast = useUIStore((s) => s.addToast);

  // ── Data sources ────────────────────────────────────────────
  const biometryFields  = useBiometryStore((s) => s.fields);
  const dstFindings     = useDstStore((s) => s.findings);
  const dstSyndromes    = useDstStore((s) => s.syndromes);
  const dstGenes        = useDstStore((s) => s.genes);
  const dstInvestigations = useDstStore((s) => s.investigations);
  const riskRows        = useRiskStore((s) => s.rows);
  const interventions   = useInterventionStore((s) => s.procedures);
  const counselling     = useInterventionStore((s) => s.counselling);
  const loadInterventions = useInterventionStore((s) => s.loadForExamination);
  const hospital        = useHospitalConfigStore();
  const patients        = usePatientStore((s) => s.filteredPatients);

  // Composer-specific state
  const setExamination       = useReportComposerStore((s) => s.setExamination);
  const sectionInclude       = useReportComposerStore((s) => s.sectionInclude);
  const toggleSection        = useReportComposerStore((s) => s.toggleSection);
  const contentBody          = useReportComposerStore((s) => s.contentBody);
  const recommendationsBody  = useReportComposerStore((s) => s.recommendationsBody);
  const setContent           = useReportComposerStore((s) => s.setContent);
  const setRecommendations   = useReportComposerStore((s) => s.setRecommendations);
  const selectedChartParams  = useReportComposerStore((s) => s.selectedChartParams);
  const toggleChartParam     = useReportComposerStore((s) => s.toggleChartParam);

  // Structural data is fetched on demand (the structural tab may not have been opened)
  const [structuralRows, setStructuralRows] = useState<StructuralRow[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [pickerOpen, setPickerOpen]   = useState(false);

  // Reset composer state when examination changes
  useEffect(() => { setExamination(examId); }, [examId, setExamination]);

  // Fetch structural rows for the active examination
  useEffect(() => {
    if (!examId) { setStructuralRows([]); return; }
    let cancelled = false;
    structuralApi.load(examId)
      .then((rows) => { if (!cancelled) setStructuralRows(rows); })
      .catch((e) => { if (!cancelled) addToast(`Could not load structural data: ${(e as Error).message}`, 'error'); });
    return () => { cancelled = true; };
  }, [examId, addToast]);

  // Make sure interventions are loaded too — the user may jump straight to
  // the Report tab without visiting Intervention first.
  useEffect(() => {
    if (examId) void loadInterventions(examId).catch(() => { /* toasts emit in store */ });
  }, [examId, loadInterventions]);

  const dating = useMemo(
    () => deriveDatingFromLmp(examination?.lmp_date ?? null, examination?.exam_date ?? null),
    [examination?.lmp_date, examination?.exam_date],
  );

  // Find this patient's full row from the cached patient list (best-effort).
  const patient = useMemo(
    () => patients.find((p) => (p.patientId || p.id) === (examination?.patient_id ?? '')),
    [patients, examination?.patient_id],
  );

  // ── Placeholder context (used by Template picker AND text expansion) ─────
  const placeholderCtx: PlaceholderContext | null = useMemo(() => {
    if (!examination) return null;
    return {
      examination,
      dating: { gaDisplay: dating.gaDisplay, gaWeeks: dating.gaWeeks, edd: dating.edd },
      biometry: biometryFields,
      dst: {
        findings: dstFindings, syndromes: dstSyndromes,
        genes: dstGenes, investigations: dstInvestigations,
      },
      risk: {
        aneuploidy:    riskRows.aneuploidy,
        preeclampsia:  riskRows.preeclampsia,
        preterm:       riskRows.preterm,
      },
      patient: {
        id:              examination.patient_id,
        name:            patient?.patientName,
        age:             patient?.age,
        sex:             patient?.sex,
        referringDoctor: patient?.referringPhysician,
      },
    };
  }, [examination, dating, biometryFields, dstFindings, dstSyndromes, dstGenes, dstInvestigations, riskRows, patient]);

  // ── Assemble the ReportData bundle ──────────────────────────
  const reportData: ReportData | null = useMemo(() => {
    if (!examination || !placeholderCtx) return null;

    // Resolve {{token}} placeholders in the free-text bodies so the rendered
    // report shows the actual values, not the raw tokens.
    const resolvedContent  = resolvePlaceholders(contentBody,         placeholderCtx);
    const resolvedRecs     = resolvePlaceholders(recommendationsBody, placeholderCtx);

    return {
      hospital: {
        name:        hospital.hospitalName || 'Accurate Fetal Medicine',
        address:     [hospital.address1, hospital.address2, hospital.address3].filter(Boolean).join(', '),
        phone:       hospital.phone,
        email:       hospital.email,
        logoDataUrl: hospital.logoDataUrl,
      },
      patient: placeholderCtx.patient,
      examination,
      dating: placeholderCtx.dating,
      biometry: Object.fromEntries(
        Object.entries(biometryFields).filter(([, f]) => f.value !== null && f.value !== undefined),
      ),
      biometryAuthor: null,
      structural: structuralRows,
      findings:        dstFindings,
      syndromes:       dstSyndromes,
      genes:           dstGenes,
      investigations:  dstInvestigations,
      risk: placeholderCtx.risk,
      interventions,
      counsellingNotes: counselling,
      contentBody:         resolvedContent,
      recommendationsBody: resolvedRecs,
      charts: Object.fromEntries(selectedChartParams.map((p) => [p, ''])),
      sectionInclude,
    };
  }, [
    examination, hospital, placeholderCtx,
    biometryFields, structuralRows,
    dstFindings, dstSyndromes, dstGenes, dstInvestigations,
    interventions, counselling,
    contentBody, recommendationsBody,
    selectedChartParams, sectionInclude,
  ]);

  // ── Actions ─────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!reportData) return;
    printReport(buildReportHtml(reportData));
  }, [reportData]);

  const handleSaveDraft = useCallback(async () => {
    if (!reportData || !examination) return;
    setSavingDraft(true);
    try {
      const html = buildReportHtml(reportData);
      await reportSaveApi.save({
        examination_id:        examination.id,
        status:                'draft',
        html,
        patient_id:            examination.patient_id,
        patient_name:          patient?.patientName,
        study_date:            examination.exam_date ?? undefined,
        modality:              'US',
        recommendations_text:  recommendationsBody,
      });
      addToast('Draft saved', 'success');
    } catch (e) {
      addToast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSavingDraft(false);
    }
  }, [reportData, examination, patient, recommendationsBody, addToast]);

  const handleFinalize = useCallback(async () => {
    if (!reportData || !examination) return;
    if (!confirm('Finalise this report? A read-only copy will be stored and the examination status will be set to "final".')) return;
    setSavingFinal(true);
    try {
      const html = buildReportHtml(reportData);
      await reportSaveApi.save({
        examination_id:        examination.id,
        status:                'final',
        html,
        patient_id:            examination.patient_id,
        patient_name:          patient?.patientName,
        study_date:            examination.exam_date ?? undefined,
        modality:              'US',
        recommendations_text:  recommendationsBody,
      });
      addToast('Report finalised', 'success');
    } catch (e) {
      addToast(`Finalise failed: ${(e as Error).message}`, 'error');
    } finally {
      setSavingFinal(false);
    }
  }, [reportData, examination, patient, recommendationsBody, addToast]);

  if (!examId) {
    return <div className="p-6 text-sm text-slate-500">Select or create an examination to compose its report.</div>;
  }

  // Biometry params available for chart attachment
  const biometryParamsWithValues = Object.entries(biometryFields)
    .filter(([, f]) => f.value !== null && f.value !== undefined && f.referenceAuthor)
    .map(([k]) => k);

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 max-w-[1500px] mx-auto items-start">
      {/* ── Left rail: section toggles + actions — sticks while the
              main column scrolls underneath the parent's overflow. ── */}
      <aside className="lg:w-72 lg:flex-shrink-0 space-y-3 lg:sticky lg:top-2 lg:self-start lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto pr-1">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide">
            Sections
          </div>
          <div className="p-3 space-y-1.5">
            {SECTION_LABELS.map((s) => {
              const on = sectionInclude[s.key] ?? true;
              return (
                <label
                  key={s.key}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer
                    ${on ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-slate-100/60 dark:bg-slate-700/30 text-slate-500'}
                    ${s.required ? 'cursor-not-allowed opacity-60' : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                >
                  <input
                    type="checkbox"
                    disabled={s.required}
                    checked={on}
                    onChange={(e) => toggleSection(s.key, e.target.checked)}
                  />
                  <span className="flex-1">{s.label}</span>
                  {on ? <Eye size={11} /> : <EyeOff size={11} className="text-slate-400" />}
                </label>
              );
            })}
          </div>
        </div>

        {/* Templates + placeholders launcher */}
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200 rounded transition"
        >
          <FileText size={14} className="text-blue-600" />
          Templates &amp; Placeholders
        </button>

        {/* Chart selection */}
        {biometryParamsWithValues.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold uppercase tracking-wide">
              Add Charts to Report
            </div>
            <div className="p-3 space-y-1">
              {biometryParamsWithValues.map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedChartParams.includes(p)}
                    onChange={() => toggleChartParam(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            <Printer size={14} /> Print / PDF
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-800 dark:text-slate-200 rounded"
          >
            {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Draft
          </button>
          <button
            onClick={handleFinalize}
            disabled={savingFinal || examination?.status === 'final'}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded"
          >
            {savingFinal ? <Loader2 size={14} className="animate-spin" /> : <FileCheck2 size={14} />}
            {examination?.status === 'final' ? 'Already Finalised' : 'Finalise Report'}
          </button>
        </div>
      </aside>

      {/* ── Main column: free-text + live preview ────────── */}
      <main className="flex-1 flex flex-col space-y-4 min-w-0 w-full">
        {/* Text editors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Report Content</div>
            <RichTextEditor
              value={contentBody}
              onChange={setContent}
              placeholder="Free-text findings, narrative or template body…"
              ariaLabel="Report content"
            />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">Recommendations</div>
            <RichTextEditor
              value={recommendationsBody}
              onChange={setRecommendations}
              placeholder="Follow-up recommendations, counselling notes, next-scan plan…"
              ariaLabel="Recommendations"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold uppercase tracking-wide">Live Preview</span>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
          {showPreview && reportData && (
            <iframe
              key={`${examId}-${JSON.stringify(sectionInclude)}`}  // remount on toggle changes
              srcDoc={buildReportHtml(reportData)}
              className="w-full bg-white"
              style={{ height: '70vh', border: 0 }}
              title="Report preview"
            />
          )}
        </div>
      </main>

      <TemplatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        context={placeholderCtx}
      />
    </div>
  );
}

function Editor({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full px-3 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
    </label>
  );
}
