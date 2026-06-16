/**
 * BridgeLicenseQuotaModal - opens on the global Ctrl+Shift+Q binding.
 *
 * Offline recharge flow:
 *   1. Bridge creates a device/license-bound request code.
 *   2. Admin signs it outside the bridge app with the private key.
 *   3. Bridge verifies the voucher with its embedded public key and adds local
 *      offline print credit.
 */
import { useEffect, useState } from 'react';
import { CheckCircle, Copy, KeyRound, Plus, RefreshCw, X } from 'lucide-react';

type Q = { enabled: boolean; remaining: number; total: number; offlineCredit?: number };
type Status = { type?: string; daysLeft?: number | null; expiresAt?: string | null } | null;
type RequestData = {
  requestId: string;
  fingerprint: string;
  licenseKey: string;
  requestedPrints: number;
  requestedDays?: number;
  currentExpiresAt?: string | null;
  expiresAt: string;
};

export function BridgeLicenseQuotaModal() {
  const [open, setOpen] = useState(false);
  const [quota, setQuota] = useState<Q | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [requestedPrints, setRequestedPrints] = useState(100);
  const [requestCode, setRequestCode] = useState('');
  const [request, setRequest] = useState<RequestData | null>(null);
  const [voucher, setVoucher] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = window.bridgeAPI.onOpenQuotaSettings?.(() => {
      setOpen(true);
      setErr('');
      setOk('');
      setVoucher('');
      setRequestCode('');
      setRequest(null);
    });
    return () => { try { off && off(); } catch {} };
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshQuota();
  }, [open]);

  if (!open) return null;

  async function refreshQuota() {
    try {
      const q = await window.bridgeAPI.getLicenseQuota();
      setQuota(q);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load quota');
    }
    try {
      const s = await (window as any).bridgeAPI.getLicenseStatus?.();
      setStatus(s || null);
    } catch { /* status is best-effort */ }
  }

  async function createRequest() {
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const r = await window.bridgeAPI.getOfflineRechargeChallenge({ requestedPrints });
      if (!r?.ok) throw new Error('Could not create request');
      setRequestCode(r.code);
      setRequest(r.request);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create request');
    } finally {
      setBusy(false);
    }
  }

  async function applyVoucher() {
    const trimmed = voucher.trim();
    if (!trimmed) { setErr('Paste a recharge voucher first.'); return; }
    setBusy(true);
    setErr('');
    setOk('');
    try {
      const r = await window.bridgeAPI.applyOfflineRechargeVoucher(trimmed);
      if (!r?.ok) {
        setErr(`Voucher rejected: ${r?.reason || 'unknown'}`);
        return;
      }
      const bits: string[] = [];
      if ((r.added ?? 0) > 0) bits.push(`Added ${r.added} prints (balance ${r.remaining ?? 0})`);
      if (r.addedExpiry) bits.push(`License extended to ${r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : ''} (${r.daysLeft ?? 0} days left)`);
      setOk(bits.length ? bits.join('. ') + '.' : 'Recharge applied.');
      setVoucher('');
      setRequestCode('');
      setRequest(null);
      await refreshQuota();
    } catch (e: any) {
      setErr(e?.message || 'Failed to apply voucher');
    } finally {
      setBusy(false);
    }
  }

  function copyRequest() {
    if (!requestCode) return;
    navigator.clipboard?.writeText(requestCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-2xl rounded-lg bg-app-bg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-app-border bg-app-surface px-4 py-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-app-accent" />
            <h3 className="text-sm font-bold text-app-text">Offline Recharge — Prints</h3>
          </div>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-app-text-secondary hover:bg-app-hover">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded border border-app-border bg-app-surface p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Mode</div>
              <div className="mt-1 text-lg font-bold text-app-text">{quota?.enabled ? 'Counted' : 'Unlimited'}</div>
            </div>
            <div className="rounded border border-app-border bg-app-surface p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Prints left</div>
              <div className="mt-1 font-mono text-lg font-bold text-app-accent">{quota?.remaining ?? '-'}</div>
            </div>
            <div className="rounded border border-app-border bg-app-surface p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Prints total</div>
              <div className="mt-1 font-mono text-lg font-bold text-app-text">{quota?.total ?? '-'}</div>
            </div>
            <div className="rounded border border-app-border bg-app-surface p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Days left</div>
              <div className="mt-1 font-mono text-lg font-bold text-app-text">
                {status?.daysLeft ?? (status?.type === 'licensed' ? '∞' : '-')}
              </div>
            </div>
          </div>

          <div className="rounded border border-app-border p-3">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Prints to request</span>
                <input
                  type="number"
                  min={0}
                  value={requestedPrints}
                  onChange={(e) => setRequestedPrints(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-28 rounded border border-app-border bg-app-bg px-2 py-1.5 text-right font-mono text-sm text-app-text"
                />
              </label>
              <button
                onClick={createRequest}
                disabled={busy || requestedPrints < 1}
                title={requestedPrints < 1 ? 'Enter number of prints to request' : ''}
                className="flex items-center gap-1.5 rounded bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Create Request
              </button>
              {request && (
                <span className="text-xs text-app-text-secondary">
                  Expires {new Date(request.expiresAt).toLocaleString()}
                </span>
              )}
            </div>

            <textarea
              readOnly
              value={requestCode}
              placeholder="Create a request, then send this code to the admin voucher generator."
              className="h-24 w-full resize-none rounded border border-app-border bg-app-bg p-2 font-mono text-[11px] text-app-text"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={copyRequest}
                disabled={!requestCode}
                className="flex items-center gap-1 rounded border border-app-border px-2 py-1 text-xs text-app-text hover:bg-app-hover disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy Request'}
              </button>
            </div>
          </div>

          <div className="rounded border border-app-border p-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-app-text-muted">Recharge voucher</label>
            <textarea
              value={voucher}
              onChange={(e) => { setVoucher(e.target.value); setErr(''); setOk(''); }}
              placeholder="Paste OCZV1 voucher here"
              className="h-24 w-full resize-none rounded border border-app-border bg-app-bg p-2 font-mono text-[11px] text-app-text"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={applyVoucher}
                disabled={busy || !voucher.trim()}
                className="flex items-center gap-1.5 rounded bg-app-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Apply Recharge
              </button>
            </div>
          </div>

          {ok && <div className="flex items-center gap-2 rounded bg-green-500/10 px-2 py-1.5 text-xs text-green-500"><CheckCircle className="h-3.5 w-3.5" /> {ok}</div>}
          {err && <div className="rounded bg-red-500/10 px-2 py-1.5 text-xs text-red-500">{err}</div>}
        </div>
      </div>
    </div>
  );
}
