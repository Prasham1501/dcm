import { Printer, RotateCcw } from 'lucide-react';
import { usePrintStore } from '@/stores/printStore';

export function PrintHistory() {
  const { printJobs, printCountTotal, printCountUsed, printCountRemaining } = usePrintStore();

  const statusColors: Record<string, string> = {
    completed: 'bg-green-600 text-white',
    queued: 'bg-yellow-500 text-black',
    printing: 'bg-blue-500 text-white',
    failed: 'bg-red-500 text-white',
  };

  return (
    <div className="space-y-4">
      {/* Print counter summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-app-surface border border-app-border rounded text-center">
          <div className="text-2xl font-bold text-app-accent">{printCountTotal}</div>
          <div className="text-[10px] text-app-text-secondary">Total Prints</div>
        </div>
        <div className="p-3 bg-app-surface border border-app-border rounded text-center">
          <div className="text-2xl font-bold text-app-text">{printCountUsed}</div>
          <div className="text-[10px] text-app-text-secondary">Used</div>
        </div>
        <div className="p-3 bg-app-surface border border-app-border rounded text-center">
          <div className={`text-2xl font-bold ${printCountRemaining < 10 ? 'text-red-500' : 'text-green-600'}`}>
            {printCountRemaining}
          </div>
          <div className="text-[10px] text-app-text-secondary">Remaining</div>
        </div>
      </div>

      {/* Print jobs list */}
      <div>
        <h4 className="text-xs font-bold text-app-accent mb-2">Recent Print Jobs</h4>
        <div className="border border-app-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-app-header-bg border-b border-app-border">
                <th className="px-3 py-2 text-left font-bold text-app-accent">Patient</th>
                <th className="px-3 py-2 text-left font-bold text-app-accent">Layout</th>
                <th className="px-3 py-2 text-left font-bold text-app-accent">Paper</th>
                <th className="px-3 py-2 text-center font-bold text-app-accent">Copies</th>
                <th className="px-3 py-2 text-left font-bold text-app-accent">Time</th>
                <th className="px-3 py-2 text-center font-bold text-app-accent">Status</th>
                <th className="px-3 py-2 text-center font-bold text-app-accent">Action</th>
              </tr>
            </thead>
            <tbody>
              {printJobs.map((job) => (
                <tr key={job.id} className="border-b border-app-border hover:bg-app-hover">
                  <td className="px-3 py-2 text-app-text">
                    <div className="font-semibold">{job.patientName}</div>
                    <div className="text-[10px] text-app-text-muted">{job.studyDate}</div>
                  </td>
                  <td className="px-3 py-2 text-app-text">{job.layout}</td>
                  <td className="px-3 py-2 text-app-text">{job.paperSize}</td>
                  <td className="px-3 py-2 text-center text-app-text">{job.copies}</td>
                  <td className="px-3 py-2 text-app-text-muted">{job.timestamp}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColors[job.status]}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button className="p-1 text-app-text-muted hover:text-app-accent" title="Reprint">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
