/**
 * LicenseQuotaModal — opens on the global Ctrl+Shift+Q keybinding (forwarded
 * from main.js).  Asks for the admin password, then lets the user toggle the
 * sell-by-print quota mode for the currently activated license and top up
 * the remaining counter. Backed by /license/quota on the website.
 *
 *  - Off (default): unlimited prints — sold as a software licence.
 *  - On: each print decrements the counter; viewer refuses to print at 0,
 *        warns the user at 50.
 */
import { useEffect, useState } from 'react';
import { X, Lock, Save, ToggleLeft, ToggleRight, Plus } from 'lucide-react';

const ADMIN_PIN = 'Prasham123$';

type Q = { enabled: boolean; remaining: number; total: number; valid?: boolean; reason?: string };

export function LicenseQuotaModal() {
  const [open, setOpen]       = useState(false);
  const [step, setStep]       = useState<'password' | 'panel'>('password');
  const [password, setPassword] = useState('');
  const [pwErr, setPwErr]     = useState('');
  const [data, setData]       = useState<Q | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [topUp, setTopUp]     = useState(0);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  // Subscribe to the global keybinding forwarded by main.js
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onOpenQuotaSettings) return;
    const off = api.onOpenQuotaSettings(() => {
      setOpen(true);
      setStep('password');
      setPassword('');
      setPwErr('');
      setErr('');
    });
    return () => { try { off && off(); } catch {} };
  }, []);

  useEffect(() => {
    if (!open || step !== 'panel') return;
    (async () => {
      const api = (window as any).electronAPI;
      try {
        const q: Q = await api.getLicenseQuota();
        setData(q);
        setEnabled(!!q.enabled);
        setRemaining(q.remaining || 0);
      } catch (e: any) { setErr(e?.message || 'Failed to load quota'); }
    })();
  }, [open, step]);

  if (!open) return null;

  const submitPassword = () => {
    if (password === ADMIN_PIN) { setStep('panel'); setPassword(''); }
    else { setPwErr('Incorrect password'); setPassword(''); }
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const api = (window as any).electronAPI;
      const r = await api.setLicenseQuota({
        enabled,
        remaining: remaining + (topUp || 0),
        adminPin: ADMIN_PIN,
      });
      if (!r?.ok) {
        setErr('Server rejected change: ' + (r?.reason || 'unknown'));
        setSaving(false);
        return;
      }
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-lg bg-app-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-app-border bg-app-header-bg px-4 py-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-app-accent" />
            <h3 className="text-sm font-bold text-app-text">{step === 'password' ? 'Admin password required' : 'Print Quota Settings'}</h3>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-app-text-secondary hover:bg-app-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'password' ? (
          <div className="space-y-3 p-4">
            <p className="text-xs text-app-text-secondary">Enter the admin password to change the print-quota mode for this license.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
              className="w-full rounded border border-app-border bg-app-bg px-2 py-1.5 text-sm text-app-text focus:border-app-accent focus:outline-none"
              placeholder="Password"
            />
            {pwErr && <div className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">{pwErr}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded border border-app-border bg-app-bg px-3 py-1.5 text-xs text-app-text hover:bg-app-hover">Cancel</button>
              <button onClick={submitPassword} className="rounded bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Unlock</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-4 text-sm">
            <div className="rounded border border-app-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-app-text">Quota mode</div>
                  <p className="mt-0.5 text-xs text-app-text-secondary">
                    {enabled
                      ? 'Sell-by-print: each printed page decrements the counter.'
                      : 'Unlimited (software licence): prints are not counted.'}
                  </p>
                </div>
                <button
                  onClick={() => setEnabled((v) => !v)}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
                    enabled ? 'bg-app-accent text-white' : 'bg-app-hover text-app-text-secondary'
                  }`}
                >
                  {enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {enabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            <div className={`space-y-3 rounded border border-app-border p-3 ${enabled ? '' : 'opacity-40'}`}>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-bold uppercase text-app-text-secondary">Remaining prints</label>
                <input type="number" min={0} value={remaining} disabled={!enabled}
                  onChange={(e) => setRemaining(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-28 rounded border border-app-border bg-app-bg px-2 py-1 text-right font-mono text-sm text-app-text" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-1 text-xs font-bold uppercase text-app-text-secondary">
                  <Plus className="h-3 w-3" /> Add top-up
                </label>
                <input type="number" min={0} value={topUp || ''} placeholder="0" disabled={!enabled}
                  onChange={(e) => setTopUp(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-28 rounded border border-app-border bg-app-bg px-2 py-1 text-right font-mono text-sm text-app-text" />
              </div>
              <div className="border-t border-app-border pt-2 text-xs">
                After save: <b className="text-app-text">{remaining + (topUp || 0)}</b> prints available.
                {data?.total ? <span className="ml-1 text-app-text-secondary">(lifetime total: {data.total})</span> : null}
              </div>
            </div>

            {err && <div className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">{err}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded border border-app-border bg-app-bg px-3 py-1.5 text-xs text-app-text hover:bg-app-hover">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded bg-app-accent px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save Quota'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
