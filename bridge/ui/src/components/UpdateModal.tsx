/**
 * Bridge UpdateModal — mirrors the Viewer's modal but uses bridgeAPI.
 * Non-dismissible when force_update is true. Falls back to a small banner
 * for optional updates.
 */
import { useEffect, useState } from 'react';

interface UpdateInfo {
  app: string;
  current_version: string;
  latest_version: string;
  has_update: boolean;
  force_update: boolean;
  changelog: string;
  download_url: string;
  file_size?: number;
}

export function UpdateModal() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dl, setDl]     = useState(false);
  const [msg, setMsg]   = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = (window as any).bridgeAPI;
    if (!api?.onUpdateInfo) return;
    const off = api.onUpdateInfo((i: UpdateInfo) => setInfo(i));
    // Kick a check now too — useful when the config window opens.
    api.checkForUpdate?.().then((r: UpdateInfo | null) => { if (r) setInfo(r); }).catch(() => {});
    return () => { try { off && off(); } catch {} };
  }, []);

  if (!info?.has_update) return null;
  if (dismissed && !info.force_update) return null;

  const sizeMb = info.file_size ? (info.file_size / 1024 / 1024).toFixed(1) + ' MB' : '';

  const install = async () => {
    const api = (window as any).bridgeAPI;
    if (!api?.downloadAndInstallUpdate) return;
    setDl(true); setMsg('Downloading…');
    try {
      const r = await api.downloadAndInstallUpdate(info.download_url);
      if (!r?.ok) { setDl(false); setMsg('Download failed: ' + (r?.error || 'unknown')); return; }
      setMsg('Installer launched — Bridge will close to update.');
    } catch (e: any) { setDl(false); setMsg('Failed: ' + (e?.message || e)); }
  };

  if (info.force_update) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-sm">
        <div className="bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl max-w-md w-[92vw] p-6 text-slate-100">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-red-500/20 grid place-items-center text-red-400 text-lg shrink-0">⚠</div>
            <div>
              <h2 className="text-base font-bold">Required update — Bridge v{info.latest_version}</h2>
              <p className="text-xs text-slate-400 mt-0.5">You're on v{info.current_version}. This update is mandatory.</p>
            </div>
          </div>
          {info.changelog && (
            <div className="bg-slate-800/60 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">What's new</div>
              <div className="text-xs whitespace-pre-wrap leading-relaxed">{info.changelog}</div>
            </div>
          )}
          <div className="text-[11px] text-slate-500 mb-2">Installer size: <span className="font-mono">{sizeMb}</span></div>
          <div className="text-[11px] text-slate-300 mb-3 bg-emerald-500/10 border-l-2 border-emerald-500/60 rounded px-2 py-1.5">
            <b className="text-emerald-400">Your config is safe.</b> Bridge keeps your printer slots, branding, and license intact during the update.
          </div>
          {msg && <div className="text-xs text-rose-400 mb-3">{msg}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={() => (window as any).bridgeAPI?.quitApp?.()} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs hover:bg-slate-800">Quit</button>
            <button onClick={install} disabled={dl} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold text-xs disabled:opacity-60">
              {dl ? 'Downloading…' : `Install v${info.latest_version}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-[9000] max-w-xs bg-slate-900 border border-rose-500/40 rounded-lg shadow-xl p-3 text-slate-100">
      <div className="text-xs font-bold">Bridge update available · v{info.latest_version}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{sizeMb}</div>
      {msg && <div className="text-[10px] text-rose-400 mt-1">{msg}</div>}
      <div className="flex gap-2 mt-2">
        <button onClick={install} disabled={dl} className="px-2 py-1 rounded text-[10px] font-semibold bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-60">{dl ? 'Downloading…' : 'Update'}</button>
        <button onClick={() => setDismissed(true)} className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200">Later</button>
      </div>
    </div>
  );
}
