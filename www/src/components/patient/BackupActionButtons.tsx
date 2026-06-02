/**
 * BackupActionButtons — Backup-now + Browse-backups quick actions for the
 * patient list action bar. Wraps the shared cloudBackup helpers; the same
 * backend that powers the Cloud settings tab is used here.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, FolderOpen, Loader2, X, Download } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useCloudStore } from '@/stores/cloudStore';
import { runBackup, listBackups, downloadBackup, type CloudBundleEntry } from '@/lib/cloudBackup';

export function BackupActionButtons() {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const provider = useCloudStore((s) => s.provider);
  const accessToken = useCloudStore((s) => s.accessToken);
  const configured = provider !== 'none' && accessToken.trim().length > 0;

  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [listing, setListing] = useState(false);
  const [entries, setEntries] = useState<CloudBundleEntry[] | null>(null);

  const goToCloudSettings = () => {
    addToast('Open Settings → Cloud to pick a provider and paste an access token.', 'info', 4000);
    navigate('/config');
  };

  const handleBackup = async () => {
    if (!configured) { goToCloudSettings(); return; }
    setBusy(true);
    try {
      const data = await runBackup();
      const c = data.counts || {};
      const total = (c.reports ?? 0) + (c.dicom ?? 0) + (c.studies ?? 0) + (c.templates ?? 0) + (c.branding ?? 0);
      const bytes = data.bytes ?? 0;
      const sizeStr = bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : (bytes / 1024).toFixed(1) + ' KB';
      addToast(`Backup uploaded: ${data.bundle_name} (${sizeStr} · ${total} items)`, 'success', 5000);
    } catch (e: any) {
      addToast(`Backup failed: ${e?.message || 'Unknown error'}`, 'error', 5000);
    } finally {
      setBusy(false);
    }
  };

  const handleBrowse = async () => {
    if (!configured) { goToCloudSettings(); return; }
    setBrowsing(true);
    setListing(true);
    try {
      const list = await listBackups();
      setEntries(list);
    } catch (e: any) {
      addToast(`Could not list backups: ${e?.message || 'Unknown error'}`, 'error', 4000);
      setBrowsing(false);
    } finally {
      setListing(false);
    }
  };

  const handleDownload = async (entry: CloudBundleEntry) => {
    try {
      await downloadBackup(entry.path, entry.name);
      addToast(`Downloaded ${entry.name}`, 'success', 3000);
    } catch (e: any) {
      addToast(`Download failed: ${e?.message || 'Unknown error'}`, 'error', 4000);
    }
  };

  return (
    <>
      <button
        onClick={handleBackup}
        disabled={busy}
        className="px-3 2xl:px-4 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 rounded transition-colors border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white disabled:opacity-60 flex items-center gap-1"
        title={configured ? 'Run cloud backup now' : 'Configure cloud backup in Settings → Cloud'}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
        Backup
      </button>
      <button
        onClick={handleBrowse}
        className="px-3 2xl:px-4 py-1 2xl:py-1.5 text-xs 2xl:text-sm font-semibold border-2 rounded transition-colors border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white flex items-center gap-1"
        title={configured ? 'Browse and download cloud backups' : 'Configure cloud backup first'}
      >
        <FolderOpen className="w-3.5 h-3.5" />
        Browse Backup
      </button>

      {browsing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setBrowsing(false)}
        >
          <div
            className="bg-app-surface border border-app-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
              <div className="flex items-center gap-2 text-app-text font-semibold">
                <FolderOpen className="w-4 h-4 text-app-accent" />
                Cloud backups
                <span className="text-xs text-app-text-secondary">({provider})</span>
              </div>
              <button onClick={() => setBrowsing(false)} className="p-1 hover:bg-app-hover rounded">
                <X className="w-4 h-4 text-app-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {listing && (
                <div className="flex items-center gap-2 text-app-text-secondary text-sm p-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading bundles…
                </div>
              )}
              {!listing && entries && entries.length === 0 && (
                <div className="text-app-text-secondary text-sm p-4">
                  No bundles in <code>{useCloudStore.getState().remoteFolder || '/dcm-backups'}</code>.
                </div>
              )}
              {!listing && entries && entries.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-app-text-secondary border-b border-app-border">
                      <th className="px-2 py-1">Bundle</th>
                      <th className="px-2 py-1">Modified</th>
                      <th className="px-2 py-1 text-right">Size</th>
                      <th className="px-2 py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.path} className="border-b border-app-border/40 hover:bg-app-hover">
                        <td className="px-2 py-1 font-mono text-app-text">{e.name}</td>
                        <td className="px-2 py-1 text-app-text-secondary">{e.modified || '—'}</td>
                        <td className="px-2 py-1 text-right text-app-text-secondary">
                          {e.size >= 1024 * 1024
                            ? (e.size / 1024 / 1024).toFixed(2) + ' MB'
                            : (e.size / 1024).toFixed(1) + ' KB'}
                        </td>
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => handleDownload(e)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
