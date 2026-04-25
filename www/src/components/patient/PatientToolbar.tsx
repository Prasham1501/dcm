import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { usePrintStore } from '@/stores/printStore';
import { useReportStore } from '@/stores/reportStore';

export function PatientToolbar() {
  const navigate = useNavigate();
  const { filteredPatients, selectedPatient, loadPatients } = usePatientStore();
  const { printCountRemaining } = usePrintStore();
  const openReportEditor = useReportStore((s) => s.openReportEditor);
  const printedCount = filteredPatients.filter((p) => p.printed).length;

  const handleCreateReport = async () => {
    const p = selectedPatient;
    if (!p) { alert('Select a patient first'); return; }
    if (!p.filePaths || p.filePaths.length === 0) { alert('No images to view'); return; }

    // Store launch data for viewer and report editor
    localStorage.setItem('viewer-launch', JSON.stringify({
      patientName: p.patientName, patientId: p.patientId,
      studyDate: p.studyDate, filePaths: p.filePaths, timestamp: Date.now(),
    }));
    localStorage.setItem('report-launch', JSON.stringify({
      patientName: p.patientName, patientId: p.patientId || p.id,
      studyDate: p.studyDate, timestamp: Date.now(),
    }));

    const api = (window as any).electronAPI;
    if (api?.openViewerWithReport) {
      try {
        await api.openViewerWithReport({
          isPortrait: false, imageCount: p.filePaths.length, cols: 2, rows: 2,
        });
        return;
      } catch (e) { console.warn('Failed to open dual windows:', e); }
    }
    // Fallback: open report modal + navigate to viewer
    openReportEditor(p.id, p.patientName);
    navigate('/cr-viewer');
  };

  return (
    <div className="flex items-center justify-between px-3 2xl:px-5 py-1.5 2xl:py-2.5 border-b border-app-border bg-app-surface">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCreateReport}
          className="px-3 2xl:px-4 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Create Report
        </button>
        <button
          onClick={() => navigate('/studies')}
          className="px-3 2xl:px-4 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Open Report
        </button>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <span className="text-xs 2xl:text-sm font-semibold text-app-accent">
          Print count left- A4: {printCountRemaining}
        </span>
        <span className="text-xs 2xl:text-sm text-app-text-secondary">
          Displayed Records {filteredPatients.length}
        </span>
        <span className="text-xs 2xl:text-sm text-app-text-secondary">
          Printed {printedCount}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <button
          onClick={loadPatients}
          className="px-3 2xl:px-4 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
