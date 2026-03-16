import { useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { usePrintStore } from '@/stores/printStore';

export function PatientToolbar() {
  const navigate = useNavigate();
  const { filteredPatients, loadPatients, setDateRange } = usePatientStore();
  const { printCountRemaining } = usePrintStore();
  const printedCount = filteredPatients.filter((p) => p.printed).length;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-app-border bg-app-surface">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/viewer')}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          View
        </button>
        <span className="text-app-border">|</span>
        <button
          onClick={() => navigate('/studies')}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Create Report
        </button>
        <button
          onClick={() => navigate('/studies')}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Open Report
        </button>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold text-app-accent">
          Print count left- A4: {printCountRemaining}
        </span>
        <span className="text-xs text-app-text-secondary">
          Displayed Records {filteredPatients.length}
        </span>
        <span className="text-xs text-app-text-secondary">
          Printed {printedCount}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { loadPatients(); alert('Synced successfully'); }}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Online sync
        </button>
        <button
          onClick={loadPatients}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => setDateRange('today')}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Updated today
        </button>
        <button
          onClick={() => navigate('/viewer')}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors"
        >
          Cine
        </button>
      </div>
    </div>
  );
}
