import { useEffect, useState } from 'react';
import { backupService, type BackupInfo } from '@/services/backupService';
import { useUIStore } from '@/stores/uiStore';

/**
 * BackupBrowserModal — lists local backups (api/backup/*) and lets the
 * operator create a new one, restore, or delete. Opened from the
 * "Browse Backup" button on the patient status bar.
 */
export function BackupBrowserModal({ onClose }: { onClose: () => void }) {
  const addToast = useUIStore((s) => s.addToast);
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const list = await backupService.listBackups();
      setBackups(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load backups');
      setBackups([]);
    }
  };

  useEffect(() => { load(); }, []);

  const createNow = async () => {
    setBusy(true);
    try {
      await backupService.backupNow();
      addToast('Backup created', 'success', 3000);
      await load();
    } catch (e: any) {
      addToast(`Backup failed: ${e?.message || 'error'}`, 'error', 5000);
    } finally { setBusy(false); }
  };

  const restore = async (b: BackupInfo) => {
    if (!confirm(`Restore from "${b.filename}"? This overwrites current data with the backup snapshot.`)) return;
    setBusy(true);
    try {
      await backupService.restore(b.id);
      addToast('Restore complete — reloading…', 'success', 3000);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e: any) {
      addToast(`Restore failed: ${e?.message || 'error'}`, 'error', 5000);
      setBusy(false);
    }
  };

  const remove = async (b: BackupInfo) => {
    if (!confirm(`Delete backup "${b.filename}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await backupService.deleteBackup(b.id);
      addToast('Backup deleted', 'success', 2500);
      await load();
    } catch (e: any) {
      addToast(`Delete failed: ${e?.message || 'error'}`, 'error', 5000);
    } finally { setBusy(false); }
  };

  const fmtSize = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-app-bg border border-app-border rounded-lg shadow-xl w-[640px] max-w-[92vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border">
          <h3 className="text-base font-semibold text-app-text">Browse Backups</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={createNow}
              disabled={busy}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-app-accent text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Working…' : '+ Backup Now'}
            </button>
            <button onClick={onClose} className="px-2 py-1 text-app-text-secondary hover:text-app-text text-lg leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <div className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-500 mb-2">{error}</div>}
          {backups === null ? (
            <div className="p-6 text-center text-sm text-app-text-secondary">Loading…</div>
          ) : backups.length === 0 ? (
            <div className="p-6 text-center text-sm text-app-text-secondary">
              No backups yet. Click <b>+ Backup Now</b> to create one.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-app-header-bg text-app-text-secondary">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-semibold">Backup</th>
                  <th className="px-2 py-1.5 font-semibold">Created</th>
                  <th className="px-2 py-1.5 font-semibold">Size</th>
                  <th className="px-2 py-1.5 font-semibold">Studies</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-t border-app-border">
                    <td className="px-2 py-1.5 font-mono truncate max-w-[200px]">{b.filename}</td>
                    <td className="px-2 py-1.5">{b.created_at}</td>
                    <td className="px-2 py-1.5">{fmtSize(b.size || 0)}</td>
                    <td className="px-2 py-1.5">{b.study_count ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => restore(b)} disabled={busy || b.status !== 'completed'}
                        className="px-2 py-0.5 mr-1 text-[10px] rounded border border-app-border hover:bg-app-hover disabled:opacity-40"
                      >Restore</button>
                      <button
                        onClick={() => remove(b)} disabled={busy}
                        className="px-2 py-0.5 text-[10px] rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
