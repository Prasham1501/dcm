import { useEffect, useState } from 'react';
import { AlertTriangle, Key, Lock, Pencil, Plus, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, ModalityTag, SectionHeader, StatusChip, TextareaInput, TextInput } from '@/components/RisUi';
import { apiBranding, apiDeleteService, apiListAllServices, apiNetworkInfo, apiResetRisData, apiSaveBranding, apiSaveService, type BrandingSettings } from '../api/settingsApi';
import type { NetworkInfo, Service } from '@/features/reception/api/receptionApi';

const CONFIG_PASSWORD = 'Prasham123$';
const EMPTY_BRANDING: BrandingSettings = {
  brand_name: '',
  brand_tagline: '',
  brand_phone: '',
  brand_email: '',
  brand_address: '',
  brand_website: '',
  receipt_header: '',
  receipt_footer: '',
  gst_number: '',
  default_tax_percentage: '0',
};
const EMPTY_SERVICE: Partial<Service> = { code: '', name: '', modality: 'US', body_part: '', price: '0', default_duration_min: 20, is_active: 1 };

export function SettingsPage() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [branding, setBranding] = useState<BrandingSettings>(EMPTY_BRANDING);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>(EMPTY_SERVICE);
  const [resetConfirm, setResetConfirm] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [net, brand, serviceRows] = await Promise.all([apiNetworkInfo(), apiBranding(), apiListAllServices()]);
      setNetworkInfo(net);
      setBranding(brand);
      setServices(serviceRows);
      if (window.risAPI) setLicenseStatus(await window.risAPI.getLicenseStatus());
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings');
    }
  };

  useEffect(() => {
    if (unlocked) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="content-narrow">
        <div className="card card-pad" style={{ maxWidth: 420 }}>
          <SectionHeader icon={Lock} title="Doctor password required" sub="Protects license, branding, and reset options" />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && password === CONFIG_PASSWORD) setUnlocked(true);
            }}
          />
          {password && password !== CONFIG_PASSWORD ? <div className="field-error mt-3">Invalid password</div> : null}
          <Button className="mt-4" variant="primary" icon={Lock} onClick={() => setUnlocked(password === CONFIG_PASSWORD)}>
            Unlock settings
          </Button>
        </div>
      </div>
    );
  }

  const saveBranding = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setBranding(await apiSaveBranding(branding));
      setMessage('Branding and receipt settings saved');
    } catch (err: any) {
      setError(err?.message || 'Failed to save branding');
    } finally {
      setBusy(false);
    }
  };

  const resetRis = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiResetRisData(resetConfirm);
      setResetConfirm('');
      const wl = result.worklist_files_removed ?? 0;
      setMessage(
        `RIS data cleared. Tables: ${result.cleared.join(', ')}` +
        (wl > 0 ? ` · Worklist files removed: ${wl}` : ' · Worklist folder empty'),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to reset RIS data');
    } finally {
      setBusy(false);
    }
  };

  const saveService = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await apiSaveService(serviceForm);
      setServiceForm(EMPTY_SERVICE);
      setServices(await apiListAllServices());
      setMessage(`Test saved: ${saved.name}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save test');
    } finally {
      setBusy(false);
    }
  };

  const deleteService = async (service: Service) => {
    if (!window.confirm(`Delete ${service.name}? Existing old orders keep their service history, but this test will be removed from future registration.`)) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiDeleteService(service.id);
      if (serviceForm.id === service.id) setServiceForm(EMPTY_SERVICE);
      setServices(await apiListAllServices());
      setMessage(`Test deleted: ${service.name}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete test');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-narrow">
      {error && <div className="banner banner-warning">{error}</div>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="grid-2 mt-4">
        <div className="card card-pad">
          <SectionHeader icon={Key} title="License" sub="One Clickz RIS license status" />
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div className="between"><span className="muted">Type</span><span className="strong">{licenseStatus?.type || (window.risAPI ? 'unknown' : 'dev')}</span></div>
            <div className="between"><span className="muted">Key</span><span className="mono">{licenseStatus?.licenseKey || '-'}</span></div>
            <div className="between"><span className="muted">Plan</span><span>{licenseStatus?.plan || '-'}</span></div>
            <div className="between"><span className="muted">Expires</span><span>{licenseStatus?.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString() : '-'}</span></div>
          </div>
          <div className="actions mt-4">
            <Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh license</Button>
            {window.risAPI && (
              <Button variant="danger" onClick={async () => { await window.risAPI?.deactivateLicense(); await load(); }}>
                Deactivate key
              </Button>
            )}
          </div>
        </div>

        <div className="card card-pad">
          <SectionHeader icon={Server} title="Machine setup summary" sub="For full details use the Network tab" />
          {networkInfo ? (
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div className="between"><span className="muted">Server IP</span><span className="mono">{networkInfo.modality.server_ip}</span></div>
              <div className="between"><span className="muted">AE title</span><span className="mono">{networkInfo.modality.ae_title}</span></div>
              <div className="between"><span className="muted">DICOM / Worklist port</span><span className="mono">{networkInfo.modality.dicom_port}</span></div>
            </div>
          ) : <EmptyState title="Network data not loaded" />}
          <div className="mt-4">
            <Banner kind="info">Configure the machine console to pull Worklist and send completed studies to these receiver details.</Banner>
          </div>
        </div>
      </div>

      <div className="card card-pad mt-5">
        <SectionHeader icon={Save} title="Branding and receipts" sub="Printed receipt header, footer, tax, and contact details" />
        <div className="grid-2">
          <TextInput label="Clinic / brand name" value={branding.brand_name} onChange={(event) => setBranding({ ...branding, brand_name: event.target.value })} />
          <TextInput label="Tagline" value={branding.brand_tagline} onChange={(event) => setBranding({ ...branding, brand_tagline: event.target.value })} />
          <TextInput label="Phone" value={branding.brand_phone} onChange={(event) => setBranding({ ...branding, brand_phone: event.target.value })} />
          <TextInput label="Email" value={branding.brand_email} onChange={(event) => setBranding({ ...branding, brand_email: event.target.value })} />
          <TextInput label="Website" value={branding.brand_website} onChange={(event) => setBranding({ ...branding, brand_website: event.target.value })} />
          <TextInput label="GST number" value={branding.gst_number} onChange={(event) => setBranding({ ...branding, gst_number: event.target.value })} />
          <TextInput label="Tax percentage" value={branding.default_tax_percentage} onChange={(event) => setBranding({ ...branding, default_tax_percentage: event.target.value })} />
        </div>
        <div className="mt-3">
          <TextareaInput label="Address" rows={2} value={branding.brand_address} onChange={(event) => setBranding({ ...branding, brand_address: event.target.value })} />
        </div>
        <div className="grid-2 mt-3">
          <TextareaInput label="Receipt header note" rows={2} value={branding.receipt_header} onChange={(event) => setBranding({ ...branding, receipt_header: event.target.value })} />
          <TextareaInput label="Receipt footer note" rows={2} value={branding.receipt_footer} onChange={(event) => setBranding({ ...branding, receipt_footer: event.target.value })} />
        </div>
        <Button variant="primary" icon={Save} disabled={busy} onClick={saveBranding} className="mt-4">Save branding</Button>
      </div>

      <div className="card card-pad mt-5">
        <SectionHeader icon={Plus} title="Tests and prices" sub="Reception uses this dynamic catalogue while creating visits" />
        <div className="grid-2">
          <TextInput label="Code" value={serviceForm.code || ''} onChange={(event) => setServiceForm({ ...serviceForm, code: event.target.value })} hint="Optional. Auto-generated if blank." />
          <TextInput label="Test name" value={serviceForm.name || ''} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} />
          <TextInput label="Modality" value={serviceForm.modality || ''} onChange={(event) => setServiceForm({ ...serviceForm, modality: event.target.value.toUpperCase() })} />
          <TextInput label="Body part" value={serviceForm.body_part || ''} onChange={(event) => setServiceForm({ ...serviceForm, body_part: event.target.value })} />
          <TextInput label="Price" type="number" value={String(serviceForm.price ?? '')} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} />
          <TextInput label="Duration minutes" type="number" value={String(serviceForm.default_duration_min ?? '')} onChange={(event) => setServiceForm({ ...serviceForm, default_duration_min: Number(event.target.value) })} />
        </div>
        <label className="checkrow mt-3">
          <input type="checkbox" checked={!!serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked ? 1 : 0 })} />
          <span>Active in reception</span>
        </label>
        <div className="actions mt-4">
          <Button variant="primary" icon={Save} disabled={busy || !serviceForm.name || !serviceForm.modality} onClick={saveService}>
            {serviceForm.id ? 'Update test' : 'Add test'}
          </Button>
          {serviceForm.id ? <Button variant="secondary" onClick={() => setServiceForm(EMPTY_SERVICE)}>Cancel edit</Button> : null}
        </div>
        <div className="divider" />
        {services.length === 0 ? <EmptyState title="No tests configured" /> : (
          <div className="table-wrap">
            <table className="dt">
              <thead><tr><th>Test</th><th>Modality</th><th>Body part</th><th>Price</th><th>Status</th><th /></tr></thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>
                      <div className="strong">{service.name}</div>
                      <div className="mono field-hint">{service.code}</div>
                    </td>
                    <td><ModalityTag modality={service.modality} /></td>
                    <td>{service.body_part || '-'}</td>
                    <td className="mono">Rs {Number(service.price || 0).toFixed(2)}</td>
                    <td><StatusChip status={service.is_active ? 'online' : 'offline'} label={service.is_active ? 'Active' : 'Inactive'} /></td>
                    <td>
                      <div className="actions">
                        <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setServiceForm({ ...service })}>Edit</Button>
                        <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => deleteService(service)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad mt-5" style={{ borderColor: 'var(--danger)' }}>
        <SectionHeader icon={AlertTriangle} title="Clear RIS database" sub="Deletes patients, visits, orders, payments, receipts, commission rows, and referring doctors. Keeps settings, test catalogue, DICOM nodes, and license." />
        <Banner kind="warning">This resets registration count to 0, clears referring doctors, and restarts MRN, accession, visit, and receipt counters.</Banner>
        <div className="actions mt-4">
          <TextInput label="Type RESET RIS" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} style={{ width: 240 }} />
          <Button variant="danger" icon={Trash2} disabled={busy || resetConfirm !== 'RESET RIS'} onClick={resetRis}>
            Clear RIS data
          </Button>
        </div>
      </div>
    </div>
  );
}
