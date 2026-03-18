import { useState } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { FolderOpen, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export function FolderSyncBar() {
  const { folderPath, setFolderPath, scanFolder, syncing, syncError } = usePatientStore();
  const [inputPath, setInputPath] = useState(folderPath || '');

  const handleSync = () => {
    const trimmed = inputPath.trim();
    if (!trimmed) return;
    scanFolder(trimmed);
  };

  return (
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
  );
}
