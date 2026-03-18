import { useEffect, useState } from 'react';
import { Wifi, Copy, RefreshCw, Folder } from 'lucide-react';

export function NetworkReceiverTab() {
  const [config, setConfig] = useState<{ path: string; port: number; ip: string } | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadConfig();
    loadFiles();
    // Auto-refresh files every 5 seconds
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConfig = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('get-network-dicom-path');
      if (result.success) {
        // Get local IP
        const hostname = window.location.hostname;
        setConfig({
          path: result.path,
          port: result.port,
          ip: hostname === 'localhost' ? '192.168.x.x' : hostname
        });
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  const loadFiles = async () => {
    try {
      const result = await (window as any).electronAPI.invoke('get-received-dicom-files');
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
    const text = `IP: ${config.ip}\nPort: ${config.port}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = async () => {
    if (!config) return;
    try {
      await (window as any).electronAPI.invoke('open-folder', config.path);
    } catch (e) {
      console.error('Error opening folder:', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-app-border">
        <Wifi className="w-5 h-5 text-app-accent" />
        <div>
          <h3 className="text-sm font-bold text-app-text">Network DICOM Receiver</h3>
          <p className="text-xs text-app-text-secondary">Receive DICOM files from your USG/network devices</p>
        </div>
      </div>

      {/* Configuration Info */}
      {config && (
        <div className="bg-app-surface border border-app-border rounded p-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-app-text-secondary block mb-1">Network Address</label>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-black rounded px-2 py-1.5 text-green-400 flex-1 font-mono">
                {config.ip}:{config.port}
              </code>
              <button
                onClick={handleCopyConfig}
                className="px-3 py-1.5 text-xs font-semibold border border-app-accent text-app-accent hover:bg-app-accent hover:text-white rounded transition-colors"
              >
                {copied ? '✓ Copied' : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[11px] text-app-text-muted mt-2">
              Use this address to configure your USG machine to send DICOM files to this computer
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-app-text-secondary block mb-1">Storage Location</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={config.path}
                readOnly
                className="text-xs bg-black rounded px-2 py-1.5 text-gray-400 flex-1 font-mono"
              />
              <button
                onClick={handleOpenFolder}
                className="px-3 py-1.5 text-xs font-semibold border border-app-accent text-app-accent hover:bg-app-accent hover:text-white rounded transition-colors"
              >
                <Folder className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="bg-app-surface border border-app-border rounded p-4 space-y-2">
        <h4 className="text-xs font-bold text-app-text">Setup Instructions</h4>
        <ol className="text-[11px] text-app-text-secondary space-y-1 list-decimal list-inside">
          <li>On your USG machine, go to Settings → Network</li>
          <li>Set the DICOM receiver IP address to: <code className="text-app-accent">{config?.ip}</code></li>
          <li>Set the DICOM receiver port to: <code className="text-app-accent">{config?.port}</code></li>
          <li>Make sure both machines are on the same WiFi network</li>
          <li>Send DICOM images from your USG machine</li>
          <li>Files will automatically appear in the list below</li>
        </ol>
      </div>

      {/* Received Files */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-app-text">Received Files ({files.length})</label>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-1 text-[11px] font-semibold border border-app-accent text-app-accent hover:bg-app-accent hover:text-white rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-8 text-app-text-muted text-xs">
            <p>No DICOM files received yet</p>
            <p className="text-[10px] mt-1">Files will appear here when your USG sends them</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-auto">
            {files.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 bg-black rounded border border-app-border/50 hover:border-app-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-app-text truncate font-mono">{file.name}</p>
                  <p className="text-[10px] text-app-text-muted">
                    {(file.size / 1024).toFixed(1)} KB • {new Date(file.mtime).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-green-900/20 border border-green-800 rounded p-3">
        <p className="text-xs text-green-400">
          ✓ Network receiver is active and listening for incoming DICOM files
        </p>
      </div>
    </div>
  );
}
