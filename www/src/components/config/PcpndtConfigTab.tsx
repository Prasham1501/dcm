import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { pcpndtGetConfig, pcpndtSaveConfig } from '@/features/pcpndt/pcpndtApi';

/**
 * PCPNDT settings tab — the clinic's standing details + government-portal login.
 * Saved once here, they auto-fill every Form F (clinic, sonologist, basis,
 * referring doctor, portal credentials).
 */

const BASIS_OPTIONS = ['Clinical', 'Bio-chemical', 'Cytogenetic', 'Radiological/Ultrasonography', 'Other'];

const FIELDS: { key: string; label: string; wide?: boolean }[] = [
  { key: 'pcpndt_clinic_name', label: 'Clinic / Centre name', wide: true },
  { key: 'pcpndt_registration_no', label: 'Clinic Registration No.' },
  { key: 'clinic_state', label: 'State' },
  { key: 'pcpndt_clinic_address', label: 'Clinic address', wide: true },
  { key: 'pcpndt_performing_doctor', label: 'Sonologist / performing doctor' },
  { key: 'pcpndt_performing_doctor_qualification', label: 'Qualification' },
  { key: 'pcpndt_performing_doctor_reg_no', label: 'Doctor registration No.' },
  { key: 'pcpndt_default_referring_doctor', label: 'Default referring doctor (optional)' },
];

const emptyConfig = () => ({
  settings: {} as Record<string, string>,
  portal: { state_code: 'maharashtra', username: '', has_password: false },
});

export function PcpndtConfigTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [portalUser, setPortalUser] = useState('');
  const [portalPass, setPortalPass] = useState('');
  const [portalHasPass, setPortalHasPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    pcpndtGetConfig()
      .then((cfg) => {
        if (!alive) return;
        const safeCfg = cfg || emptyConfig();
        setSettings(safeCfg.settings || {});
        setPortalUser(safeCfg.portal?.username || '');
        setPortalHasPass(!!safeCfg.portal?.has_password);
      })
      .catch((e) => alive && setErr(e?.message || 'Failed to load PCPNDT config'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const set = (k: string, v: string) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const payload: Record<string, any> = { ...settings, portal_username: portalUser };
      if (portalPass) payload.portal_password = portalPass; // only send when changed
      const cfg = await pcpndtSaveConfig(payload);
      const safeCfg = cfg || emptyConfig();
      setSettings(safeCfg.settings || {});
      setPortalUser(safeCfg.portal?.username || '');
      setPortalHasPass(!!safeCfg.portal?.has_password);
      setPortalPass('');
      setMsg('Saved — these will auto-fill every Form F.');
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-app-text-muted py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  const inputCls = 'w-full h-8 px-2 text-sm rounded border border-app-border bg-app-bg text-app-text';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-app-accent">PCPNDT — Form F defaults</h3>
        <p className="text-xs text-app-text-muted mt-0.5">Set your clinic, sonologist and portal details once. They auto-fill every PCPNDT Form F.</p>
      </div>

      {err && <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border border-red-500/40 rounded">{err}</div>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
            <label className="block text-[11px] text-app-text-muted mb-0.5">{f.label}</label>
            <input value={settings[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
          </div>
        ))}
        <div>
          <label className="block text-[11px] text-app-text-muted mb-0.5">Default basis of diagnosis</label>
          <input list="pcpndt-cfg-basis" value={settings['pcpndt_default_basis'] ?? ''} onChange={(e) => set('pcpndt_default_basis', e.target.value)} className={inputCls} />
          <datalist id="pcpndt-cfg-basis">{BASIS_OPTIONS.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
      </div>

      <div className="pt-2 border-t border-app-border">
        <h4 className="text-xs font-bold text-app-accent mb-1.5">Government portal login (stored encrypted)</h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <label className="block text-[11px] text-app-text-muted mb-0.5">Portal username</label>
            <input value={portalUser} onChange={(e) => setPortalUser(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] text-app-text-muted mb-0.5">Portal password</label>
            <input type="password" value={portalPass} onChange={(e) => setPortalPass(e.target.value)}
              placeholder={portalHasPass ? '•••••• (saved — leave blank to keep)' : ''} className={inputCls} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold border-2 border-app-accent text-app-accent rounded hover:bg-app-accent hover:text-white disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save PCPNDT defaults'}
        </button>
        {msg && <span className="text-xs text-green-500">{msg}</span>}
      </div>
    </div>
  );
}
