import { useEffect, useMemo, useState } from 'react';
import { FileText, Printer, RefreshCw, Save, Search, Send, SlidersHorizontal } from 'lucide-react';
import {
  Banner,
  Button,
  EmptyState,
  ModalityTag,
  SectionHeader,
  SelectInput,
  StatusChip,
  TextareaInput,
  TextInput,
} from '@/components/RisUi';
import {
  apiPcpndtOrders,
  apiPcpndtPrefill,
  apiPcpndtSave,
  apiPcpndtSetStatus,
  pcpndtFormHtmlUrl,
  type FormFFields,
  type PcpndtOrder,
  type PcpndtPrefill,
} from '../api/pcpndtApi';

const EMPTY_FIELDS: FormFFields = {
  indications: [],
  procedures: [],
  result_conveyed: 'No',
  procedure_type: 'Non-invasive',
};

const FIELD_LABELS: Record<string, string> = {
  clinic_name: 'Clinic name',
  clinic_registration_no: 'Clinic registration no.',
  patient_name: 'Patient name',
  patient_age: 'Patient age',
  husband_or_father_name: "Husband's / father's name",
  full_address: 'Full address',
  referring_doctor: 'Referring doctor',
  procedure_date: 'Procedure date',
  performing_doctor: 'Performing doctor',
  lmp_or_gestational_age: 'LMP or gestational age',
  indications: 'Indication',
};

export function PcpndtPage() {
  const [orders, setOrders] = useState<PcpndtOrder[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PcpndtOrder | null>(null);
  const [prefill, setPrefill] = useState<PcpndtPrefill | null>(null);
  const [fields, setFields] = useState<FormFFields>(EMPTY_FIELDS);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const studyUid = prefill?.study_uid || (selected ? selected.linked_study_uid || selected.study_instance_uid : '');
  const missing = prefill?.missing || [];

  const loadOrders = async (q = query, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const next = await apiPcpndtOrders(q);
      setOrders(next);
      if (selected) {
        const refreshed = next.find((order) => order.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load PCPNDT orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openOrder = async (order: PcpndtOrder) => {
    setSelected(order);
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const next = await apiPcpndtPrefill(order);
      setPrefill(next);
      setFields({ ...EMPTY_FIELDS, ...next.fields });
    } catch (err) {
      setPrefill(null);
      setFields(EMPTY_FIELDS);
      setError(err instanceof Error ? err.message : 'Could not open Form F');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders('', true);
    const id = window.setInterval(() => loadOrders(query, true), 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof FormFFields, value: string | string[]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!studyUid) return false;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiPcpndtSave(studyUid, fields);
      setMessage('Form F saved.');
      if (selected) await openOrder(selected);
      await loadOrders(query, true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Form F');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    if (!studyUid) return;
    const saved = await save();
    if (!saved) return;
    window.open(pcpndtFormHtmlUrl(studyUid), '_blank', 'noopener');
  };

  const markSubmitted = async () => {
    if (!studyUid) return;
    const ack = window.prompt('Enter PCPNDT portal acknowledgement number, if available.', '');
    if (ack === null) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiPcpndtSetStatus(studyUid, 'submitted', ack);
      setMessage('Form F marked submitted.');
      if (selected) await openOrder(selected);
      await loadOrders(query, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update submission status');
    } finally {
      setSaving(false);
    }
  };

  const missingText = useMemo(
    () => missing.map((key) => FIELD_LABELS[key] || key).join(', '),
    [missing],
  );

  return (
    <div className="content-narrow">
      <div className="grid-2">
        <div className="card card-pad">
          <SectionHeader icon={Search} title="Find visit for Form F" sub="Real RIS registrations only">
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => loadOrders()} disabled={loading}>Refresh</Button>
          </SectionHeader>
          <div className="actions">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient, MRN, visit, accession" />
            <Button variant="primary" icon={Search} onClick={() => loadOrders()} disabled={loading}>Search</Button>
          </div>

          <div className="table-wrap mt-4">
            <table className="dt">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Accession</th>
                  <th>Service</th>
                  <th>Form F</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={selected?.id === order.id ? 'selected' : ''} onClick={() => openOrder(order)}>
                    <td>
                      <div className="strong">{order.patient_name || 'Unnamed patient'}</div>
                      <div className="field-hint">{order.visit_no || '-'} | {order.mrn || '-'}</div>
                    </td>
                    <td className="mono">{order.accession_number}</td>
                    <td><ModalityTag modality={order.modality} /> <span className="field-hint">{order.service_name || '-'}</span></td>
                    <td><StatusChip status={order.form_status || 'draft'} label={order.form_status || 'Not saved'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 ? <EmptyState title="No visits found" sub="Create a reception visit first, then open PCPNDT here." /> : null}
          </div>
        </div>

        <div className="card card-pad">
          <SectionHeader icon={FileText} title="Form F" sub={selected ? `${selected.accession_number} | ${selected.patient_name || ''}` : 'Select a visit'} />
          {error ? <Banner kind="warning">{error}</Banner> : null}
          {message ? <div className="mt-3"><Banner kind="success">{message}</Banner></div> : null}
          {missing.length > 0 ? <div className="mt-3"><Banner kind="warning">Pending fields: {missingText}</Banner></div> : null}

          {!selected ? (
            <EmptyState title="Select a patient visit" sub="The form will auto-fill patient, accession, clinic, and referral details." />
          ) : (
            <>
              <div className="grid-2 mt-4">
                <TextInput label="Ref. no." value={fields.ref_no || ''} onChange={(event) => update('ref_no', event.target.value)} />
                <TextInput label="Procedure date" type="date" value={fields.procedure_date || ''} onChange={(event) => update('procedure_date', event.target.value)} />
                <TextInput label="Clinic name" value={fields.clinic_name || ''} onChange={(event) => update('clinic_name', event.target.value)} />
                <TextInput label="Clinic registration no." value={fields.clinic_registration_no || ''} onChange={(event) => update('clinic_registration_no', event.target.value)} />
              </div>

              <TextareaInput label="Clinic address" rows={2} value={fields.clinic_address || ''} onChange={(event) => update('clinic_address', event.target.value)} />

              <div className="grid-2 mt-4">
                <TextInput label="Patient name" value={fields.patient_name || ''} onChange={(event) => update('patient_name', event.target.value)} />
                <TextInput label="Patient age" value={fields.patient_age || ''} onChange={(event) => update('patient_age', event.target.value)} />
                <TextInput label="Husband / father name" value={fields.husband_or_father_name || ''} onChange={(event) => update('husband_or_father_name', event.target.value)} />
                <TextInput label="Phone" value={fields.phone || ''} onChange={(event) => update('phone', event.target.value)} />
                <SelectInput label="ID proof" value={fields.id_proof_type || ''} onChange={(event) => update('id_proof_type', event.target.value)}>
                  <option value="">Select</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="driving_license">Driving license</option>
                  <option value="passport">Passport</option>
                  <option value="other">Other</option>
                </SelectInput>
                <TextInput label="ID proof number" value={fields.id_proof_number || ''} onChange={(event) => update('id_proof_number', event.target.value)} />
              </div>

              <TextareaInput label="Full address" rows={2} value={fields.full_address || ''} onChange={(event) => update('full_address', event.target.value)} />

              <div className="grid-2 mt-4">
                <TextInput label="LMP date" type="date" value={fields.lmp_date || ''} onChange={(event) => update('lmp_date', event.target.value)} />
                <TextInput label="Gestational age" value={fields.gestational_age || ''} onChange={(event) => update('gestational_age', event.target.value)} />
                <TextInput label="EDD" type="date" value={fields.edd || ''} onChange={(event) => update('edd', event.target.value)} />
                <TextInput label="No. of living children" value={fields.num_living_children || ''} onChange={(event) => update('num_living_children', event.target.value)} />
              </div>

              <OptionList
                title="Indications"
                options={prefill?.options.indications || []}
                selected={fields.indications || []}
                onChange={(next) => update('indications', next)}
              />

              {showAll ? (
                <>
                  <div className="grid-2 mt-4">
                    <TextInput label="Children details" value={fields.children_details || ''} onChange={(event) => update('children_details', event.target.value)} />
                    <SelectInput label="Basis of diagnosis" value={fields.basis_of_diagnosis || ''} onChange={(event) => update('basis_of_diagnosis', event.target.value)}>
                      <option value="">Select</option>
                      {(prefill?.options.basis_of_diagnosis || []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </SelectInput>
                    <TextInput label="Referring doctor" value={fields.referring_doctor || ''} onChange={(event) => update('referring_doctor', event.target.value)} />
                    <TextInput label="Referring doctor reg. no." value={fields.referring_doctor_reg_no || ''} onChange={(event) => update('referring_doctor_reg_no', event.target.value)} />
                    <SelectInput label="Procedure type" value={fields.procedure_type || 'Non-invasive'} onChange={(event) => update('procedure_type', event.target.value)}>
                      <option value="Non-invasive">Non-invasive</option>
                      <option value="Invasive">Invasive</option>
                    </SelectInput>
                    <SelectInput label="Result conveyed" value={fields.result_conveyed || 'No'} onChange={(event) => update('result_conveyed', event.target.value)}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </SelectInput>
                    <TextInput label="Performing doctor" value={fields.performing_doctor || ''} onChange={(event) => update('performing_doctor', event.target.value)} />
                    <TextInput label="Doctor qualification" value={fields.performing_doctor_qualification || ''} onChange={(event) => update('performing_doctor_qualification', event.target.value)} />
                    <TextInput label="Doctor reg. no." value={fields.performing_doctor_reg_no || ''} onChange={(event) => update('performing_doctor_reg_no', event.target.value)} />
                  </div>
                  <TextareaInput label="Referring doctor address" rows={2} value={fields.referring_doctor_address || ''} onChange={(event) => update('referring_doctor_address', event.target.value)} />
                  <TextareaInput label="Family history" rows={2} value={fields.family_history || ''} onChange={(event) => update('family_history', event.target.value)} />
                  <OptionList
                    title="Procedures"
                    options={prefill?.options.procedures || []}
                    selected={fields.procedures || []}
                    onChange={(next) => update('procedures', next)}
                  />
                  <TextareaInput label="Complications" rows={2} value={fields.complications || ''} onChange={(event) => update('complications', event.target.value)} />
                  <TextareaInput label="Result" rows={2} value={fields.result || ''} onChange={(event) => update('result', event.target.value)} />
                </>
              ) : null}

              <div className="actions mt-4">
                <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setShowAll((value) => !value)}>
                  {showAll ? 'Hide extra fields' : 'Show all PCPNDT fields'}
                </Button>
                <Button variant="primary" icon={Save} onClick={save} disabled={saving || loading}>Save Form F</Button>
                <Button variant="secondary" icon={Printer} onClick={print} disabled={saving || loading}>Print Form F</Button>
                <Button variant="success" icon={Send} onClick={markSubmitted} disabled={saving || loading}>Mark submitted</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionList({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };
  return (
    <div className="mt-4">
      <span className="field-label">{title}</span>
      <div className="grid-auto mt-3">
        {options.map((option) => (
          <label key={option} className={`checkrow ${selected.includes(option) ? 'checked' : ''}`}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
