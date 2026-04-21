import { useState } from 'react';

export function ServiceTab() {
  const [settings, setSettings] = useState({
    dicomListenerEnabled: true,
    listenerPort: '11112',
    listenerAet: 'ACCURATE',
    autoImportEnabled: false,
    watchFolder: 'C:\\DICOM\\Import',
    autoDeleteAfterImport: false,
    storagePath: 'C:\\DICOM\\Storage',
    maxStorageGB: '100',
    compressionEnabled: true,
    logLevel: 'info',
    retentionDays: '365',
  });

  const update = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-app-text-secondary">
        Configure DICOM service listener and storage management settings.
      </p>

      {/* DICOM Listener */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          DICOM Listener Service
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-app-text">
            <input
              type="checkbox"
              checked={settings.dicomListenerEnabled}
              onChange={(e) => update('dicomListenerEnabled', e.target.checked)}
              className="accent-app-accent w-3.5 h-3.5"
            />
            Enable DICOM Listener (SCP)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Listener Port</label>
              <input
                type="text"
                value={settings.listenerPort}
                onChange={(e) => update('listenerPort', e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">AE Title</label>
              <input
                type="text"
                value={settings.listenerAet}
                onChange={(e) => update('listenerAet', e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Auto Import */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Auto Import (Folder Watch)
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-app-text">
            <input
              type="checkbox"
              checked={settings.autoImportEnabled}
              onChange={(e) => update('autoImportEnabled', e.target.checked)}
              className="accent-app-accent w-3.5 h-3.5"
            />
            Enable auto-import from folder
          </label>
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Watch Folder Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.watchFolder}
                onChange={(e) => update('watchFolder', e.target.value)}
                className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
              <button className="px-3 h-7 text-xs font-semibold border border-app-border text-app-text bg-app-surface rounded hover:bg-app-hover transition-colors">
                Browse
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-app-text">
            <input
              type="checkbox"
              checked={settings.autoDeleteAfterImport}
              onChange={(e) => update('autoDeleteAfterImport', e.target.checked)}
              className="accent-app-accent"
            />
            Delete files after successful import
          </label>
        </div>
      </div>

      {/* Storage */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Storage Management
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-app-text-secondary mb-1">Storage Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.storagePath}
                onChange={(e) => update('storagePath', e.target.value)}
                className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
              <button className="px-3 h-7 text-xs font-semibold border border-app-border text-app-text bg-app-surface rounded hover:bg-app-hover transition-colors">
                Browse
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Max Storage (GB)</label>
              <input
                type="text"
                value={settings.maxStorageGB}
                onChange={(e) => update('maxStorageGB', e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-text-secondary mb-1">Retention (Days)</label>
              <input
                type="text"
                value={settings.retentionDays}
                onChange={(e) => update('retentionDays', e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-app-text">
            <input
              type="checkbox"
              checked={settings.compressionEnabled}
              onChange={(e) => update('compressionEnabled', e.target.checked)}
              className="accent-app-accent"
            />
            Enable DICOM file compression
          </label>
        </div>
      </div>

      {/* Logging */}
      <div>
        <h3 className="text-sm font-bold text-app-accent mb-3 pb-1 border-b border-app-border">
          Logging
        </h3>
        <div>
          <label className="block text-xs font-semibold text-app-text-secondary mb-1">Log Level</label>
          <select
            value={settings.logLevel}
            onChange={(e) => update('logLevel', e.target.value)}
            className="w-48 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded-sm focus:border-app-accent focus:outline-none"
          >
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>
    </div>
  );
}
