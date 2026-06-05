import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Key, Loader2, Shield } from 'lucide-react';
import { Button, TextInput } from '@/components/RisUi';

declare global {
  interface Window {
    risAPI?: {
      getLicenseStatus: () => Promise<any>;
      activateLicense: (key: string) => Promise<any>;
      validateLicense: () => Promise<any>;
      deactivateLicense: () => Promise<any>;
      getFingerprint: () => Promise<string>;
    };
  }
}

export function LicenseGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!window.risAPI) {
      setStatus({ type: 'dev', expired: false });
      setLoading(false);
      return;
    }
    try {
      const current = await window.risAPI.getLicenseStatus();
      setStatus(current);
    } catch {
      setStatus({ type: 'none', expired: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <Loader2 className="accent" style={{ width: 32, height: 32, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div className="strong">Checking license...</div>
        </div>
      </div>
    );
  }

  const active = (status?.type === 'licensed' && !status?.expired) || status?.type === 'dev';
  if (!active) {
    return <LicenseActivation status={status} onActivated={refresh} />;
  }

  return <>{children}</>;
}

function LicenseActivation({ status, onActivated }: { status: any; onActivated: () => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const activate = async () => {
    const trimmed = key.trim().toUpperCase();
    if (!/^MV-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(trimmed)) {
      setError('Invalid format. Expected MV-XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setBusy(true);
    setError('');
    const result = await window.risAPI?.activateLicense(trimmed);
    setBusy(false);
    if (result?.success) {
      setSuccess(true);
      window.setTimeout(onActivated, 800);
    } else {
      setError(result?.error || 'Activation failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center' }}>
          <Shield className="accent" style={{ width: 42, height: 42, margin: '0 auto 10px' }} />
          <div className="login-brand">One Clickz RIS</div>
          <div className="login-sub">
            {status?.expired ? 'License expired. Renew or enter a new RIS key.' : 'License key required to use RIS.'}
          </div>
        </div>

        {success ? (
          <div className="banner banner-success mt-5">
            <CheckCircle /> License activated. Starting RIS...
          </div>
        ) : (
          <div className="mt-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="banner banner-warning">
              <AlertTriangle /> This software works only with an active One Clickz RIS license.
            </div>
            <TextInput
              label="License key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === 'Enter' && activate()}
              placeholder="MV-XXXX-XXXX-XXXX-XXXX"
              maxLength={23}
            />
            {error && <div className="field-error">{error}</div>}
            <Button variant="primary" icon={Key} onClick={activate} disabled={busy} className="btn-block">
              {busy ? 'Activating...' : 'Activate RIS license'}
            </Button>
            <a className="field-hint" href="https://mehrgrewal.com/mediview/dashboard.html#/dashboard/licenses?product=ris" target="_blank" rel="noreferrer">
              Buy or renew RIS license
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
