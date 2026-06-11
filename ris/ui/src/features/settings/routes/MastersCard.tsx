import { useEffect, useMemo, useState } from 'react';
import { Building2, Download, FileSpreadsheet, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Banner, Button, EmptyState, SectionHeader, SelectInput, StatusChip, TextInput } from '@/components/RisUi';
import {
  apiMasters, apiSaveMaster, apiDeleteMaster, apiImportCsv,
  apiListDoctors, apiSaveDoctor, apiDeleteDoctor,
  apiListPatients, apiSavePatientMaster,
  type Center, type Pro, type Lookup, type RisDoctor, type PatientMaster, type ImportType,
} from '../api/settingsApi';

type TabKey = 'patients' | 'centers' | 'doctors' | 'pros' | 'staff' | 'patient_groups' | 'dispatch_modes';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'patients', label: 'Patients' },
  { key: 'centers', label: 'Centers' },
  { key: 'doctors', label: 'Referring doctor' },
  { key: 'pros', label: 'PROs' },
  { key: 'staff', label: 'Staff' },
  { key: 'patient_groups', label: 'Patient groups' },
  { key: 'dispatch_modes', label: 'Dispatch modes' },
];

// Lookup tabs map to a ris_lookups category.
const LOOKUP_CATEGORY: Partial<Record<TabKey, string>> = {
  staff: 'phlebotomy_staff',
  patient_groups: 'patient_group',
  dispatch_modes: 'dispatch_mode',
};

// CSV import type + downloadable header template per tab.
const IMPORT: Record<TabKey, { type: ImportType; headers: string[] }> = {
  patients: { type: 'patients', headers: ['mrn', 'prefix', 'full_name', 'last_name', 'age', 'sex', 'phone', 'alt_phone', 'dob', 'email', 'patient_group', 'husband_or_father_name', 'address', 'city', 'state', 'aadhaar_number'] },
  centers: { type: 'centers', headers: ['code', 'name', 'billing_type', 'contact_person', 'phone', 'email', 'address', 'discount_percent'] },
  doctors: { type: 'referring_doctors', headers: ['name', 'doctor_type', 'phone', 'email', 'registration_no', 'clinic_name', 'address'] },
  pros: { type: 'pros', headers: ['name', 'phone', 'commission_type', 'commission_value'] },
  staff: { type: 'staff', headers: ['value', 'sort_order'] },
  patient_groups: { type: 'patient_groups', headers: ['value', 'sort_order'] },
  dispatch_modes: { type: 'dispatch_modes', headers: ['value', 'sort_order'] },
};

function downloadCsvTemplate(name: string, headers: string[]) {
  const blob = new Blob([headers.join(',') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function MastersCard() {
  const [tab, setTab] = useState<TabKey>('patients');
  const [centers, setCenters] = useState<Center[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [doctors, setDoctors] = useState<RisDoctor[]>([]);
  const [lookups, setLookups] = useState<Lookup[]>([]);
  const [patients, setPatients] = useState<PatientMaster[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientForm, setPatientForm] = useState<Partial<PatientMaster>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit forms (one object per entity kind).
  const [centerForm, setCenterForm] = useState<Partial<Center>>({ billing_type: 'debit', is_active: 1 });
  const [proForm, setProForm] = useState<Partial<Pro>>({ commission_type: 'none', is_active: 1 });
  const [doctorForm, setDoctorForm] = useState<Partial<RisDoctor>>({ doctor_type: 'gp' });
  const [lookupValue, setLookupValue] = useState('');

  const lookupCategory = LOOKUP_CATEGORY[tab];

  const load = async (which: TabKey = tab) => {
    setError(null);
    try {
      if (which === 'patients') setPatients(await apiListPatients(patientQuery));
      else if (which === 'centers') setCenters(await apiMasters<Center>('centers'));
      else if (which === 'pros') setPros(await apiMasters<Pro>('pros'));
      else if (which === 'doctors') setDoctors(await apiListDoctors());
      else setLookups(await apiMasters<Lookup>('lookups', { category: LOOKUP_CATEGORY[which]! }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load master data');
    }
  };

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const wrap = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setError(null); setMessage(null);
    try { await fn(); setMessage(ok); } catch (err: any) { setError(err?.message || 'Operation failed'); } finally { setBusy(false); }
  };

  const savePatient = () => wrap(async () => {
    if (!patientForm.full_name?.trim()) throw new Error('Patient name is required');
    await apiSavePatientMaster({ ...patientForm, action: patientForm.id ? 'update' : 'create' });
    setPatientForm({});
    await load('patients');
  }, 'Patient saved');

  const saveCenter = () => wrap(async () => {
    if (!centerForm.name?.trim()) throw new Error('Center name is required');
    await apiSaveMaster('centers', centerForm as Record<string, unknown>);
    setCenterForm({ billing_type: 'debit', is_active: 1 });
    await load('centers');
  }, 'Center saved');

  const savePro = () => wrap(async () => {
    if (!proForm.name?.trim()) throw new Error('PRO name is required');
    await apiSaveMaster('pros', proForm as Record<string, unknown>);
    setProForm({ commission_type: 'none', is_active: 1 });
    await load('pros');
  }, 'PRO saved');

  const saveDoctor = () => wrap(async () => {
    if (!doctorForm.name?.trim()) throw new Error('Doctor name is required');
    await apiSaveDoctor(doctorForm);
    setDoctorForm({ doctor_type: 'gp' });
    await load('doctors');
  }, 'Doctor saved');

  const saveLookup = () => wrap(async () => {
    if (!lookupValue.trim() || !lookupCategory) throw new Error('Value is required');
    await apiSaveMaster('lookups', { category: lookupCategory, value: lookupValue.trim() });
    setLookupValue('');
    await load(tab);
  }, 'Added');

  const removeCenter = (c: Center) => wrap(async () => { await apiDeleteMaster('centers', c.id); await load('centers'); }, 'Center removed');
  const removePro = (p: Pro) => wrap(async () => { await apiDeleteMaster('pros', p.id); await load('pros'); }, 'PRO removed');
  const removeDoctor = (d: RisDoctor) => wrap(async () => { await apiDeleteDoctor(d.id); await load('doctors'); }, 'Doctor removed');
  const removeLookup = (l: Lookup) => wrap(async () => { await apiDeleteMaster('lookups', l.id); await load(tab); }, 'Removed');

  const importCsv = (file?: File | null) => {
    if (!file) return;
    wrap(async () => {
      const res = await apiImportCsv(IMPORT[tab].type, file);
      await load(tab);
      setMessage(`Import complete. Created ${res.created}, skipped ${res.skipped}${res.errors?.length ? `, errors ${res.errors.length}` : ''}.`);
    }, 'Import complete');
  };

  const tabLabel = useMemo(() => TABS.find((t) => t.key === tab)?.label ?? '', [tab]);

  return (
    <div className="card card-pad mt-5">
      <SectionHeader icon={Building2} title="Masters" sub="Centers, doctors, PROs and the dropdown lists reception uses. Add manually or import from Excel/CSV." />

      <div className="visit-tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {error && <Banner kind="warning">{error}</Banner>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="actions mt-3">
        <label className="btn btn-secondary">
          <FileSpreadsheet size={15} /> Import {tabLabel} CSV
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files?.[0])} />
        </label>
        <Button variant="ghost" icon={Download} onClick={() => downloadCsvTemplate(tab, IMPORT[tab].headers)}>Download template</Button>
      </div>

      {/* ---------- Patients ---------- */}
      {tab === 'patients' && (
        <>
          <div className="actions mt-4" style={{ alignItems: 'flex-end' }}>
            <TextInput label="Search patients" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load('patients'); }} placeholder="Name, MRN, or phone" style={{ minWidth: 280 }} />
            <Button variant="secondary" icon={Search} onClick={() => load('patients')}>Search</Button>
          </div>
          <div className="grid-2 mt-3">
            <TextInput label="Patient ID / MRN" value={patientForm.mrn || ''} onChange={(e) => setPatientForm({ ...patientForm, mrn: e.target.value })} hint="Optional, auto if blank" />
            <TextInput label="Mobile" value={patientForm.phone || ''} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
            <SelectInput label="Title" value={patientForm.name_prefix || ''} onChange={(e) => setPatientForm({ ...patientForm, name_prefix: e.target.value })}>
              <option value="">-</option><option value="Mr.">Mr.</option><option value="Mrs.">Mrs.</option><option value="Ms.">Ms.</option><option value="Dr.">Dr.</option><option value="Master">Master</option><option value="Baby">Baby</option>
            </SelectInput>
            <TextInput label="Full name" value={patientForm.full_name || ''} onChange={(e) => setPatientForm({ ...patientForm, full_name: e.target.value })} />
            <SelectInput label="Gender" value={patientForm.sex || ''} onChange={(e) => setPatientForm({ ...patientForm, sex: e.target.value })}>
              <option value="">-</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </SelectInput>
            <SelectInput label="Group" value={patientForm.patient_group || ''} onChange={(e) => setPatientForm({ ...patientForm, patient_group: e.target.value })}>
              <option value="">-</option><option value="Regular">Regular</option><option value="Center">Center</option><option value="Home visit">Home visit</option><option value="Corporate">Corporate</option>
            </SelectInput>
          </div>
          <div className="grid-3 mt-3">
            <TextInput label="Age (years)" type="number" value={String(patientForm.age_years ?? '')} onChange={(e) => setPatientForm({ ...patientForm, age_years: e.target.value === '' ? null : Number(e.target.value) })} />
            <TextInput label="Months" type="number" value={String(patientForm.age_months ?? '')} onChange={(e) => setPatientForm({ ...patientForm, age_months: e.target.value === '' ? null : Number(e.target.value) })} />
            <TextInput label="Days" type="number" value={String(patientForm.age_days ?? '')} onChange={(e) => setPatientForm({ ...patientForm, age_days: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="grid-2 mt-3">
            <TextInput label="Husband / father name" value={patientForm.husband_or_father_name || ''} onChange={(e) => setPatientForm({ ...patientForm, husband_or_father_name: e.target.value })} />
            <TextInput label="Email" value={patientForm.email || ''} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} />
            <TextInput label="Address" value={patientForm.address_line1 || ''} onChange={(e) => setPatientForm({ ...patientForm, address_line1: e.target.value })} />
            <TextInput label="City" value={patientForm.city || ''} onChange={(e) => setPatientForm({ ...patientForm, city: e.target.value })} />
            <TextInput label="State" value={patientForm.state || ''} onChange={(e) => setPatientForm({ ...patientForm, state: e.target.value })} />
            <TextInput label="Aadhaar" value={patientForm.aadhaar_number || ''} onChange={(e) => setPatientForm({ ...patientForm, aadhaar_number: e.target.value })} />
          </div>
          <div className="actions mt-3">
            <Button variant="primary" icon={Save} disabled={busy || !patientForm.full_name} onClick={savePatient}>{patientForm.id ? 'Update patient' : 'Add patient'}</Button>
            {patientForm.id ? <Button variant="secondary" onClick={() => setPatientForm({})}>Cancel edit</Button> : null}
          </div>
          <div className="divider" />
          {patients.length === 0 ? <EmptyState title="No patients" sub="Search above, add a patient, or import from CSV." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>MRN</th><th>Name</th><th>Age / Sex</th><th>Phone</th><th>Group</th><th>City</th><th /></tr></thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.mrn}</td>
                      <td className="strong">{[p.name_prefix, p.full_name].filter(Boolean).join(' ')}</td>
                      <td>{[p.age_years ? `${p.age_years}y` : '', p.age_months ? `${p.age_months}m` : '', p.age_days ? `${p.age_days}d` : ''].filter(Boolean).join(' ') || '-'} / {p.sex || '-'}</td>
                      <td>{p.phone || '-'}</td>
                      <td>{p.patient_group || '-'}</td>
                      <td>{p.city || '-'}</td>
                      <td><Button size="sm" variant="secondary" icon={Pencil} onClick={() => setPatientForm({ ...p })}>Edit</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- Centers ---------- */}
      {tab === 'centers' && (
        <>
          <div className="grid-2 mt-4">
            <TextInput label="Code" value={centerForm.code || ''} onChange={(e) => setCenterForm({ ...centerForm, code: e.target.value })} hint="Optional, auto if blank" />
            <TextInput label="Center name" value={centerForm.name || ''} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })} />
            <SelectInput label="Billing type" value={centerForm.billing_type || 'debit'} onChange={(e) => setCenterForm({ ...centerForm, billing_type: e.target.value as 'credit' | 'debit' })}>
              <option value="debit">Debit (pays per visit)</option>
              <option value="credit">Credit (monthly invoice)</option>
            </SelectInput>
            <TextInput label="Contact person" value={centerForm.contact_person || ''} onChange={(e) => setCenterForm({ ...centerForm, contact_person: e.target.value })} />
            <TextInput label="Phone" value={centerForm.phone || ''} onChange={(e) => setCenterForm({ ...centerForm, phone: e.target.value })} />
            <TextInput label="Email" value={centerForm.email || ''} onChange={(e) => setCenterForm({ ...centerForm, email: e.target.value })} />
            <TextInput label="Discount %" type="number" value={String(centerForm.discount_percent ?? '')} onChange={(e) => setCenterForm({ ...centerForm, discount_percent: e.target.value })} />
            <TextInput label="Address" value={centerForm.address || ''} onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })} />
          </div>
          <div className="actions mt-3">
            <Button variant="primary" icon={Save} disabled={busy || !centerForm.name} onClick={saveCenter}>{centerForm.id ? 'Update center' : 'Add center'}</Button>
            {centerForm.id ? <Button variant="secondary" onClick={() => setCenterForm({ billing_type: 'debit', is_active: 1 })}>Cancel edit</Button> : null}
          </div>
          <div className="divider" />
          {centers.length === 0 ? <EmptyState title="No centers" sub="Add a center or import from CSV." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Name</th><th>Code</th><th>Billing</th><th>Contact</th><th>Phone</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {centers.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">{c.name}</td>
                      <td className="mono">{c.code}</td>
                      <td><StatusChip status={c.billing_type === 'credit' ? 'pending' : 'online'} label={c.billing_type === 'credit' ? 'Credit' : 'Debit'} /></td>
                      <td>{c.contact_person || '-'}</td>
                      <td>{c.phone || '-'}</td>
                      <td><StatusChip status={c.is_active ? 'online' : 'offline'} label={c.is_active ? 'Active' : 'Inactive'} /></td>
                      <td>
                        <div className="actions">
                          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setCenterForm({ ...c })}>Edit</Button>
                          <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => removeCenter(c)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- Doctors ---------- */}
      {tab === 'doctors' && (
        <>
          <div className="grid-2 mt-4">
            <TextInput label="Doctor name" value={doctorForm.name || ''} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} />
            <SelectInput label="Type" value={doctorForm.doctor_type || 'gp'} onChange={(e) => setDoctorForm({ ...doctorForm, doctor_type: e.target.value as RisDoctor['doctor_type'] })}>
              <option value="gp">General practitioner</option>
              <option value="consultant">Consultant</option>
              <option value="both">Both</option>
            </SelectInput>
            <TextInput label="Qualification" value={doctorForm.qualification || ''} onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })} />
            <TextInput label="Registration no" value={doctorForm.registration_no || ''} onChange={(e) => setDoctorForm({ ...doctorForm, registration_no: e.target.value })} />
            <TextInput label="Phone" value={doctorForm.phone || ''} onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })} />
            <TextInput label="Clinic" value={doctorForm.clinic_name || ''} onChange={(e) => setDoctorForm({ ...doctorForm, clinic_name: e.target.value })} />
          </div>
          <div className="actions mt-3">
            <Button variant="primary" icon={Save} disabled={busy || !doctorForm.name} onClick={saveDoctor}>{doctorForm.id ? 'Update doctor' : 'Add doctor'}</Button>
            {doctorForm.id ? <Button variant="secondary" onClick={() => setDoctorForm({ doctor_type: 'gp' })}>Cancel edit</Button> : null}
          </div>
          <div className="divider" />
          {doctors.length === 0 ? <EmptyState title="No doctors" sub="Add a doctor or import from CSV." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Name</th><th>Type</th><th>Qualification</th><th>Phone</th><th /></tr></thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id}>
                      <td className="strong">{d.name}</td>
                      <td><StatusChip status={d.doctor_type === 'consultant' ? 'pending' : 'online'} label={d.doctor_type === 'gp' ? 'GP' : d.doctor_type === 'consultant' ? 'Consultant' : 'Both'} /></td>
                      <td>{d.qualification || '-'}</td>
                      <td>{d.phone || '-'}</td>
                      <td>
                        <div className="actions">
                          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setDoctorForm({ ...d })}>Edit</Button>
                          <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => removeDoctor(d)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- PROs ---------- */}
      {tab === 'pros' && (
        <>
          <div className="grid-2 mt-4">
            <TextInput label="PRO name" value={proForm.name || ''} onChange={(e) => setProForm({ ...proForm, name: e.target.value })} />
            <TextInput label="Phone" value={proForm.phone || ''} onChange={(e) => setProForm({ ...proForm, phone: e.target.value })} />
            <SelectInput label="Commission type" value={proForm.commission_type || 'none'} onChange={(e) => setProForm({ ...proForm, commission_type: e.target.value as Pro['commission_type'] })}>
              <option value="none">None</option>
              <option value="percent">Percent of bill</option>
              <option value="flat">Flat per visit</option>
            </SelectInput>
            <TextInput label="Commission value" type="number" value={String(proForm.commission_value ?? '')} onChange={(e) => setProForm({ ...proForm, commission_value: e.target.value })} />
          </div>
          <div className="actions mt-3">
            <Button variant="primary" icon={Save} disabled={busy || !proForm.name} onClick={savePro}>{proForm.id ? 'Update PRO' : 'Add PRO'}</Button>
            {proForm.id ? <Button variant="secondary" onClick={() => setProForm({ commission_type: 'none', is_active: 1 })}>Cancel edit</Button> : null}
          </div>
          <div className="divider" />
          {pros.length === 0 ? <EmptyState title="No PROs" sub="Add a public relations officer or import from CSV." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Name</th><th>Phone</th><th>Commission</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {pros.map((p) => (
                    <tr key={p.id}>
                      <td className="strong">{p.name}</td>
                      <td>{p.phone || '-'}</td>
                      <td>{p.commission_type === 'none' ? '-' : `${p.commission_type === 'percent' ? Number(p.commission_value) + '%' : 'Rs ' + Number(p.commission_value)}`}</td>
                      <td><StatusChip status={p.is_active ? 'online' : 'offline'} label={p.is_active ? 'Active' : 'Inactive'} /></td>
                      <td>
                        <div className="actions">
                          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setProForm({ ...p })}>Edit</Button>
                          <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => removePro(p)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- Lookup lists (staff / areas / groups / dispatch) ---------- */}
      {lookupCategory && (
        <>
          <div className="actions mt-4" style={{ alignItems: 'flex-end' }}>
            <TextInput label={`Add ${tabLabel.toLowerCase()}`} value={lookupValue} onChange={(e) => setLookupValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveLookup(); }} style={{ minWidth: 260 }} />
            <Button variant="primary" icon={Plus} disabled={busy || !lookupValue.trim()} onClick={saveLookup}>Add</Button>
          </div>
          <div className="divider" />
          {lookups.length === 0 ? <EmptyState title={`No ${tabLabel.toLowerCase()}`} sub="Add one above or import from CSV." /> : (
            <div className="table-wrap">
              <table className="dt">
                <thead><tr><th>Value</th><th /></tr></thead>
                <tbody>
                  {lookups.map((l) => (
                    <tr key={l.id}>
                      <td className="strong">{l.value}</td>
                      <td><Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => removeLookup(l)}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
