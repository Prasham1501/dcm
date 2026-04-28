import { useState } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { FolderOpen, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export function FolderSyncBar() {
  const { folderPath, setFolderPath, scanFolder, syncing, syncError, syncProgress, loadPatients } = usePatientStore();
  const [inputPath, setInputPath] = useState(folderPath || '');

  const handleSync = () => {
    const trimmed = inputPath.trim();
    if (!trimmed) return;
    scanFolder(trimmed);
  };

  const progressPercent = syncProgress && syncProgress.total > 0
    ? Math.round((syncProgress.processed / syncProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-app-surface border-b border-app-border flex-wrap">
        {/* Folder path - limited width */}
        <FolderOpen className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSync(); }}
          placeholder="DICOM folder path..."
          className="flex-1 min-w-[10rem] h-6 px-2 text-[11px] border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none font-mono"
        />
        <button
          onClick={handleSync}
          disabled={syncing || !inputPath.trim()}
          className="px-2 py-0.5 text-[11px] font-semibold border border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </button>
        <button
          onClick={loadPatients}
          className="px-2 py-0.5 text-[11px] font-semibold border border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors flex-shrink-0"
        >
          Refresh
        </button>
        {syncError && (
          <div className="flex items-center gap-1 text-red-500 text-[10px]">
            <AlertCircle className="w-3 h-3" />
            <span>{syncError}</span>
          </div>
        )}
        {!syncError && folderPath && !syncing && (
          <div className="flex items-center gap-1 text-green-500 text-[10px]">
            <CheckCircle className="w-3 h-3" />
          </div>
        )}


      </div>
      {/* Progress bar during scan */}
      {syncing && syncProgress && (
        <div className="px-2 py-0.5 bg-app-surface border-b border-app-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-app-border rounded-full overflow-hidden">
              <div
                className="h-full bg-app-accent rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-app-text-secondary font-mono whitespace-nowrap">
              {syncProgress.processed}/{syncProgress.total} ({progressPercent}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
