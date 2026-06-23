import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePrintStore } from '../../stores/printStore';

interface VoucherStatus {
  requestCode: string;
  prints: number | null;
  daysLeft: number | null;
}

const REASONS: Record<string, string> = {
  bad_format: 'That does not look like a valid voucher code.',
  invalid_code: 'Invalid or already-used voucher. Confirm your provider used the exact Request code shown below, then re-type the voucher.',
  empty_voucher: 'This voucher grants nothing.',
};

export function RechargeTab() {
  const api = (window as any).electronAPI;
  const fetchPrintCount = usePrintStore((s) => s.fetchPrintCount);
  const [status, setStatus] = useState<VoucherStatus | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refresh = async () => {
    // Force a live server pull first so a freshly-activated license shows
    // its prints immediately — voucherStatus() only reads the local cache,
    // and that cache stays at 0 until the next minute's periodic poll.
    try { if (api?.getLicenseQuota) await api.getLicenseQuota(); } catch { /* ignore */ }
    try { if (api?.voucherStatus) setStatus(await api.voucherStatus()); } catch { /* ignore */ }
  };
  useEffect(() => {
    void refresh();
    // Auto-refresh the tile whenever main.js pushes a quota change (voucher
    // redeem in another window, print decrement, etc.) so the displayed
    // count never drifts from the actual balance.
    let off: (() => void) | undefined;
    try { off = api?.onQuotaChanged?.(() => { void refresh(); }); } catch {}
    return () => { try { off && off(); } catch {} };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const copyRequest = async () => {
    if (!status?.requestCode) return;
    try { await navigator.clipboard.writeText(status.requestCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
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
        // Also nudge the global print-count store so the header and every
        // print-preview pane reflect the new balance without a window refresh.
        try { await fetchPrintCount(); } catch {}
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
    return <div className="p-4 text-sm text-app-text-secondary">Recharge is only available in the desktop app.</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-text-secondary">
        Add print credits or extend your licence offline. Read your <strong>Request code</strong> to your provider
        (or send a photo of the QR); they send back a short <strong>Voucher code</strong> you enter here.
      </p>

      <div className="flex gap-3">
        <div className="flex-1 rounded border border-app-border bg-app-bg p-3">
          <div className="text-[10px] uppercase tracking-wide text-app-text-muted">Prints left</div>
          <div className="mt-1 text-xl font-bold text-app-text">{status?.prints ?? '—'}</div>
        </div>
        <div className="flex-1 rounded border border-app-border bg-app-bg p-3">
          <div className="text-[10px] uppercase tracking-wide text-app-text-muted">Days left</div>
          <div className="mt-1 text-xl font-bold text-app-text">{status?.daysLeft ?? '—'}</div>
        </div>
      </div>

      {/* Step 1 — request code */}
      <div className="rounded border border-app-border bg-app-bg p-3">
        <div className="text-xs font-semibold text-app-text-secondary">1. Send this Request code to your provider</div>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded border border-app-border bg-app-surface px-3 py-2 text-base font-bold tracking-widest text-app-accent">{status?.requestCode || '…'}</code>
          <button onClick={copyRequest} className="rounded border border-app-border px-3 py-2 text-xs hover:bg-app-hover">{copied ? 'Copied' : 'Copy'}</button>
        </div>
        {status?.requestCode && (
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded bg-white p-2"><QRCodeSVG value={status.requestCode} size={88} /></div>
            <p className="text-[11px] text-app-text-muted">…or send a <strong>photo of this QR</strong> — your provider can upload it instead of typing.</p>
          </div>
        )}
        <p className="mt-2 text-[11px] text-app-text-muted">This code changes after each successful recharge.</p>
      </div>

      {/* Step 2 — voucher */}
      <div className="rounded border border-app-border bg-app-bg p-3">
        <div className="text-xs font-semibold text-app-text-secondary">2. Enter the Voucher code they send back</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') void redeem(); }}
            placeholder="e.g. 07T0-2VE0-HXP0"
            className="flex-1 rounded border border-app-border bg-app-surface px-3 py-2 text-base font-bold uppercase tracking-widest text-app-text focus:border-app-accent focus:outline-none"
          />
          <button onClick={redeem} disabled={busy || !code.trim()} className="rounded bg-app-accent px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40">
            {busy ? 'Redeeming…' : 'Redeem'}
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
