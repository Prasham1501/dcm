import { useEffect, useState } from 'react';
import { Wifi, Copy, RefreshCw, Folder, Power, AlertCircle } from 'lucide-react';

interface NetworkConfig {
  path: string;
  port: number;
  ip: string;
  aet: string;
  isRunning: boolean;
}

export function NetworkReceiverTab() {
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [editPath, setEditPath] = useState('');

  useEffect(() => {
    const electron = (window as any).electronAPI;
    setIsElectron(!!electron?.isElectron || !!electron?.invoke);
    if (electron?.isElectron || electron?.invoke) {
      loadConfig();
      loadFiles();
      const interval = setInterval(loadFiles, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const loadConfig = async () => {
    try {
      const api = (window as any).electronAPI;
      const result = api.getNetworkDicomPath
        ? await api.getNetworkDicomPath()
        : await api.invoke('get-network-dicom-path');
      if (result.success) {
        setConfig({
          path: result.path,
          port: result.port,
          ip: result.ip || '127.0.0.1',
          aet: result.aet || 'MEDIVIEW',
          isRunning: result.isRunning ?? true,
        });
        setEditPath(result.path);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  const loadFiles = async () => {
    try {
      const api = (window as any).electronAPI;
      const result = api.getReceivedDicomFiles
        ? await api.getReceivedDicomFiles()
        : await api.invoke('get-received-dicom-files');
      if (result.success) {
        setFiles(result.files.sort((a: any, b: any) =>
          new Date(b.mtime).getTime() - new Date(a.mtime).getTime()
        ));
      }
    } catch (e) {
      console.error('Error loading files:', e);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadFiles();
    setLoading(false);
  };

  const handleCopyConfig = () => {
    if (!config) return;
    const text = `IP: ${config.ip}\nPort: ${config.port}\nAE Title: ${config.aet}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = async () => {
    if (!config) return;
    try {
      const api = (window as any).electronAPI;
      api.openFolder
        ? await api.openFolder(config.path)
        : await api.invoke('open-folder', config.path);
    } catch (e) {
      console.error('Error opening folder:', e);
    }
  };

  const handleUpdatePath = async () => {
    if (!editPath.trim()) return;
    try {
      const api = (window as any).electronAPI;
      const result = api.setNetworkDicomPath
        ? await api.setNetworkDicomPath(editPath.trim())
        : await api.invoke('set-network-dicom-path', editPath.trim());
      if (result.success) {
        setStatusMsg('Storage path updated successfully');
        await loadConfig();
      } else {
        setStatusMsg('Failed: ' + result.error);
      }
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg('Error: ' + e.message);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleRestart = async () => {
    try {
      const api = (window as any).electronAPI;
      const result = api.restartNetworkReceiver
        ? await api.restartNetworkReceiver()
        : await api.invoke('restart-network-receiver');
      if (result.success) {
        setStatusMsg('Network receiver restarted on port ' + result.port);
        await loadConfig();
      } else {
        setStatusMsg('Failed to restart: ' + result.error);
      }
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e: any) {
      setStatusMsg('Error: ' + e.message);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  if (!isElectron) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-app-border">
          <Wifi className="w-5 h-5 text-app-accent" />
          <div>
            <h3 className="text-sm font-bold text-app-text">Network DICOM Receiver</h3>
            <p className="text-xs text-app-text-secondary">Receive DICOM files from network devices</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-3 bg-yellow-900/20 border border-yellow-700 rounded text-xs text-yellow-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Network DICOM receiver is only available in the desktop (Electron) version.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-app-border">
        <Wifi className="w-5 h-5 text-app-accent" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-app-text">Network DICOM Receiver</h3>
          <p className="text-xs text-app-text-secondary">Receive DICOM files from USG machines and network devices</p>
        </div>
        <button onClick={handleRestart} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors">
          <Power className="w-3 h-3" /> Restart
        </button>
      </div>

      {statusMsg && (
        <div className="px-3 py-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          {statusMsg}
        </div>
      )}

      {/* Receiver Configuration */}
      {config && (
        <div>
          <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Receiver Configuration</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">IP Address</label>
              <div className="flex items-center gap-1">
                <input type="text" value={config.ip} readOnly className="w-full h-7 px-2 text-xs border border-app-border bg-app-surface text-app-text rounded-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Port</label>
              <input type="text" value={config.port} readOnly className="w-full h-7 px-2 text-xs border border-app-border bg-app-surface text-app-text rounded-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title</label>
              <input type="text" value={config.aet} readOnly className="w-full h-7 px-2 text-xs border border-app-border bg-app-surface text-app-text rounded-sm font-mono" />
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <label className="block text-xs font-semibold text-app-text-secondary whitespace-nowrap">Status:</label>
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-600 font-semibold">Active &amp; Listening</span>
            <button onClick={handleCopyConfig} className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors">
              <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy Config'}
            </button>
          </div>

          {/* Storage Path */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Storage Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editPath}
                onChange={(e) => setEditPath(e.target.value)}
                className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm font-mono focus:border-app-accent focus:outline-none"
              />
              <button onClick={handleOpenFolder} className="px-2 h-7 text-xs border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors" title="Open folder">
                <Folder className="w-3.5 h-3.5" />
              </button>
              {editPath !== config.path && (
                <button onClick={handleUpdatePath} className="px-3 h-7 text-xs font-semibold border-2 border-green-600 text-green-600 rounded hover:bg-green-600 hover:text-white transition-colors">
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">Device Setup Instructions</h3>
        <ol className="text-[11px] text-app-text-secondary space-y-1.5 list-decimal list-inside">
          <li>On your USG/DICOM device, go to <strong>Settings → DICOM Network</strong></li>
          <li>Set the destination IP address to: <code className="text-app-accent font-mono bg-app-surface px-1 rounded">{config?.ip || '...'}</code></li>
          <li>Set the destination port to: <code className="text-app-accent font-mono bg-app-surface px-1 rounded">{config?.port || '...'}</code></li>
          <li>Set the AE Title to: <code className="text-app-accent font-mono bg-app-surface px-1 rounded">{config?.aet || 'MEDIVIEW'}</code></li>
          <li>Ensure both machines are on the <strong>same network</strong> (LAN/WiFi)</li>
          <li>Send DICOM images from the device — files appear below automatically</li>
        </ol>
      </div>

      {/* Received Files */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-2 pb-1 border-b border-app-border flex items-center justify-between">
          <span>Received Files ({files.length})</span>
          <button onClick={handleRefresh} disabled={loading} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </h3>

        {files.length === 0 ? (
          <div className="text-center py-6 text-app-text-muted text-xs border border-dashed border-app-border rounded">
            <p>No DICOM files received yet</p>
            <p className="text-[10px] mt-1">Files will appear here when your device sends them</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[160px] overflow-auto">
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between px-3 py-1.5 bg-app-surface rounded border border-app-border/50 hover:border-app-accent/50 transition-colors text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-app-text truncate font-mono text-[11px]">{file.name}</p>
                  <p className="text-[10px] text-app-text-muted">
                    {(file.size / 1024).toFixed(1)} KB &middot; {new Date(file.mtime).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
