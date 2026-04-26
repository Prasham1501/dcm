import { useState } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { FolderOpen, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export function FolderSyncBar() {
  const { folderPath, setFolderPath, scanFolder, syncing, syncError, syncProgress } = usePatientStore();
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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-app-surface border-b border-app-border">
        <FolderOpen className="w-4 h-4 text-app-accent flex-shrink-0" />
        <span className="text-xs font-semibold text-app-text-secondary flex-shrink-0">DICOM Folder:</span>
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSync(); }}
          placeholder="Paste folder path (e.g. C:\DicomData or /home/user/dicom)"
          className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none font-mono"
        />
        <button
          onClick={handleSync}
          disabled={syncing || !inputPath.trim()}
          className="px-3 py-1 text-xs font-semibold border-2 border-app-accent text-app-accent bg-app-bg rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Scanning...' : 'Sync'}
        </button>
        {syncError && (
          <div className="flex items-center gap-1 text-red-500 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span>{syncError}</span>
          </div>
        )}
        {!syncError && folderPath && !syncing && (
          <div className="flex items-center gap-1 text-green-500 text-xs">
            <CheckCircle className="w-3 h-3" />
            <span>Synced</span>
          </div>
        )}
      </div>
      {/* Progress bar during scan */}
      {syncing && syncProgress && (
        <div className="px-3 py-1 bg-app-surface border-b border-app-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-app-border rounded-full overflow-hidden">
              <div
                className="h-full bg-app-accent rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-app-text-secondary font-mono whitespace-nowrap">
              {syncProgress.processed}/{syncProgress.total} files ({progressPercent}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
