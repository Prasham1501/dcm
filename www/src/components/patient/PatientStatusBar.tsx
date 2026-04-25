import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { usePrintStore } from '@/stores/printStore';
import { PrinterModal } from '@/components/print/PrinterModal';

export function PatientStatusBar() {
  const navigate = useNavigate();
  const { filteredPatients, patients } = usePatientStore();
  const { printCountRemaining, showPrinterModal, setShowPrinterModal } = usePrintStore();

  // Compute real stats from patient data
  const totalImages = patients.reduce((sum, p) => sum + (p.filePaths?.length ?? 0), 0);
  const totalFilesSize = totalImages * 512; // rough estimate: 512KB per image
  const sizeDisplay = totalFilesSize > 1024
    ? `~${(totalFilesSize / 1024).toFixed(1)} GB`
    : `~${totalFilesSize.toFixed(0)} MB`;

  const oldestDate = patients.reduce<string | null>((oldest, p) => {
    if (!oldest) return p.studyDate;
    // Compare DD-MM-YYYY dates
    const [d1, m1, y1] = oldest.split('-').map(Number);
    const [d2, m2, y2] = p.studyDate.split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1);
    const date2 = new Date(y2, m2 - 1, d2);
    return date2 < date1 ? p.studyDate : oldest;
  }, null);

  return (
    <>
      <div className="flex items-center justify-between px-3 2xl:px-5 py-1 2xl:py-2 bg-app-statusbar-bg border-t border-app-border">
        <div className="flex items-center gap-1 2xl:gap-2">
          <button
            onClick={() => navigate('/config')}
            className="px-2 2xl:px-3 py-0.5 2xl:py-1 text-xs 2xl:text-sm border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover"
          >
            Config
          </button>
          <button
            onClick={() => setShowPrinterModal(true)}
            className="px-2 2xl:px-3 py-0.5 2xl:py-1 text-xs 2xl:text-sm border border-app-border text-app-text-secondary bg-app-bg rounded hover:bg-app-hover"
          >
            Default Printer
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs 2xl:text-sm text-app-text-secondary">
          <span>Print count left- A4: {printCountRemaining}</span>
          <span className="text-app-border">|</span>
          <span>Images occupied : {totalImages > 0 ? `${totalImages} (${sizeDisplay})` : '0'}</span>
          <span className="text-app-border">|</span>
          <span>Total patient records : {patients.length}</span>
          <span className="text-app-border">|</span>
          <span>Oldest record date : {oldestDate || 'N/A'}</span>
          <span className="text-app-border">|</span>
          <span>Login : ADMIN</span>
        </div>
      </div>

      {showPrinterModal && <PrinterModal />}
    </>
  );
}
