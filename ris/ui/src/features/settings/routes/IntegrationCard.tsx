import { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Banner, Button, SectionHeader } from '@/components/RisUi';
import { apiIntegration, apiRegenerateIntegrationKey } from '../api/settingsApi';

export function IntegrationCard() {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('/api/integration/report-status.php');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiIntegration().then((d) => { setApiKey(d.api_key); setEndpoint(d.endpoint); }).catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  const fullUrl = `${window.location.origin}${endpoint}`;
  const ingestUrl = `${window.location.origin}/api/integration/results-ingest.php`;
  const example = `curl -X POST "${fullUrl}" \\
  -H "X-API-Key: ${apiKey || '<API_KEY>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"visit_no":"V000002","status":"printed"}'`;
  const ingestExample = `curl -X POST "${ingestUrl}" \\
  -H "X-API-Key: ${apiKey || '<API_KEY>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"visit_no":"V000005","results":[{"parameter":"HBA1C","value":"9.7"}]}'`;

  const regenerate = async () => {
    if (!window.confirm('Generate a new key? The reporting software will need the new key to keep working.')) return;
    setBusy(true); setError(null); setMessage(null);
    try { const r = await apiRegenerateIntegrationKey(); setApiKey(r.api_key); setMessage('New key generated'); }
    catch (e: any) { setError(e?.message || 'Failed to regenerate'); }
    finally { setBusy(false); }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => setMessage(`${label} copied`)).catch(() => setMessage('Copy failed'));
  };

  return (
    <div className="card card-pad mt-5">
      <SectionHeader icon={Link2} title="Integrations — report status sync" sub="Let a separate reporting PC/software auto-flag a report as printed/emailed/delivered on this reception screen." />
      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="grid-2 mt-3">
        <div>
          <div className="field-label">API key</div>
          <div className="mono" style={{ wordBreak: 'break-all', padding: '8px 10px', border: '1px solid var(--app-border)', borderRadius: 6, background: 'var(--app-surface)' }}>{apiKey || '—'}</div>
          <div className="actions mt-3">
            <Button variant="secondary" disabled={!apiKey} onClick={() => copy(apiKey, 'API key')}>Copy key</Button>
            <Button variant="ghost" disabled={busy} onClick={regenerate}>Regenerate</Button>
          </div>
        </div>
        <div>
          <div className="field-label">Endpoint URL</div>
          <div className="mono" style={{ wordBreak: 'break-all', padding: '8px 10px', border: '1px solid var(--app-border)', borderRadius: 6, background: 'var(--app-surface)' }}>{fullUrl}</div>
          <div className="actions mt-3">
            <Button variant="secondary" onClick={() => copy(fullUrl, 'Endpoint URL')}>Copy URL</Button>
          </div>
        </div>
      </div>

      <div className="field-label mt-4">1) Flag a report sent (printed / emailed)</div>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', padding: 12, border: '1px solid var(--app-border)', borderRadius: 6, background: 'var(--app-surface)', fontSize: 12 }}>{example}</pre>
      <div className="field-hint mt-3">
        <span className="mono">status</span> = printed | emailed | delivered | ready | not_ready. Identify the visit by
        <span className="mono"> visit_no</span>, <span className="mono">accession_number</span>, or <span className="mono">visit_id</span>.
      </div>

      <div className="field-label mt-4">2) Push test result values from a machine / analyzer</div>
      <pre className="mono" style={{ whiteSpace: 'pre-wrap', padding: 12, border: '1px solid var(--app-border)', borderRadius: 6, background: 'var(--app-surface)', fontSize: 12 }}>{ingestExample}</pre>
      <div className="field-hint mt-3">
        Send <span className="mono">results</span> as <span className="mono">[{'{'}"parameter":"NAME","value":"X"{'}'}]</span> — parameters are matched by name to the
        tests on that visit, flags (L/N/H) and formula rows (eAG) are computed automatically, and the values appear live in Result Entry.
        A small bridge on the machine PC reads the analyzer (serial ASTM/HL7 or its CSV/TXT export), reads the sample's Reg-No barcode, and POSTs here.
        Reachable over LAN or a free VPN (Tailscale) across shops. Manual entry in Result Entry always works too.
      </div>
    </div>
  );
}
