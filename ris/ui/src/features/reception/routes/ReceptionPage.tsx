import { Fragment, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, History, MonitorUp, Plus, Printer, Receipt, Search, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Banner, Button, EmptyState, ModalityTag, SectionHeader, SelectInput, StatusChip, TextInput } from '@/components/RisUi';
import { useReceptionStore } from '../stores/receptionStore';
import { apiCreateReferringDoctor, apiGenerateWorklist, apiPatientHistory, apiUpdateAccession, apiUpdateOrderDestination, type Order, type Patient, type PatientHistory } from '../api/receptionApi';
import { apiDicomNodes, type DicomNode } from '@/features/settings/api/settingsApi';
import type { PatientForm } from '../lib/patientForm';
import type { VisitForm } from '../lib/visitForm';
import { useBillingStore } from '@/features/billing/stores/billingStore';
import type { Receipt as ReceiptRow } from '@/features/billing/api/billingApi';

const RECEPTION_ROLES = ['receptionist'];

const EMPTY_PATIENT: PatientForm = {
  name_prefix: '',
  full_name: '',
  last_name: '',
  phone: '',
  alt_phone: '',
  sex: '',
  dob: '',
  age_years: '',
  email: '',
  husband_or_father_name: '',
  address_line1: '',
  address_line2: '',
  address_line3: '',
  city: '',
  state: '',
  id_proof_type: '',
  id_proof_number: '',
};

export function ReceptionPage() {
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const {
    patients, services, referringDoctors, loading, error,
    search, register, loadServices, loadReferringDoctors, registerVisit,
  } = useReceptionStore();
  const { takePayment, generateReceipt, error: billingError } = useBillingStore();

  const [query, setQuery] = useState('');
  const [patientForm, setPatientForm] = useState<PatientForm>({ ...EMPTY_PATIENT });
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [refDocId, setRefDocId] = useState('');
  const [discount, setDiscount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [nodes, setNodes] = useState<DicomNode[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{
    visitNo: string;
    orders: Array<Order & { service_name?: string }>;
    receipt: ReceiptRow | null;
    balance: string;
  } | null>(null);

  useEffect(() => {
    if (!RECEPTION_ROLES.includes(role)) return;
    loadServices();
    loadReferringDoctors();
    search('');
    apiDicomNodes().then(setNodes).catch(() => setNodes([]));
  }, [role, loadServices, loadReferringDoctors, search]);

  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  const selectedTotal = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const netTotal = Math.max(0, selectedTotal - Number(discount || 0));

  useEffect(() => {
    setPayAmount(netTotal > 0 ? netTotal.toFixed(2) : '');
  }, [netTotal]);

  if (!RECEPTION_ROLES.includes(role)) {
    return <EmptyState title="No reception access" sub="RIS is configured for reception access only." />;
  }

  const setPatientField = (key: keyof PatientForm, value: string) =>
    setPatientForm((current) => {
      if (key === 'dob') {
        const age = calculateAge(value);
        return { ...current, dob: value, age_years: age === null ? current.age_years : age };
      }
      return { ...current, [key]: value };
    });

  const choosePatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setCompleted(null);
    setMessage(`${patient.full_name} selected`);
    setHistoryLoading(true);
    try {
      setHistory(await apiPatientHistory(patient.id));
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const createPatient = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await register(patientForm);
    if (created) {
      setPatientForm({ ...EMPTY_PATIENT });
      await choosePatient(created);
    }
  };

  const toggleService = (id: number) =>
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));

  const resetVisitForm = () => {
    setServiceIds([]);
    setRefDocId('');
    setDiscount('');
    setPayAmount('');
    setPayMode('cash');
    setPaymentRef('');
  };

  const completeVisit = async () => {
    if (!selectedPatient || selectedServices.length === 0) return;
    setMessage(null);
    setCompleted(null);

    const visitForm: VisitForm = {
      patient_id: selectedPatient.id,
      referring_doctor_id: refDocId ? Number(refDocId) : null,
      services: selectedServices.map((service) => ({
        service_id: service.id,
        price: service.price,
        modality: service.modality,
      })),
      discount,
    };

    const result = await registerVisit(visitForm);
    if (!result) return;

    let balance = result.visit.balance;
    const amount = Number(payAmount || 0);
    if (amount > 0) {
      const paidVisit = await takePayment(result.visit.id, amount, payMode, paymentRef || undefined);
      if (!paidVisit) return;
      balance = paidVisit.balance;
    }

    const receipt = await generateReceipt(result.visit.id);

    const completedOrders = result.orders.map((order) => {
      const service = selectedServices.find((item) => item.id === order.service_id);
      return {
        ...order,
        service_name: service?.name || '',
      };
    });
    setCompleted({ visitNo: result.visit.visit_no, orders: completedOrders, receipt, balance });
    setMessage('Visit created, payment recorded, and receipt is ready');
    resetVisitForm();
    setHistory(await apiPatientHistory(selectedPatient.id));
  };

  const addReferringDoctor = async () => {
    const name = newDoctorName.trim();
    if (!name) return;
    try {
      const doctor = await apiCreateReferringDoctor({ name });
      await loadReferringDoctors();
      setRefDocId(String(doctor.id));
      setNewDoctorName('');
      setMessage(`Referring doctor ${doctor.name} added`);
    } catch (err: any) {
      setMessage(null);
    }
  };

  const prepareConsoleWorklist = async (order?: Order, nodeId?: string) => {
    try {
      const node = nodeId ? nodes.find((item) => String(item.id) === nodeId) : null;
      if (order && node) {
        await apiUpdateOrderDestination(order.id, node.id);
      }
      const result = await apiGenerateWorklist(order?.id);
      const target = node ? ` for ${node.name} (${node.ae_title})` : '';
      const text = `Patient details sent to console worklist${target}. ${result.generated} pending order(s) refreshed. On the machine console, open Worklist/Patient Query and select this accession.`;
      setMessage(text);
      window.alert(text);
    } catch (err: any) {
      const text = err?.message || 'Could not prepare console worklist';
      setMessage(text);
      window.alert(text);
    }
  };

  const editAccession = async (order: Order) => {
    const value = window.prompt('Enter accession number', order.accession_number);
    const next = value?.trim();
    if (!next || next === order.accession_number) return;
    try {
      await apiUpdateAccession(order.id, next);
      setMessage(`Accession updated to ${next.toUpperCase()}`);
      if (selectedPatient) setHistory(await apiPatientHistory(selectedPatient.id));
      setCompleted((current) => current ? {
        ...current,
        orders: current.orders.map((item) => item.id === order.id ? { ...item, accession_number: next.toUpperCase() } : item),
      } : current);
    } catch (err: any) {
      setMessage(err?.message || 'Could not update accession');
    }
  };

  return (
    <div className="content-narrow">
      {(error || billingError) && <div className="banner banner-warning">{error || billingError}</div>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      <div className="workflow-steps mt-4">
        <Step active={!selectedPatient} done={!!selectedPatient} label="Patient" />
        <Step active={!!selectedPatient && !completed} done={!!completed} label="Visit & payment" />
        <Step active={!!completed} done={!!completed} label="Receipt & accession" />
      </div>

      {completed && (
        <div className="card card-pad mt-4" style={{ borderColor: 'var(--success)' }}>
          <SectionHeader icon={CheckCircle2} title={`Visit ${completed.visitNo} completed`} sub="Next: send patient details to the machine console">
            <StatusChip status={Number(completed.balance) <= 0 ? 'paid' : 'pending'} label={Number(completed.balance) <= 0 ? 'Paid' : `Balance Rs ${completed.balance}`} />
          </SectionHeader>
          <div className="grid-2">
            <div className="card card-surface card-pad">
              <div className="field-label">Send details before scan</div>
              {completed.orders.map((order) => (
                <div key={order.id} className="card card-pad mt-3">
                  <div className="between">
                    <div>
                      <div className="strong">{order.service_name || 'Study'}</div>
                      <div className="accession-list">
                        <span className="accession-code">{order.accession_number}</span>
                        {order.token_no ? <span className="accession-code">{order.token_no}</span> : null}
                      </div>
                    </div>
                    <ModalityTag modality={order.modality} />
                  </div>
                  <div className="actions mt-3">
                    <SendDetailsActions
                      nodes={nodes}
                      patient={selectedPatient}
                      order={order}
                      prepareConsoleWorklist={prepareConsoleWorklist}
                      editAccession={editAccession}
                    />
                  </div>
                  <div className="field-hint mt-3">The machine must query DICOM Modality Worklist from RIS, select this accession, scan, then send images back to ONECLICKZ:3458.</div>
                </div>
              ))}
            </div>
            <div className="card card-surface card-pad">
              <div className="field-label">Receipt</div>
              {completed.receipt ? (
                <a className="btn btn-secondary mt-3" href={completed.receipt.print_url || '#'} target="_blank" rel="noreferrer">
                  <Printer size={16} /> Print {completed.receipt.receipt_no}
                </a>
              ) : <div className="field-hint mt-3">Receipt could not be generated.</div>}
            </div>
          </div>
          <div className="actions mt-4">
            <Button variant="primary" icon={UserPlus} onClick={() => { setSelectedPatient(null); setHistory(null); setCompleted(null); }}>
              Next patient
            </Button>
            <Button variant="secondary" icon={ClipboardList} onClick={() => setCompleted(null)}>
              Add another visit for this patient
            </Button>
          </div>
        </div>
      )}

      {selectedPatient && !completed && (
        <VisitPanel
          patient={selectedPatient}
          services={services}
          selectedServiceIds={serviceIds}
          toggleService={toggleService}
          referringDoctors={referringDoctors}
          refDocId={refDocId}
          setRefDocId={setRefDocId}
          discount={discount}
          setDiscount={setDiscount}
          selectedTotal={selectedTotal}
          netTotal={netTotal}
          payAmount={payAmount}
          setPayAmount={setPayAmount}
          payMode={payMode}
          setPayMode={setPayMode}
          paymentRef={paymentRef}
          setPaymentRef={setPaymentRef}
          newDoctorName={newDoctorName}
          setNewDoctorName={setNewDoctorName}
          addReferringDoctor={addReferringDoctor}
          loading={loading}
          completeVisit={completeVisit}
          changePatient={() => { setSelectedPatient(null); setHistory(null); resetVisitForm(); }}
        />
      )}

      <div className="grid-2 mt-5">
        <form onSubmit={createPatient} className="card card-pad">
          <SectionHeader icon={UserPlus} title="New patient" sub="Create once, then continue to visit and receipt" />
          <div className="grid-2">
            <SelectInput label="Prefix" value={patientForm.name_prefix || ''} onChange={(event) => setPatientField('name_prefix', event.target.value)}>
              <option value="">-</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="Dr">Dr</option>
              <option value="Master">Master</option>
              <option value="Baby">Baby</option>
            </SelectInput>
            <TextInput label="First / full name" required value={patientForm.full_name || ''} onChange={(event) => setPatientField('full_name', event.target.value)} />
            <TextInput label="Last name" value={patientForm.last_name || ''} onChange={(event) => setPatientField('last_name', event.target.value)} />
            <TextInput label="Mobile" value={patientForm.phone || ''} onChange={(event) => setPatientField('phone', event.target.value)} placeholder="10 digit mobile" />
            <TextInput label="Alt phone" value={patientForm.alt_phone || ''} onChange={(event) => setPatientField('alt_phone', event.target.value)} placeholder="Optional" />
            <SelectInput label="Sex" value={patientForm.sex || ''} onChange={(event) => setPatientField('sex', event.target.value)}>
              <option value="">-</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="Birthdate" type="date" value={patientForm.dob || ''} onChange={(event) => setPatientField('dob', event.target.value)} />
            <TextInput label="Age (yrs)" value={String(patientForm.age_years ?? '')} onChange={(event) => setPatientField('age_years', event.target.value)} />
            <TextInput label="Email" type="email" value={patientForm.email || ''} onChange={(event) => setPatientField('email', event.target.value)} />
            <TextInput label="Husband / Father name" value={patientForm.husband_or_father_name || ''} onChange={(event) => setPatientField('husband_or_father_name', event.target.value)} />
            <SelectInput label="ID proof" value={patientForm.id_proof_type || ''} onChange={(event) => setPatientField('id_proof_type', event.target.value)}>
              <option value="">-</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="voter_id">Voter ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving license</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="ID proof number" value={patientForm.id_proof_number || ''} onChange={(event) => setPatientField('id_proof_number', event.target.value)} />
          </div>
          <div className="grid-2 mt-3">
            <TextInput label="Address 1" value={patientForm.address_line1 || ''} onChange={(event) => setPatientField('address_line1', event.target.value)} />
            <TextInput label="Address 2" value={patientForm.address_line2 || ''} onChange={(event) => setPatientField('address_line2', event.target.value)} />
            <TextInput label="Address 3" value={patientForm.address_line3 || ''} onChange={(event) => setPatientField('address_line3', event.target.value)} />
            <TextInput label="City" value={patientForm.city || ''} onChange={(event) => setPatientField('city', event.target.value)} />
            <TextInput label="State" value={patientForm.state || ''} onChange={(event) => setPatientField('state', event.target.value)} />
          </div>
          <Button type="submit" disabled={loading} variant="primary" icon={Plus} className="mt-4">
            {loading ? 'Saving...' : 'Create patient and continue'}
          </Button>
        </form>

        <div className="card card-pad">
          <SectionHeader icon={Search} title="Find patient" sub="Search, select, then see history and create visit" />
          <div className="actions">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && search(query)} placeholder="MRN, name, or phone" />
            <Button variant="secondary" icon={Search} onClick={() => search(query)}>Search</Button>
          </div>
          <div className="table-wrap mt-3">
            <table className="dt">
              <thead><tr><th>MRN</th><th>Name</th><th>Phone</th><th /></tr></thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id} className={selectedPatient?.id === patient.id ? 'selected' : ''}>
                    <td className="mono">{patient.mrn}</td>
                    <td className="strong">{patient.full_name}</td>
                    <td>{patient.phone || '-'}</td>
                    <td>
                      <Button size="sm" variant={selectedPatient?.id === patient.id ? 'primary' : 'secondary'} onClick={() => choosePatient(patient)}>
                        {selectedPatient?.id === patient.id ? 'Selected' : 'Select'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && <tr><td colSpan={4}><EmptyState title="No patients" sub="Search or create a new patient." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedPatient && (
        <HistoryPanel
          history={history}
          nodes={nodes}
          loading={historyLoading}
          onMessage={setMessage}
          onRefresh={async () => {
            if (selectedPatient) setHistory(await apiPatientHistory(selectedPatient.id));
          }}
        />
      )}
    </div>
  );
}

function Step({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return <div className={`workflow-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>{label}</div>;
}

function calculateAge(dobValue: string): number | null {
  if (!dobValue) return null;
  const dob = new Date(dobValue);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function VisitPanel(props: {
  patient: Patient;
  services: any[];
  selectedServiceIds: number[];
  toggleService: (id: number) => void;
  referringDoctors: any[];
  refDocId: string;
  setRefDocId: (value: string) => void;
  discount: string;
  setDiscount: (value: string) => void;
  selectedTotal: number;
  netTotal: number;
  payAmount: string;
  setPayAmount: (value: string) => void;
  payMode: string;
  setPayMode: (value: string) => void;
  paymentRef: string;
  setPaymentRef: (value: string) => void;
  newDoctorName: string;
  setNewDoctorName: (value: string) => void;
  addReferringDoctor: () => void;
  loading: boolean;
  completeVisit: () => void;
  changePatient: () => void;
}) {
  return (
    <div className="card card-pad mt-4" style={{ borderColor: 'var(--app-accent)' }}>
      <SectionHeader icon={ClipboardList} title={`Visit for ${props.patient.full_name}`} sub={`${props.patient.mrn} | ${props.patient.phone || 'No phone'}`}>
        <Button size="sm" variant="ghost" onClick={props.changePatient}>Change patient</Button>
      </SectionHeader>
      <div className="grid-2">
        <div>
          <div className="field-label">Select service</div>
          <div className="grid-auto mt-3">
            {props.services.map((service) => (
              <label key={service.id} className={`checkrow ${props.selectedServiceIds.includes(service.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={props.selectedServiceIds.includes(service.id)} onChange={() => props.toggleService(service.id)} />
                <span className="strong" style={{ flex: 1 }}>{service.name}</span>
                <ModalityTag modality={service.modality} />
                <span className="mono">Rs {service.price}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SelectInput label="Referring doctor" value={props.refDocId} onChange={(event) => props.setRefDocId(event.target.value)}>
            <option value="">None</option>
            {props.referringDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
          </SelectInput>
          <div className="actions">
            <TextInput
              label="Add referring doctor"
              value={props.newDoctorName}
              onChange={(event) => props.setNewDoctorName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && props.addReferringDoctor()}
              placeholder="Doctor name"
              style={{ flex: 1, minWidth: 180 }}
            />
            <Button variant="secondary" icon={Plus} onClick={props.addReferringDoctor} disabled={!props.newDoctorName.trim()}>
              Add
            </Button>
          </div>
          <div className="grid-2">
            <TextInput label="Discount" value={props.discount} onChange={(event) => props.setDiscount(event.target.value)} />
            <TextInput label="Paid now" value={props.payAmount} onChange={(event) => props.setPayAmount(event.target.value)} />
          </div>
          <div className="grid-2">
            <SelectInput label="Payment mode" value={props.payMode} onChange={(event) => props.setPayMode(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="Payment reference" value={props.paymentRef} onChange={(event) => props.setPaymentRef(event.target.value)} />
          </div>
          <div className="card card-surface card-pad">
            <div className="between"><span className="muted">Total</span><span className="strong">Rs {props.selectedTotal.toFixed(2)}</span></div>
            <div className="between mt-3"><span className="muted">Net after discount</span><span className="strong accent">Rs {props.netTotal.toFixed(2)}</span></div>
          </div>
          <Button variant="primary" icon={Receipt} disabled={props.loading || props.selectedServiceIds.length === 0} onClick={props.completeVisit}>
            Create visit, take payment, print receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  nodes,
  loading,
  onMessage,
  onRefresh,
}: {
  history: PatientHistory | null;
  nodes: DicomNode[];
  loading: boolean;
  onMessage: (message: string | null) => void;
  onRefresh: () => Promise<void>;
}) {
  const visits = useMemo(() => history?.visits || [], [history]);
  const [openVisitId, setOpenVisitId] = useState<number | null>(null);
  const prepareConsoleWorklist = async (order?: Order, nodeId?: string) => {
    try {
      const node = nodeId ? nodes.find((item) => String(item.id) === nodeId) : null;
      if (order && node) {
        await apiUpdateOrderDestination(order.id, node.id);
      }
      const result = await apiGenerateWorklist(order?.id);
      const target = node ? ` for ${node.name} (${node.ae_title})` : '';
      const text = `Patient details sent to console worklist${target}. ${result.generated} pending order(s) refreshed. On the machine console, open Worklist/Patient Query and select this accession.`;
      onMessage(text);
      window.alert(text);
    } catch (err: any) {
      const text = err?.message || 'Could not prepare console worklist';
      onMessage(text);
      window.alert(text);
    }
  };
  const editAccession = async (order: Order) => {
    const value = window.prompt('Enter accession number', order.accession_number);
    const next = value?.trim();
    if (!next || next === order.accession_number) return;
    try {
      await apiUpdateAccession(order.id, next);
      onMessage(`Accession updated to ${next.toUpperCase()}`);
      await onRefresh();
    } catch (err: any) {
      onMessage(err?.message || 'Could not update accession');
    }
  };
  return (
    <div className="card mt-5">
      <div className="card-head">
        <span className="ch-title"><History size={16} /> Patient history</span>
      </div>
      {loading ? <div className="card-pad field-hint">Loading history...</div> : visits.length === 0 ? (
        <EmptyState title="No previous visits" sub="Create the first visit above." />
      ) : (
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="dt">
            <thead><tr><th>Visit</th><th>Date</th><th>Services / accession</th><th>Paid</th><th>Status</th><th>Next step</th><th>Receipt</th></tr></thead>
            <tbody>
              {visits.map((visit) => (
                <Fragment key={visit.id}>
                  <tr className={openVisitId === visit.id ? 'selected' : ''} onClick={() => setOpenVisitId(openVisitId === visit.id ? null : visit.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{visit.visit_no}</td>
                    <td>{visit.visit_datetime}</td>
                    <td>
                      {visit.orders.map((order) => (
                        <div key={order.id}>
                          <span className="strong">{order.service_name || 'Service'}</span>
                          <span className="mono"> {order.accession_number}{order.token_no ? ` | ${order.token_no}` : ''}</span>
                        </div>
                      ))}
                    </td>
                    <td>Rs {visit.paid_amount}</td>
                    <td><StatusChip status={visit.status} /></td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {visit.orders[0] && history?.patient ? (
        <SendDetailsActions
          nodes={nodes}
          patient={history.patient}
          order={visit.orders[0]}
          prepareConsoleWorklist={prepareConsoleWorklist}
          editAccession={editAccession}
        />
                      ) : <span className="field-hint">-</span>}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {visit.receipts[0]?.print_url ? (
                        <a className="btn btn-secondary" href={visit.receipts[0].print_url} target="_blank" rel="noreferrer">
                          <Printer size={16} /> Print
                        </a>
                      ) : <span className="field-hint">-</span>}
                    </td>
                  </tr>
                  {openVisitId === visit.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="history-detail">
                          <div className="grid-3">
                            <DetailBox label="Visit" value={`${visit.visit_no} | ${visit.status}`} />
                            <DetailBox label="Amount" value={`Net Rs ${visit.net_amount} | Paid Rs ${visit.paid_amount} | Balance Rs ${visit.balance}`} />
                            <DetailBox label="Discount" value={`Rs ${visit.discount || '0.00'}`} />
                          </div>
                          <div className="grid-2 mt-3">
                            <div>
                              <div className="field-label">Services and accession numbers</div>
                              {visit.orders.map((order) => (
                                <div key={order.id} className="card card-surface card-pad mt-3">
                                  <div className="between">
                                    <span className="strong">{order.service_name || 'Service'}</span>
                                    <StatusChip status={order.status} />
                                  </div>
                                  <div className="accession-list">
                                    <span className="accession-code">{order.accession_number}</span>
                                    {order.token_no ? <span className="accession-code">{order.token_no}</span> : null}
                                  </div>
                                  {order.room_title ? <div className="field-hint mt-3">Room: {order.room_title}</div> : null}
                                  <div className="field-hint mt-3">Study UID: <span className="mono">{order.study_instance_uid || '-'}</span></div>
                                  {history?.patient && (
                                    <div className="actions mt-3">
                                      <SendDetailsActions
                                        nodes={nodes}
                                        patient={history.patient}
                                        order={order}
                                        prepareConsoleWorklist={prepareConsoleWorklist}
                                        editAccession={editAccession}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="field-label">Payments and receipts</div>
                              {visit.payments.length === 0 ? <div className="field-hint mt-3">No payments recorded.</div> : visit.payments.map((payment) => (
                                <div key={payment.id} className="between card card-surface card-pad mt-3">
                                  <span className="strong">Rs {payment.amount} ({payment.mode})</span>
                                  <span className="field-hint">{payment.reference || payment.received_at || '-'}</span>
                                </div>
                              ))}
                              <div className="actions mt-3">
                                {visit.receipts.map((receipt) => (
                                  <a key={receipt.id} className="btn btn-secondary" href={receipt.print_url || '#'} target="_blank" rel="noreferrer">
                                    <Printer size={16} /> Print {receipt.receipt_no}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SendDetailsActions({
  nodes,
  patient,
  order,
  prepareConsoleWorklist,
  editAccession,
}: {
  nodes: DicomNode[];
  patient: Patient;
  order: Order & { service_name?: string | null };
  prepareConsoleWorklist: (order?: Order, nodeId?: string) => void;
  editAccession: (order: Order) => void;
}) {
  void patient;
  const [nodeId, setNodeId] = useState('');
  return (
    <div className="actions">
      {nodes.length > 0 ? (
        <SelectInput value={nodeId} onChange={(event) => setNodeId(event.target.value)} style={{ width: 190 }}>
          <option value="">Select room</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.ae_title})</option>)}
        </SelectInput>
      ) : null}
      <Button size="sm" variant="secondary" icon={MonitorUp} onClick={() => prepareConsoleWorklist(order, nodeId)}>
        Send to console
      </Button>
      <Button size="sm" variant="ghost" onClick={() => editAccession(order)}>
        Edit accession
      </Button>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-surface card-pad">
      <div className="field-label">{label}</div>
      <div className="strong mt-3">{value}</div>
    </div>
  );
}
