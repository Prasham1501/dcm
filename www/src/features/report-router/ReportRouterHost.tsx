/**
 * Mounts the report-router picker globally. Two-step UX:
 *   step 'type'     → ReportTypePickerModal (Fetal / General Radiology / …)
 *   step 'template' → TemplatePickerModal   (doctor's saved templates + Blank)
 *
 * In 'open' mode the template step is skipped (we're opening an existing
 * report, not creating a new one).
 */
import { useReportRouterStore } from './reportRouterStore';
import { ReportTypePickerModal } from './ReportTypePickerModal';
import { TemplatePickerModal } from './TemplatePickerModal';
import { useReportRouter } from './useReportRouter';
import { useReportStore } from '@/stores/reportStore';
import { getReportType } from './registry';

export function ReportRouterHost() {
  const {
    open, mode, step, selectedTypeId,
    patient, candidates, preselectedId, existingCounts,
    goToTemplateStep, backToTypeStep, close,
  } = useReportRouterStore();
  const { handlePick } = useReportRouter();
  const setPendingTemplate = useReportStore((s) => s.setPendingTemplate);

  if (!open || !patient) return null;

  // ── Step 1: pick a report type ────────────────────────────────────────
  if (step === 'type') {
    const title = mode === 'create' ? 'Create report' : 'Open report';
    const subtitle =
      mode === 'create'
        ? `What kind of report would you like to create for ${patient.patientName}?`
        : `${patient.patientName} has reports of more than one type. Which one would you like to open?`;

    return (
      <ReportTypePickerModal
        title={title}
        subtitle={subtitle}
        candidates={candidates}
        preselectedId={preselectedId}
        filterByExisting={mode === 'open'}
        existingCounts={existingCounts}
        onPick={(type) => {
          if (mode === 'open') {
            // 'open' goes straight to the existing report — no template step.
            close();
            handlePick(type, patient, mode);
            return;
          }
          // 'create' → show templates for this type before opening the editor.
          goToTemplateStep(type.id);
        }}
        onClose={close}
      />
    );
  }

  // ── Step 2: pick a template (or Blank) ────────────────────────────────
  const type = selectedTypeId ? getReportType(selectedTypeId) : null;
  if (!type) return null;

  return (
    <TemplatePickerModal
      typeId={type.id}
      typeName={type.name}
      patientName={patient.patientName}
      onBack={backToTypeStep}
      onClose={close}
      onPick={(templateId) => {
        setPendingTemplate(templateId);   // editor reads this on mount
        close();
        handlePick(type, patient, 'create');
      }}
    />
  );
}
