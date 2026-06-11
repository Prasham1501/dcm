import { useEffect, useState } from 'react';
import { AlertTriangle, Hash, ImagePlus, Key, Lock, Pencil, Plus, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, ModalityTag, SectionHeader, SelectInput, StatusChip, TextareaInput, TextInput } from '@/components/RisUi';
import { apiBranding, apiCounters, apiDeleteService, apiListAllServices, apiNetworkInfo, apiResetRisData, apiSaveBranding, apiSaveCounters, apiSaveService, type BrandingSettings, type CounterSettings } from '../api/settingsApi';
import type { NetworkInfo, Service } from '@/features/reception/api/receptionApi';
import { MastersCard } from './MastersCard';
import { ParametersCard } from '@/features/results/routes/ParametersCard';
import { IntegrationCard } from './IntegrationCard';
import { AnalyzerGraphsCard } from './AnalyzerGraphsCard';

const CONFIG_PASSWORD = 'Prasham123$';
const EMPTY_BRANDING: BrandingSettings = {
  brand_name: '',
  brand_tagline: '',
  brand_phone: '',
  brand_email: '',
  brand_address: '',
  brand_website: '',
  brand_logo_image: '',
  receipt_header: '',
  receipt_footer: '',
  gst_number: '',
  default_tax_percentage: '0',
  receipt_paper_size: 'A5',
  receipt_signature_label: 'Authorized sign / stamp',
  receipt_signature_image: '',
  receipt_stamp_image: '',
};
const EMPTY_SERVICE: Partial<Service> = {
  name: '',
  modality: 'OTHER',
  department: '',
  price: '0',
  default_duration_min: 20,
  is_active: 1,
};
const MODALITY_OPTIONS = ['US', 'CT', 'MR', 'XR', 'CR', 'DX', 'MG', 'LAB', 'ECG', 'OTHER'];
export function SettingsPage() {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [branding, setBranding] = useState<BrandingSettings>(EMPTY_BRANDING);
  const [counters, setCounters] = useState<CounterSettings>({});
  const [counterForm, setCounterForm] = useState({ accession_prefix: 'OCZ', accession_start: '', token_prefix: 'T', token_start: '' });
  const [services, setServices] = useState<Service[]>([]);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>(EMPTY_SERVICE);
  const [resetConfirm, setResetConfirm] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'clinic' | 'tests' | 'machine' | 'system'>('clinic');

  const load = async () => {
    setError(null);
    try {
      const [net, brand, serviceRows, counterRows] = await Promise.all([apiNetworkInfo(), apiBranding(), apiListAllServices(), apiCounters()]);
      setNetworkInfo(net);
      setBranding(brand);
      setServices(serviceRows);
      setCounters(counterRows);
      setCounterForm({
        accession_prefix: counterRows.accession?.prefix || 'OCZ',
        accession_start: String(counterRows.accession?.next_number || ''),
        token_prefix: counterRows.token?.prefix || 'T',
        token_start: String(counterRows.token?.next_number || ''),
      });
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

  const saveCounters = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await apiSaveCounters(counterForm);
      setCounters(saved);
      setCounterForm({
        accession_prefix: saved.accession?.prefix || counterForm.accession_prefix,
        accession_start: String(saved.accession?.next_number || ''),
        token_prefix: saved.token?.prefix || counterForm.token_prefix,
        token_start: String(saved.token?.next_number || ''),
      });
      setMessage('Accession and token counters saved');
    } catch (err: any) {
      setError(err?.message || 'Failed to save counters');
    } finally {
      setBusy(false);
    }
  };

  const loadImageSetting = (key: 'brand_logo_image' | 'receipt_signature_image' | 'receipt_stamp_image', file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBranding((current) => ({ ...current, [key]: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const modalityChoices = serviceForm.modality && !MODALITY_OPTIONS.includes(serviceForm.modality)
    ? [serviceForm.modality, ...MODALITY_OPTIONS]
    : MODALITY_OPTIONS;

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

      <div className="visit-tabs mt-4">
        <button type="button" className={tab === 'clinic' ? 'active' : ''} onClick={() => setTab('clinic')}>Clinic & branding</button>
        <button type="button" className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>Tests & parameters</button>
        <button type="button" className={tab === 'machine' ? 'active' : ''} onClick={() => setTab('machine')}>Machine & sync</button>
        <button type="button" className={tab === 'system' ? 'active' : ''} onClick={() => setTab('system')}>System</button>
      </div>

      {tab === 'system' && (
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
      )}

      {tab === 'clinic' && (
      <div className="card card-pad mt-4">
        <SectionHeader icon={Save} title="Branding and receipts" sub="Printed receipt header, footer, tax, and contact details" />
        <div className="grid-2">
          <TextInput label="Clinic / brand name" value={branding.brand_name} onChange={(event) => setBranding({ ...branding, brand_name: event.target.value })} />
          <TextInput label="Tagline" value={branding.brand_tagline} onChange={(event) => setBranding({ ...branding, brand_tagline: event.target.value })} />
          <TextInput label="Phone" value={branding.brand_phone} onChange={(event) => setBranding({ ...branding, brand_phone: event.target.value })} />
          <TextInput label="Email" value={branding.brand_email} onChange={(event) => setBranding({ ...branding, brand_email: event.target.value })} />
          <TextInput label="Website" value={branding.brand_website} onChange={(event) => setBranding({ ...branding, brand_website: event.target.value })} />
          <TextInput label="GST number" value={branding.gst_number} onChange={(event) => setBranding({ ...branding, gst_number: event.target.value })} />
          <TextInput label="Tax percentage" value={branding.default_tax_percentage} onChange={(event) => setBranding({ ...branding, default_tax_percentage: event.target.value })} />
          <SelectInput label="Bill paper size" value={branding.receipt_paper_size} onChange={(event) => setBranding({ ...branding, receipt_paper_size: event.target.value })}>
            <option value="A5">A5</option>
            <option value="A4">A4</option>
          </SelectInput>
        </div>
        <div className="mt-3">
          <TextareaInput label="Address" rows={2} value={branding.brand_address} onChange={(event) => setBranding({ ...branding, brand_address: event.target.value })} />
        </div>
        <div className="grid-2 mt-3">
          <TextareaInput label="Receipt header note" rows={2} value={branding.receipt_header} onChange={(event) => setBranding({ ...branding, receipt_header: event.target.value })} />
          <TextareaInput label="Receipt footer note" rows={2} value={branding.receipt_footer} onChange={(event) => setBranding({ ...branding, receipt_footer: event.target.value })} />
        </div>
        <div className="grid-2 mt-3">
          <TextInput label="Sign / stamp label" value={branding.receipt_signature_label} onChange={(event) => setBranding({ ...branding, receipt_signature_label: event.target.value })} />
          <div className="actions">
            <label className="btn btn-secondary">
              <ImagePlus size={15} /> Upload hospital logo
              <input type="file" accept="image/*" hidden onChange={(event) => loadImageSetting('brand_logo_image', event.target.files?.[0])} />
            </label>
            <label className="btn btn-secondary">
              <ImagePlus size={15} /> Upload sign
              <input type="file" accept="image/*" hidden onChange={(event) => loadImageSetting('receipt_signature_image', event.target.files?.[0])} />
            </label>
            <label className="btn btn-secondary">
              <ImagePlus size={15} /> Upload stamp
              <input type="file" accept="image/*" hidden onChange={(event) => loadImageSetting('receipt_stamp_image', event.target.files?.[0])} />
            </label>
          </div>
        </div>
        {(branding.brand_logo_image || branding.receipt_signature_image || branding.receipt_stamp_image) ? (
          <div className="receipt-preview-strip mt-3">
            {branding.brand_logo_image ? <img src={branding.brand_logo_image} alt="Hospital logo preview" /> : null}
            {branding.receipt_signature_image ? <img src={branding.receipt_signature_image} alt="Signature preview" /> : null}
            {branding.receipt_stamp_image ? <img src={branding.receipt_stamp_image} alt="Stamp preview" /> : null}
          </div>
        ) : null}
        <Button variant="primary" icon={Save} disabled={busy} onClick={saveBranding} className="mt-4">Save branding</Button>
      </div>
      )}

      {tab === 'system' && (
      <div className="card card-pad mt-4">
        <SectionHeader icon={Hash} title="Accession and token numbering" sub="Set the next generated number before starting the day or migrating from old records" />
        <div className="grid-2">
          <TextInput label="Accession prefix" value={counterForm.accession_prefix} onChange={(event) => setCounterForm({ ...counterForm, accession_prefix: event.target.value })} />
          <TextInput label="Next accession number" type="number" value={counterForm.accession_start} onChange={(event) => setCounterForm({ ...counterForm, accession_start: event.target.value })} hint={`Current next: ${counters.accession?.next_number ?? '-'}`} />
          <TextInput label="Token prefix" value={counterForm.token_prefix} onChange={(event) => setCounterForm({ ...counterForm, token_prefix: event.target.value })} />
          <TextInput label="Next token number" type="number" value={counterForm.token_start} onChange={(event) => setCounterForm({ ...counterForm, token_start: event.target.value })} hint={`Current next: ${counters.token?.next_number ?? '-'}`} />
        </div>
        <Button variant="primary" icon={Save} disabled={busy} onClick={saveCounters} className="mt-4">Save numbering</Button>
      </div>
      )}

      {tab === 'clinic' && <MastersCard />}

      {tab === 'tests' && (
      <div className="card card-pad mt-4">
        <SectionHeader icon={Plus} title="Tests and prices" sub="The list of tests/scans reception picks from when registering a patient. Only these fields matter." />
        <div className="grid-2">
          <TextInput
            label="Test name"
            required
            value={serviceForm.name || ''}
            onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
            placeholder="e.g. HbA1c, CBC, USG Abdomen"
          />
          <TextInput
            label="Price (Rs)"
            required
            type="number"
            min="0"
            step="0.01"
            value={String(serviceForm.price ?? '')}
            onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })}
            placeholder="e.g. 350"
          />
          <SelectInput
            label="Type"
            value={serviceForm.modality || 'OTHER'}
            onChange={(event) => setServiceForm({ ...serviceForm, modality: event.target.value })}
          >
            <option value="OTHER">Lab test</option>
            <option value="US">Ultrasound (USG)</option>
            <option value="CR">X-Ray</option>
            <option value="CT">CT scan</option>
            <option value="MR">MRI</option>
          </SelectInput>
          <TextInput
            label="Department"
            list="dept-options"
            value={serviceForm.department || ''}
            onChange={(event) => setServiceForm({ ...serviceForm, department: event.target.value })}
            placeholder="e.g. Biochemistry"
            hint="Optional — groups tests on reports"
          />
          <datalist id="dept-options">
            <option value="Biochemistry" /><option value="Haematology" /><option value="Pathology" /><option value="Serology" /><option value="Hormones" /><option value="Microbiology" /><option value="Radiology" />
          </datalist>
          <TextInput
            label="Sample type"
            list="sample-options"
            value={serviceForm.sample_type || ''}
            onChange={(event) => setServiceForm({ ...serviceForm, sample_type: event.target.value })}
            placeholder="e.g. Blood, Urine"
            hint="Optional — for lab tests"
          />
          <datalist id="sample-options">
            <option value="Blood" /><option value="Serum" /><option value="Plasma" /><option value="Urine" /><option value="Stool" /><option value="Swab" />
          </datalist>
          <TextInput
            label="Outsource lab"
            value={serviceForm.lab_name || ''}
            onChange={(event) => setServiceForm({ ...serviceForm, lab_name: event.target.value })}
            placeholder="e.g. Metropolis"
            hint="Optional — only if sent to another lab"
          />
          <TextInput
            label="Barcode labels per sample"
            type="number"
            min="1"
            value={String(serviceForm.barcode_label_count ?? 1)}
            onChange={(event) => setServiceForm({ ...serviceForm, barcode_label_count: Number(event.target.value) })}
            hint="How many tube stickers to print"
          />
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
      )}

      {tab === 'tests' && <ParametersCard services={services} />}

      {tab === 'machine' && <AnalyzerGraphsCard />}

      {tab === 'machine' && <IntegrationCard />}

      {tab === 'system' && (
      <div className="card card-pad mt-4" style={{ borderColor: 'var(--danger)' }}>
        <SectionHeader icon={AlertTriangle} title="Clear RIS database" sub="Deletes patients, visits, orders, payments, receipts, commission rows, and referring doctors. Keeps settings, test catalogue, DICOM nodes, and license." />
        <Banner kind="warning">This resets registration count to 0, clears referring doctors, and restarts MRN, accession, visit, and receipt counters.</Banner>
        <div className="actions mt-4">
          <TextInput label="Type RESET RIS" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} style={{ width: 240 }} />
          <Button variant="danger" icon={Trash2} disabled={busy || resetConfirm !== 'RESET RIS'} onClick={resetRis}>
            Clear RIS data
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
