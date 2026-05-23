import { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Loader2, Clock, LogOut } from 'lucide-react';

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
