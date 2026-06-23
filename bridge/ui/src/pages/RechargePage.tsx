import { useEffect, useState } from 'react';
import { Ticket, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface VoucherStatus {
  requestCode: string;
  prints: number | null;
  daysLeft: number | null;
  expiresAt: string | null;
}

const REASONS: Record<string, string> = {
  bad_format: 'That does not look like a valid voucher code.',
  invalid_code: 'Invalid or already-used voucher. Confirm your provider used the exact Request code shown below, then re-type the voucher.',
  empty_voucher: 'This voucher grants nothing.',
};

export function RechargePage() {
  const api = (window as any).bridgeAPI;
  const [status, setStatus] = useState<VoucherStatus | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refresh = async () => {
    // Force a live quota pull first so a freshly-activated/recharged license
    // shows immediately — voucherStatus() only reads the local cache.
    try { if (api?.getLicenseQuota) await api.getLicenseQuota(); } catch { /* ignore */ }
    try { if (api?.voucherStatus) setStatus(await api.voucherStatus()); } catch { /* ignore */ }
  };
  useEffect(() => {
    void refresh();
    // Main process broadcasts whenever the central or offline quota changes
    // (voucher redeem in another window, print decrement, license removal),
    // so the tile updates without needing the user to navigate away.
    let off: (() => void) | undefined;
    try { off = api?.onQuotaChanged?.(() => { void refresh(); }); } catch {}
    return () => { try { off && off(); } catch {} };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const copyRequest = async () => {
    if (!status?.requestCode) return;
    try {
      await navigator.clipboard.writeText(status.requestCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const redeem = async () => {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.redeemVoucher(c);
      if (r?.ok) {
        const parts: string[] = [];
        if (r.addedPrints) parts.push(`+${r.addedPrints} prints`);
        if (r.addedDays) parts.push(`+${r.addedDays} days`);
        setMsg({ text: `Recharge applied${parts.length ? ` (${parts.join(', ')})` : ''}.`, type: 'success' });
        setCode('');
        await refresh();
      } else {
        setMsg({ text: REASONS[r?.reason] || `Could not redeem voucher (${r?.reason || 'error'}).`, type: 'error' });
      }
    } catch (e: any) {
      setMsg({ text: e?.message || 'Redeem failed', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!api?.voucherStatus) {
    return <div className="p-6 text-sm text-app-text-secondary">Recharge is only available in the Bridge desktop app.</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-6">
      <div className="flex items-center gap-2 text-app-text">
        <Ticket className="h-5 w-5 text-app-accent" />
        <h2 className="text-base font-semibold">Recharge</h2>
      </div>
      <p className="text-xs text-app-text-secondary">
        Add print credits or extend your licence offline. Read your <strong>Request code</strong> to your
        provider; they send back a short <strong>Voucher code</strong> you enter here.
      </p>

      {/* Current balances */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-app-border bg-app-surface p-4">
          <div className="text-2xs uppercase tracking-wide text-app-text-muted">Prints left</div>
          <div className="mt-1 text-2xl font-bold text-app-text">{status?.prints ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-app-border bg-app-surface p-4">
          <div className="text-2xs uppercase tracking-wide text-app-text-muted">Days left</div>
          <div className="mt-1 text-2xl font-bold text-app-text">{status?.daysLeft ?? '—'}</div>
        </div>
      </div>

      {/* Step 1 — request code */}
      <div className="rounded-lg border border-app-border bg-app-bg p-4">
        <div className="text-xs font-semibold text-app-text-secondary">1. Send this Request code to your provider</div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded border border-app-border bg-app-surface px-3 py-2 text-lg font-bold tracking-widest text-app-accent">
            {status?.requestCode || '…'}
          </code>
          <button onClick={copyRequest} className="flex items-center gap-1 rounded border border-app-border px-3 py-2 text-xs hover:bg-app-hover">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {status?.requestCode && (
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded bg-white p-2">
              <QRCodeSVG value={status.requestCode} size={92} />
            </div>
            <p className="text-2xs text-app-text-muted">…or send a <strong>photo of this QR code</strong> — your provider can upload it instead of typing the code.</p>
          </div>
        )}
        <p className="mt-2 text-2xs text-app-text-muted">This code changes after each successful recharge.</p>
      </div>

      {/* Step 2 — voucher */}
      <div className="rounded-lg border border-app-border bg-app-bg p-4">
        <div className="text-xs font-semibold text-app-text-secondary">2. Enter the Voucher code they send back</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
            placeholder="e.g. 07T0-2VE0-HXP0"
            className="flex-1 rounded border border-app-border bg-app-surface px-3 py-2 text-lg font-bold uppercase tracking-widest text-app-text focus:border-app-accent focus:outline-none"
          />
          <button
            onClick={redeem}
            disabled={busy || !code.trim()}
            className="flex items-center gap-1 rounded bg-app-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Redeem
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded border px-3 py-2 text-xs ${
          msg.type === 'success'
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20'
            : 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20'
        }`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
