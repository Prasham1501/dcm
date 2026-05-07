/**
 * Mounts the picker modal globally.  Drop `<ReportRouterHost />` once at the
 * top of any page that uses the router (typically PatientListPage).
 */
import { useReportRouterStore } from './reportRouterStore';
import { ReportTypePickerModal } from './ReportTypePickerModal';
import { useReportRouter } from './useReportRouter';

export function ReportRouterHost() {
  const { open, mode, patient, candidates, preselectedId, existingCounts, close } = useReportRouterStore();
  const { handlePick } = useReportRouter();

  if (!open || !patient) return null;

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
        close();
        handlePick(type, patient, mode);
      }}
      onClose={close}
    />
  );
}
