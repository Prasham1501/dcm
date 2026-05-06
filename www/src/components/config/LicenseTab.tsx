import { useState, useEffect } from 'react';
import { useLicenseStore } from '@/stores/licenseStore';
import { Shield, Key, CheckCircle, AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';

const api = (window as any).electronAPI;

export function LicenseTab() {
  const { status, loading, fetchStatus, activateLicense, deactivateLicense, activating, error } = useLicenseStore();
  const [key, setKey] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    fetchStatus();
    if (api?.getFingerprint) {
      api.getFingerprint().then((fp: string) => setFingerprint(fp));
    }
  }, [fetchStatus]);

  const handleActivate = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) { setLocalError('Please enter a license key'); return; }
    if (!/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(trimmed)) {
      setLocalError('Invalid format. Expected: MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setLocalError('');
    const result = await activateLicense(trimmed);
    if (result.success) {
      setSuccess(true);
      setKey('');
      setTimeout(() => { setSuccess(false); fetchStatus(); }, 2000);
    } else {
      setLocalError(result.error || 'Activation failed');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this license from this device? You will need to re-enter the key.')) return;
    await deactivateLicense();
    fetchStatus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-app-accent" />
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="rounded-lg border border-app-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-app-text">
          <Shield className="h-4 w-4 text-app-accent" />
          License Status
        </h3>

        {status?.type === 'licensed' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-semibold text-green-500">Active License</span>
              <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-500">
                {status.plan?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-app-text-muted">License Key:</span>
                <span className="ml-2 font-mono text-app-text">{status.licenseKey}</span>
              </div>
              <div>
                <span className="text-app-text-muted">Plan:</span>
                <span className="ml-2 text-app-text capitalize">{status.plan}</span>
              </div>
              {status.expiresAt && (
                <div>
                  <span className="text-app-text-muted">Expires:</span>
                  <span className="ml-2 text-app-text">
                    {new Date(status.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              {status.daysLeft != null && (
                <div>
                  <span className="text-app-text-muted">Days Left:</span>
                  <span className={`ml-2 font-semibold ${status.daysLeft <= 7 ? 'text-red-400' : status.daysLeft <= 14 ? 'text-amber-400' : 'text-green-400'}`}>
                    {status.daysLeft} day{status.daysLeft !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {status.lastValidated && (
                <div>
                  <span className="text-app-text-muted">Last Verified:</span>
                  <span className="ml-2 text-app-text">
                    {new Date(status.lastValidated).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => fetchStatus()}
                className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-hover"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                onClick={handleDeactivate}
                className="flex items-center gap-1.5 rounded border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
              >
                <LogOut className="h-3.5 w-3.5" />
                Deactivate
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {status?.type === 'trial' ? (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">
                    {status.expired ? 'Trial Expired' : 'Free Trial'}
                  </span>
                </div>
                <p className="text-xs text-app-text-muted">
                  {status.expired
                    ? 'Your 7-day free trial has ended. Enter a license key to continue using the software.'
                    : `${status.remaining} day${status.remaining !== 1 ? 's' : ''} remaining of ${status.totalDays}-day free trial.`}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">No License</span>
                </div>
                <p className="text-xs text-app-text-muted">
                  Enter a license key below to activate the software.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Activate / Change License */}
      <div className="rounded-lg border border-app-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-app-text">
          <Key className="h-4 w-4 text-app-accent" />
          {status?.type === 'licensed' ? 'Change License Key' : 'Activate License'}
        </h3>

        {success ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-500">License activated successfully!</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="MV-XXXX-XXXX-XXXX-XXXX"
                className="flex-1 rounded border border-app-border bg-app-bg px-3 py-2 font-mono text-sm text-app-text placeholder:text-app-text-muted focus:border-app-accent focus:outline-none"
                maxLength={23}
                spellCheck={false}
                onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              />
              <button
                onClick={handleActivate}
                disabled={activating}
                className="flex items-center gap-2 rounded bg-app-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
              </button>
            </div>
            {displayError && <p className="text-xs text-red-400">{displayError}</p>}
          </div>
        )}
      </div>

      {/* Device Info */}
      {fingerprint && (
        <div className="rounded-lg border border-app-border p-4">
          <h3 className="mb-2 text-sm font-bold text-app-text">Device Info</h3>
          <div className="text-xs text-app-text-muted">
            <span>Fingerprint: </span>
            <span className="font-mono text-app-text">{fingerprint}</span>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-app-text-muted">
        Need a license?{' '}
        <a href="https://mehrgrewal.com/mediview/" target="_blank" rel="noopener noreferrer"
           className="text-app-accent underline hover:opacity-80">
          Purchase here
        </a>
      </p>
    </div>
  );
}
