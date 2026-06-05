import { useState } from 'react';
import { FileText } from 'lucide-react';
import { FormFModal } from './FormFModal';

/**
 * "Form F" button placed next to the Print button in each viewer.
 * Opens the PCPNDT Form F for the current study/patient. Works whether or not
 * the RIS is installed (the backend enriches from RIS data when present).
 */
export function FormFButton({
  patientId, patientName, studyUid, className, compact,
}: {
  patientId?: string; patientName?: string; studyUid?: string; className?: string; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const base = compact
    ? 'flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors'
    : 'flex items-center gap-1 2xl:gap-1.5 px-2.5 2xl:px-3.5 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="PCPNDT Form F" className={className ?? base}>
        <FileText className="w-3.5 h-3.5 2xl:w-4.5 2xl:h-4.5" />
        Form F
      </button>
      {open && (
        <FormFModal patientId={patientId} patientName={patientName} studyUid={studyUid} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
