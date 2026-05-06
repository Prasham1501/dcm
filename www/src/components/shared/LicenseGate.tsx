import { useEffect, useState } from 'react';
import { useLicenseStore } from '@/stores/licenseStore';
import { Shield, Key, AlertTriangle, CheckCircle, Loader2, Clock } from 'lucide-react';

interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const { status, loading, fetchStatus } = useLicenseStore();

  useEffect(() => {
    fetchStatus();
    // Re-check license every 10 minutes to catch mid-session expiry
    const interval = setInterval(fetchStatus, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          <p className="text-sm text-gray-400">Checking license...</p>
        </div>
      </div>
    );
  }

  // If licensed and not expired, render the app
  if (status?.type === 'licensed' && !status.expired) {
    return <>{children}</>;
  }

  // If trial and not expired, render app with trial banner
  if (status?.type === 'trial' && !status.expired) {
    return (
      <>
        <TrialBanner remaining={status.remaining ?? 0} onActivated={fetchStatus} />
        {children}
      </>
    );
  }

  // Expired trial or expired license — show activation page
  return <LicenseActivationPage expired={status?.type === 'licensed' && status.expired} trialExpired={status?.type === 'trial' && status.expired} />;
}

function LicenseActivationPage({ expired = false, trialExpired = false }: { expired?: boolean; trialExpired?: boolean }) {
  const { activateLicense, activating, error, fetchStatus } = useLicenseStore();
  const [key, setKey] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleActivate = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) {
      setLocalError('Please enter a license key');
      return;
    }
    if (!/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(trimmed)) {
      setLocalError('Invalid format. Expected: MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setLocalError('');
    const result = await activateLicense(trimmed);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => fetchStatus(), 1000);
    } else {
      setLocalError(result.error || 'Activation failed');
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/80 p-8 shadow-2xl backdrop-blur">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Accurate</h1>
          <p className="text-center text-sm text-gray-400">
            Professional DICOM Viewer
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-semibold text-green-400">License Activated!</p>
            <p className="text-sm text-gray-400">Starting application...</p>
          </div>
        ) : (
          <>
            {/* Notice */}
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/30 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-300">
                  {expired ? 'License Expired' : trialExpired ? 'Trial Expired' : 'License Required'}
                </p>
                <p className="mt-0.5 text-xs text-red-400/70">
                  {expired
                    ? 'Your license has expired. Enter a new license key to continue.'
                    : trialExpired
                      ? 'Your 7-day free trial has ended. Purchase a license key to continue.'
                      : 'Enter a valid license key to start using the software.'}
                </p>
              </div>
            </div>

            {/* License key input */}
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">
                  License Key
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    placeholder="MV-XXXX-XXXX-XXXX-XXXX"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-10 pr-4 text-sm font-mono text-white placeholder-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    maxLength={23}
                    spellCheck={false}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                  />
                </div>
              </div>

              {displayError && (
                <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs text-red-400">
                  {displayError}
                </div>
              )}

              <button
                onClick={handleActivate}
                disabled={activating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {activating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating...
                  </>
                ) : (
                  'Activate License'
                )}
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-gray-500">
              Need a license?{' '}
              <a
                href="https://mehrgrewal.com/mediview/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 hover:text-red-300 underline"
              >
                Purchase here
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function TrialBanner({ remaining, onActivated }: { remaining: number; onActivated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const api = (window as any).electronAPI;

  const handleActivate = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed || !/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(trimmed)) {
      setError('Format: MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setError('');
    setActivating(true);
    const result = await api.activateLicense(trimmed);
    setActivating(false);
    if (result.success) {
      onActivated();
    } else {
      setError(result.error || 'Activation failed');
    }
  };

  return (
    <div className="bg-amber-600 text-white">
      <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium">
        <Clock className="h-3.5 w-3.5" />
        <span>Free trial: {remaining} day{remaining !== 1 ? 's' : ''} remaining</span>
        <span className="mx-1 opacity-50">|</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="underline hover:text-white/80 transition-colors"
        >
          {expanded ? 'Hide' : 'Have a license key? Activate now'}
        </button>
      </div>
      {expanded && (
        <div className="flex items-center justify-center gap-2 px-3 pb-2">
          <Key className="h-3.5 w-3.5 text-white/70" />
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="MV-XXXX-XXXX-XXXX-XXXX"
            className="rounded border border-white/30 bg-white/10 px-2 py-1 font-mono text-xs text-white placeholder-white/40 focus:border-white focus:outline-none w-52"
            maxLength={23}
            spellCheck={false}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          />
          <button
            onClick={handleActivate}
            disabled={activating}
            className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-50"
          >
            {activating ? '...' : 'Activate'}
          </button>
          {error && <span className="text-xs text-red-200">{error}</span>}
        </div>
      )}
    </div>
  );
}
