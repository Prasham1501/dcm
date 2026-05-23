import { useState, useEffect } from 'react';
import { useLicenseStore } from '@/stores/licenseStore';
import { Shield, Key, CheckCircle, AlertTriangle, Loader2, LogOut, RefreshCw, Monitor, Clock, Calendar, Copy, Check } from 'lucide-react';

export function LicenseTab() {
  const { status, loading, fetchStatus, refreshStatus, activateLicense, deactivateLicense, activating, error } = useLicenseStore();
  const [key, setKey] = useState('');
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [copied, setCopied] = useState('');
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    // Use refreshStatus instead of fetchStatus to avoid triggering LicenseGate's loading state
    refreshStatus().finally(() => setLocalLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setShowChangeKey(false);
      setTimeout(() => { setSuccess(false); refreshStatus(); }, 2000);
    } else {
      setLocalError(result.error || 'Activation failed');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this license from this device?\nYou will need to re-enter the key to use this software again.')) return;
    await deactivateLicense();
    setShowChangeKey(false);
    refreshStatus();
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return dateStr; }
  };

  const formatDateTime = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };

  if (localLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-app-accent" />
      </div>
    );
  }

  const displayError = localError || error;
  const isLicensed = status?.type === 'licensed';

  return (
    <div className="space-y-5">
      {/* License Status Banner */}
      <div className={`rounded-lg border p-4 ${isLicensed ? (status?.expired ? 'border-red-800 bg-red-900/10' : 'border-green-800 bg-green-900/10') : 'border-amber-800 bg-amber-900/10'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLicensed && !status?.expired ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            <div>
              <h3 className="text-sm font-bold text-app-text">
                {isLicensed ? (status?.expired ? 'License Expired' : 'Licensed') : (status?.expired ? 'Trial Expired' : 'Free Trial')}
              </h3>
              <p className="text-xs text-app-text-muted mt-0.5">
                {isLicensed && !status?.expired && status?.daysLeft != null && (
                  <span className={(status.daysLeft ?? 0) <= 7 ? 'text-red-400' : (status.daysLeft ?? 0) <= 30 ? 'text-amber-400' : 'text-green-400'}>
                    {status.daysLeft} day{status.daysLeft !== 1 ? 's' : ''} remaining
                  </span>
                )}
                {isLicensed && status?.expired && 'Your license has expired. Please renew or enter a new key.'}
                {!isLicensed && !status?.expired && `${status?.remaining ?? 0} of ${status?.totalDays ?? 7} trial days remaining`}
                {!isLicensed && status?.expired && 'Your trial has ended. Enter a license key to continue.'}
              </p>
            </div>
          </div>
          {isLicensed && status?.plan && (
            <span className={`rounded px-3 py-1 text-xs font-bold uppercase ${status?.expired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
              {status.plan}
            </span>
          )}
        </div>
      </div>

      {/* License Details (only when licensed) */}
      {isLicensed && status && (
        <div className="rounded-lg border border-app-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-app-text">
            <Shield className="h-4 w-4 text-app-accent" />
            License Details
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {status.licenseKey && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">License Key</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-app-text">{status.licenseKey}</span>
                  <button
                    onClick={() => handleCopy(status.licenseKey!, 'key')}
                    className="rounded p-1 hover:bg-app-hover"
                    title="Copy key"
                  >
                    {copied === 'key' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-app-text-muted" />}
                  </button>
                </div>
              </div>
            )}

            {status.plan && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Plan</span>
                </div>
                <span className="text-xs font-semibold capitalize text-app-text">{status.plan}</span>
              </div>
            )}

            {status.expiresAt && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Expires On</span>
                </div>
                <span className={`text-xs font-semibold ${status.expired ? 'text-red-400' : 'text-app-text'}`}>
                  {formatDate(status.expiresAt)}
                </span>
              </div>
            )}

            {status.daysLeft != null && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Days Remaining</span>
                </div>
                <span className={`text-xs font-bold ${(status.daysLeft ?? 0) <= 7 ? 'text-red-400' : (status.daysLeft ?? 0) <= 30 ? 'text-amber-400' : 'text-green-400'}`}>
                  {status.daysLeft}
                </span>
              </div>
            )}

            {status.activatedAt && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Activated On</span>
                </div>
                <span className="text-xs text-app-text">{formatDate(status.activatedAt)}</span>
              </div>
            )}

            {status.lastValidated && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Last Verified</span>
                </div>
                <span className="text-xs text-app-text">{formatDateTime(status.lastValidated)}</span>
              </div>
            )}

            {status.machineName && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Machine</span>
                </div>
                <span className="text-xs font-mono text-app-text">{status.machineName}</span>
              </div>
            )}

            {status.fingerprint && (
              <div className="flex items-center justify-between rounded border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-app-text-muted" />
                  <span className="text-xs text-app-text-muted">Device ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-app-text">{status.fingerprint.slice(0, 16)}...</span>
                  <button
                    onClick={() => handleCopy(status.fingerprint!, 'fp')}
                    className="rounded p-1 hover:bg-app-hover"
                    title="Copy fingerprint"
                  >
                    {copied === 'fp' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-app-text-muted" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => refreshStatus()}
              className="flex items-center gap-1.5 rounded border border-app-border px-3 py-1.5 text-xs text-app-text-secondary hover:bg-app-hover"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Verify Now
            </button>
            <button
              onClick={() => { setShowChangeKey(true); setLocalError(''); }}
              className="flex items-center gap-1.5 rounded border border-app-accent px-3 py-1.5 text-xs text-app-accent hover:bg-app-accent/10"
            >
              <Key className="h-3.5 w-3.5" />
              Change Key
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
      )}

      {/* Activate / Change License Key */}
      {(!isLicensed || showChangeKey) && (
        <div className="rounded-lg border border-app-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-app-text">
              <Key className="h-4 w-4 text-app-accent" />
              {isLicensed ? 'Change License Key' : 'Activate License'}
            </h3>
            {isLicensed && showChangeKey && (
              <button
                onClick={() => { setShowChangeKey(false); setLocalError(''); setKey(''); }}
                className="text-xs text-app-text-muted hover:text-app-text"
              >
                Cancel
              </button>
            )}
          </div>

          {isLicensed && showChangeKey && (
            <p className="mb-3 text-xs text-app-text-muted">
              Entering a new key will deactivate the current license on this device and activate the new one.
            </p>
          )}

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
                  onChange={(e) => { setKey(e.target.value.toUpperCase()); setLocalError(''); }}
                  placeholder="MV-XXXX-XXXX-XXXX-XXXX"
                  className="flex-1 rounded border border-app-border bg-app-bg px-3 py-2 font-mono text-sm text-app-text placeholder:text-app-text-muted focus:border-app-accent focus:outline-none"
                  maxLength={23}
                  spellCheck={false}
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                />
                <button
                  onClick={handleActivate}
                  disabled={activating || !key.trim()}
                  className="flex items-center gap-2 rounded bg-app-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate'}
                </button>
              </div>
              {displayError && <p className="text-xs text-red-400">{displayError}</p>}
              <p className="text-xs text-app-text-muted">
                Format: MV-XXXX-XXXX-XXXX-XXXX (letters A-Z, digits 2-9, no O/0/1/I/L)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Purchase Link */}
      <p className="text-center text-xs text-app-text-muted">
        Need a license?{' '}
        <a href="https://mehrgrewal.com/mediview/" target="_blank" rel="noopener noreferrer"
           className="text-app-accent underline hover:opacity-80">
          Purchase at mehrgrewal.com/mediview
        </a>
      </p>
    </div>
  );
}
