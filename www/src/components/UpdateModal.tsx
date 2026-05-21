/**
 * UpdateModal — non-dismissible when the new release is marked force_update.
 *
 * Talks to the Electron main process via `window.electronAPI`:
 *   • checkForUpdate(): kicks a fresh poll.
 *   • onUpdateInfo(cb):  subscribes to push updates from main.
 *   • downloadAndInstallUpdate(url): main fetches the .exe, opens it (UAC),
 *     then quits the app so the installer can replace it on disk.
 *
 * Behaviour:
 *   • has_update=false → render nothing.
 *   • has_update=true && force_update=false → small bottom-right toast
 *     with an Update button. User can ignore for now.
 *   • has_update=true && force_update=true  → full-screen non-dismissible
 *     modal. Update or quit are the only choices.
 */
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface UpdateInfo {
  app: string;
  current_version: string;
  latest_version: string;
  has_update: boolean;
  force_update: boolean;
  changelog: string;
  download_url: string;
  file_size?: number;
  released_at?: string;
}

export function UpdateModal() {
  const [info, setInfo]       = useState<UpdateInfo | null>(null);
  const [downloading, setDl]  = useState(false);
  const [progressMsg, setMsg] = useState('');
  const [dismissed, setDism]  = useState(false);

  const refresh = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.checkForUpdate) return;
    try {
      const r = await api.checkForUpdate();
      if (r) setInfo(r);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onUpdateInfo) return;
    // Subscribe to push notifications from main
    const off = api.onUpdateInfo((i: UpdateInfo) => setInfo(i));
    // Also kick a fresh check
    refresh();
    return () => { try { off && off(); } catch {} };
  }, [refresh]);

  if (!info || !info.has_update) return null;
  if (dismissed && !info.force_update) return null;

  const fmtBytes = (n?: number) => n ? (n / 1024 / 1024).toFixed(1) + ' MB' : '';

  const install = async () => {
    const api = (window as any).electronAPI;
    if (!api?.downloadAndInstallUpdate) return;
    setDl(true);
    setMsg('Downloading installer…');
    try {
      const r = await api.downloadAndInstallUpdate(info.download_url);
      if (!r?.ok) {
        setDl(false);
        setMsg('Download failed: ' + (r?.error || 'unknown') + '. Try again or open the website.');
        return;
      }
      setMsg('Installer launched — the app will close so it can update.');
    } catch (e: any) {
      setDl(false);
      setMsg('Failed: ' + (e?.message || e));
    }
  };

  // ── Forced full-screen modal ───────────────────────────────────────────
  if (info.force_update) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-sm">
        <div className="bg-app-bg border border-red-500/40 rounded-xl shadow-2xl max-w-lg w-[92vw] p-7">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 grid place-items-center text-red-400 text-xl shrink-0">⚠</div>
            <div>
              <h2 className="text-lg font-bold text-app-text">Required update — Mediview v{info.latest_version}</h2>
              <p className="text-sm text-app-text-secondary mt-0.5">You're on v{info.current_version}. This update is mandatory before you can continue using the application.</p>
            </div>
          </div>

          {info.changelog && (
            <div className="bg-app-hover rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest text-app-text-secondary font-semibold mb-1.5">What's new</div>
              <div className="text-xs text-app-text whitespace-pre-wrap leading-relaxed">{info.changelog}</div>
            </div>
          )}

          <div className="text-xs text-app-text-secondary mb-2">
            Installer size: <span className="font-mono">{fmtBytes(info.file_size)}</span>
          </div>
          <div className="text-[11px] text-app-text-secondary mb-4 bg-app-hover rounded p-2 border-l-2 border-emerald-500/60">
            <b className="text-emerald-500">Your data is safe.</b> The installer keeps your license, settings, reports,
            patient data, and database intact. Updates only replace the application files.
          </div>

          {progressMsg && <div className="text-xs text-app-accent mb-3">{progressMsg}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={() => (window as any).electronAPI?.quitApp?.() || window.close()}
              className="px-4 py-2 rounded-lg border border-app-border text-app-text-secondary text-sm hover:bg-app-hover">
              Quit
            </button>
            <button onClick={install} disabled={downloading}
              className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-sm disabled:opacity-60">
              {downloading ? 'Downloading…' : `Update to v${info.latest_version}`}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Soft toast (optional update) ───────────────────────────────────────
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[9000] max-w-sm bg-app-bg border border-app-accent/40 rounded-lg shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-app-accent/15 grid place-items-center text-app-accent text-sm shrink-0">↑</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-app-text">Update available: v{info.latest_version}</div>
          <div className="text-[11px] text-app-text-secondary mt-0.5">You're on v{info.current_version} · {fmtBytes(info.file_size)}</div>
          {info.changelog && <div className="text-[11px] text-app-text-secondary mt-1 line-clamp-3 whitespace-pre-wrap">{info.changelog}</div>}
          {progressMsg && <div className="text-[11px] text-app-accent mt-2">{progressMsg}</div>}
          <div className="flex gap-2 mt-2.5">
            <button onClick={install} disabled={downloading}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-app-accent text-white hover:brightness-110 disabled:opacity-60">
              {downloading ? 'Downloading…' : 'Update now'}
            </button>
            <button onClick={() => setDism(true)}
              className="px-2.5 py-1 rounded text-[11px] text-app-text-secondary hover:text-app-text">
              Later
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
