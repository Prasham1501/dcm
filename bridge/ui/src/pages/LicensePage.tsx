import { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Loader2, Clock, LogOut, WifiOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Same REASONS map RechargePage uses, so error wording stays consistent.
const OFFLINE_REASONS: Record<string, string> = {
  bad_format: 'That does not look like a valid unlock code.',
  invalid_code: 'Invalid or already-used unlock code. Confirm your provider used the exact Request code shown below, then re-type the unlock code.',
  empty_voucher: 'This unlock code grants nothing.',
};

interface LicenseStatus {
  type: 'licensed' | 'trial';
  licenseKey?: string;
  plan?: string;
  expiresAt?: string;
  lastValidated?: string;
  daysLeft?: number | null;
  expired?: boolean;
  remaining?: number;
  totalDays?: number;
}

const api = (window as any).bridgeAPI;

export function LicensePage() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const s = await api.getLicenseStatus();
      setStatus(s);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleActivate = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) { setError('Please enter a license key'); return; }
    if (!/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(trimmed)) {
      setError('Invalid format. Expected: MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setError('');
    setActivating(true);
    const result = await api.activateLicense(trimmed);
    setActivating(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => { setSuccess(false); fetchStatus(); }, 1500);
    } else {
      setError(result.error || 'Activation failed');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this license from this device?')) return;
    await api.deactivateLicense();
    fetchStatus();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-app-accent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-app-accent" />
        <h1 className="text-lg font-bold text-app-text">License</h1>
      </div>

      {/* Current status */}
      <div className="rounded-lg border border-app-border bg-app-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-app-text-secondary">Current Status</h2>

        {status?.type === 'licensed' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-semibold text-green-400">Licensed</span>
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                {status.plan?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-app-text-secondary">Key:</span>
                <span className="ml-1 font-mono text-app-text">{status.licenseKey}</span>
              </div>
              {status.expiresAt && (
                <div>
                  <span className="text-app-text-secondary">Expires:</span>
                  <span className="ml-1 text-app-text">
                    {new Date(status.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {status.daysLeft != null && (
                <div>
                  <span className="text-app-text-secondary">Days Left:</span>
                  <span className={`ml-1 font-semibold ${status.daysLeft <= 7 ? 'text-red-400' : status.daysLeft <= 14 ? 'text-amber-400' : 'text-green-400'}`}>
                    {status.daysLeft}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleDeactivate}
              className="mt-2 flex items-center gap-1.5 rounded border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              Deactivate from this device
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-sm font-semibold text-amber-400">
                {status?.expired ? 'Trial Expired' : 'Free Trial'}
              </span>
            </div>
            <p className="text-xs text-app-text-secondary">
              {status?.expired
                ? 'Your 7-day free trial has ended. Enter a license key to continue.'
                : `${status?.remaining} day${status?.remaining !== 1 ? 's' : ''} remaining of ${status?.totalDays}-day free trial.`}
            </p>
          </div>
        )}
      </div>

      {/* Activation */}
      <div className="rounded-lg border border-app-border bg-app-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-app-text-secondary">
          {status?.type === 'licensed' ? 'Change License Key' : 'Activate License'}
        </h2>

        {success ? (
          <div className="flex items-center gap-2 py-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-400">License activated successfully!</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-secondary" />
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="MV-XXXX-XXXX-XXXX-XXXX"
                className="w-full rounded-lg border border-app-border bg-app-bg py-2 pl-10 pr-3 font-mono text-sm text-app-text placeholder:text-app-text-secondary/40 focus:border-app-accent focus:outline-none"
                maxLength={23}
                spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-app-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
            </button>
            <OfflineActivationPanel onActivated={fetchStatus} />
          </div>
        )}
      </div>

      <p className="text-center text-xs text-app-text-secondary">
        Need a license?{' '}
        <a href="https://mehrgrewal.com/mediview/" target="_blank" rel="noopener noreferrer"
           className="text-app-accent underline hover:opacity-80">
          Purchase here
        </a>
      </p>
    </div>
  );
}

/**
 * Collapsible "No internet? Activate offline" panel for the Bridge.
 *
 * The bridge reads a 7-char Request code (HMAC-bound to the machine fingerprint)
 * to the dealer; the dealer mints a short Unlock code on the password-gated
 * bridge-voucher.php and the operator types it back in here. Verifies locally —
 * no network call — and creates a server-less licence with the granted prints +
 * days when redeemed on a trial/no-licence machine.
 */
function OfflineActivationPanel({ onActivated }: { onActivated: () => void }) {
  const [open, setOpen] = useState(false);
  const [requestCode, setRequestCode] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !api?.voucherStatus) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await api.voucherStatus();
        if (!cancelled) setRequestCode(s?.requestCode || '');
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const copyRequest = async () => {
    if (!requestCode) return;
    try { await navigator.clipboard.writeText(requestCode); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const submit = async () => {
    setErr('');
    const k = licenseKey.trim().toUpperCase();
    const c = code.trim().toUpperCase();
    if (!/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(k)) {
      setErr('Invalid licence key. Expected: MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    if (!c) { setErr('Enter the unlock code your provider sent.'); return; }
    if (!api?.activateOffline) { setErr('Offline activation is only available in the desktop app.'); return; }
    setBusy(true);
    try {
      const r = await api.activateOffline({ licenseKey: k, code: c });
      if (r?.ok) {
        onActivated();
      } else {
        setErr(OFFLINE_REASONS[r?.reason] || `Could not activate (${r?.reason || 'error'}).`);
      }
    } catch (e: any) {
      setErr(e?.message || 'Activation failed');
    } finally {
      setBusy(false);
    }
  };

  if (!api?.activateOffline) return null;

  return (
    <div className="mt-3 rounded-lg border border-app-border bg-app-bg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-app-text-secondary hover:text-app-text"
      >
        <span className="flex items-center gap-2">
          <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          No internet? Activate offline
        </span>
        <span className="text-app-text-secondary">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-app-border px-3 py-3">
          <p className="text-[11px] text-app-text-secondary">
            Read your Request code to the provider (or send a photo of the QR). They send back an
            Unlock code that works only on this PC.
          </p>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
              1. Request code (from this PC)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-app-border bg-app-surface px-2 py-1.5 text-base font-bold tracking-widest text-app-accent">
                {requestCode || '…'}
              </code>
              <button
                type="button"
                onClick={copyRequest}
                className="rounded border border-app-border bg-app-surface px-2 py-1.5 text-[11px] text-app-text-secondary hover:bg-app-hover"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {requestCode && (
              <div className="mt-2 flex items-center gap-3">
                <div className="rounded bg-white p-1.5"><QRCodeSVG value={requestCode} size={80} /></div>
                <p className="text-[10px] text-app-text-muted">…or send a photo of this QR — the provider can upload it instead of typing.</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
              2. Licence key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="MV-XXXX-XXXX-XXXX-XXXX"
              maxLength={23}
              spellCheck={false}
              className="w-full rounded border border-app-border bg-app-surface px-2 py-1.5 font-mono text-xs text-app-text placeholder:text-app-text-muted focus:border-app-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
              3. Unlock code (from the provider)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              placeholder="e.g. 07T0-2VE0-HXP0"
              className="w-full rounded border border-app-border bg-app-surface px-2 py-1.5 font-mono text-xs uppercase tracking-widest text-app-text placeholder:text-app-text-muted focus:border-app-accent focus:outline-none"
            />
          </div>

          {err && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
              {err}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || !licenseKey.trim() || !code.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate Offline'}
          </button>
        </div>
      )}
    </div>
  );
}
