import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Flag, History, Mail, MessageSquare, MonitorUp, MoreVertical, Plus, Printer, Receipt, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Banner, Button, EmptyState, IconButton, ModalityTag, SectionHeader, SelectInput, StatusChip, TextareaInput, TextInput } from '@/components/RisUi';
import { useReceptionStore } from '../stores/receptionStore';
import { apiGenerateWorklist, apiPatientHistory, apiQuickUpdateVisit, apiReceptionVisits, apiSyncReturnedReports, apiUpdateAccession, apiUpdateDispatch, apiUpdateOrderDestination, apiUpdatePatient, apiUpdateVisitDetails, type Order, type Patient, type PatientHistory, type PatientHistoryVisit, type ReceptionVisitRow, type VisitTotals } from '../api/receptionApi';
import { apiDicomNodes, apiMasters, type DicomNode, type Center, type Pro, type Lookup } from '@/features/settings/api/settingsApi';
import type { PatientForm } from '../lib/patientForm';
import type { VisitForm } from '../lib/visitForm';
import { useBillingStore } from '@/features/billing/stores/billingStore';
import { apiTakePayment, printAssetUrl, type Receipt as ReceiptRow } from '@/features/billing/api/billingApi';
import { getCachedData } from '../../../lib/risDataCache';
import { formatRisDateTime } from '../../../lib/dateFormat';

const RECEPTION_ROLES = ['receptionist'];

const EMPTY_PATIENT: PatientForm = {
  name_prefix: '',
  full_name: '',
  last_name: '',
  phone: '',
  alt_phone: '',
  patient_group: '',
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

const todayInput = () => new Date().toISOString().slice(0, 10);
const monthStartInput = () => new Date().toISOString().slice(0, 8) + '01';
const timeInput = () => new Date().toTimeString().slice(0, 5);
const PAGE_SIZE = 50;
const EMPTY_TOTALS: VisitTotals = { records: 0, total: 0, others: 0, discount: 0, net: 0, paid: 0, balance: 0, refund: 0 };
const receptionVisitCache: { key: string; rows: ReceptionVisitRow[]; totals: VisitTotals; at: number } = { key: '', rows: [], totals: EMPTY_TOTALS, at: 0 };
const patientHistoryCache = new Map<number, PatientHistory>();

function receptionVisitsKey(filters: Record<string, string | boolean | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== false) params.set(key, String(value));
  }
  return `GET /api/reception/visits.php?${params.toString()}`;
}

function ModalCloseButton({ onClick, title = 'Close' }: { onClick: () => void; title?: string }) {
  return <IconButton className="modal-x" sm bordered icon={X} title={title} aria-label={title} onClick={onClick} />;
}

export function ReceptionPage() {
  const navigate = useNavigate();
  const role = (useAuthStore((state) => state.user)?.role as string) || '';
  const {
    patients, services, referringDoctors, loading, error,
    register, loadServices, loadReferringDoctors, registerVisit,
  } = useReceptionStore();
  const { takePayment, generateReceipt, error: billingError } = useBillingStore();

  const [query, setQuery] = useState('');
  const [visitRows, setVisitRows] = useState<ReceptionVisitRow[]>([]);
  const [visitTotals, setVisitTotals] = useState<VisitTotals>(EMPTY_TOTALS);
  const [page, setPage] = useState(1);
  const [showLegend, setShowLegend] = useState(false);
  const [indicatorFilter, setIndicatorFilter] = useState<IndicatorKey | null>(null);
  const [actionModal, setActionModal] = useState<{ kind: 'payment' | 'refund' | 'others' | 'discount' | 'center' | 'comment'; row: ReceptionVisitRow } | null>(null);
  const [actionValue, setActionValue] = useState('');
  const [actionMode, setActionMode] = useState('cash');
  const [rowMenu, setRowMenu] = useState<{ x: number; y: number; row: ReceptionVisitRow } | null>(null);
  const [visitFilters, setVisitFilters] = useState({
    from: monthStartInput(),
    to: todayInput(),
    center: '',
    doctor: '',
    consultant: '',
    dept: '',
    group: '',
    status: '',
    patient: '',
    ref_no: '',
    test: '',
    outstanding: false,
  });
  const [patientForm, setPatientForm] = useState<PatientForm>({ ...EMPTY_PATIENT });
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientEditing, setPatientEditing] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);
  const [patientEditForm, setPatientEditForm] = useState<Record<string, string | number | null>>({});
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [refDocId, setRefDocId] = useState('');
  const [regDate, setRegDate] = useState(todayInput());
  const [centerName, setCenterName] = useState('Main Lab');
  const [doctorName, setDoctorName] = useState('');
  const [consultantDoctor, setConsultantDoctor] = useState('');
  const [sampleDate, setSampleDate] = useState(todayInput());
  const [sampleTime, setSampleTime] = useState(timeInput());
  const [refNo, setRefNo] = useState('');
  const [urgentReport, setUrgentReport] = useState(false);
  const [visitComment, setVisitComment] = useState('');
  const [phlebotomyStaff, setPhlebotomyStaff] = useState('');
  const [homeVisitArea, setHomeVisitArea] = useState('');
  const [homeVisitAmount, setHomeVisitAmount] = useState('');
  const [homeVisitTime, setHomeVisitTime] = useState(timeInput());
  const [dispatchMode, setDispatchMode] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [deliveryDestination, setDeliveryDestination] = useState('patient');
  const [proName, setProName] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [regularPatient, setRegularPatient] = useState(true);
  const [miscCharge, setMiscCharge] = useState('');
  const [printBarcode, setPrintBarcode] = useState(false);
  const [printSrs, setPrintSrs] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [printBillReceipt, setPrintBillReceipt] = useState(false);
  const [sendToPrinter, setSendToPrinter] = useState(true);
  const [discount, setDiscount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerRelation, setPayerRelation] = useState('');
  const [payerMobile, setPayerMobile] = useState('');
  const [nodes, setNodes] = useState<DicomNode[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [staffList, setStaffList] = useState<Lookup[]>([]);
  const [areaList, setAreaList] = useState<Lookup[]>([]);
  const [groupList, setGroupList] = useState<Lookup[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [visitSaveError, setVisitSaveError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const actionLockRef = useRef<string | null>(null);
  const [completed, setCompleted] = useState<{
    visitNo: string;
    orders: Array<Order & { service_name?: string }>;
    receipt: ReceiptRow | null;
    balance: string;
    printLinks: Array<{ label: string; url: string }>;
  } | null>(null);

  const closeAllReceptionOverlays = () => {
    setActionModal(null);
    setRowMenu(null);
    setPatientModalOpen(false);
    setVisitModalOpen(false);
    setCompleted(null);
    setSelectedPatient(null);
    setHistory(null);
    setPatientEditing(false);
    resetVisitForm();
  };

  useEffect(() => {
    const onReselect = () => closeAllReceptionOverlays();
    window.addEventListener('ris:reception-reselect', onReselect);
    return () => window.removeEventListener('ris:reception-reselect', onReselect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!RECEPTION_ROLES.includes(role)) return;
    loadServices();
    loadReferringDoctors();
    if (receptionVisitCache.rows.length > 0) {
      setVisitRows(receptionVisitCache.rows);
      setVisitTotals(receptionVisitCache.totals);
    } else {
      const initial = { ...visitFilters, page: 1, page_size: PAGE_SIZE, include_totals: 0 };
      const warmed = getCachedData<{ rows: ReceptionVisitRow[]; totals: VisitTotals }>(receptionVisitsKey(initial), 60_000);
      if (warmed?.rows?.length) {
        receptionVisitCache.key = JSON.stringify(initial);
        receptionVisitCache.rows = warmed.rows;
        receptionVisitCache.totals = warmed.totals || EMPTY_TOTALS;
        receptionVisitCache.at = Date.now();
        setVisitRows(warmed.rows);
        setVisitTotals(warmed.totals || EMPTY_TOTALS);
      }
    }
    apiDicomNodes().then(setNodes).catch(() => setNodes([]));
    apiMasters<Center>('centers', { active: '1' }).then(setCenters).catch(() => setCenters([]));
    apiMasters<Pro>('pros', { active: '1' }).then(setPros).catch(() => setPros([]));
    apiMasters<Lookup>('lookups', { category: 'phlebotomy_staff' }).then(setStaffList).catch(() => setStaffList([]));
    apiMasters<Lookup>('lookups', { category: 'home_visit_area' }).then(setAreaList).catch(() => setAreaList([]));
    apiMasters<Lookup>('lookups', { category: 'patient_group' }).then(setGroupList).catch(() => setGroupList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, loadServices, loadReferringDoctors]);

  useEffect(() => {
    if (!selectedPatient) {
      setPatientEditForm({});
      return;
    }
    setPatientEditForm({
      name_prefix: selectedPatient.name_prefix || '',
      full_name: selectedPatient.full_name || '',
      phone: selectedPatient.phone || '',
      alt_phone: selectedPatient.alt_phone || '',
      patient_group: selectedPatient.patient_group || '',
      sex: selectedPatient.sex || '',
      dob: selectedPatient.dob || '',
      age_years: selectedPatient.age_years ?? '',
      email: selectedPatient.email || '',
      address_line1: selectedPatient.address_line1 || selectedPatient.address || '',
    });
  }, [selectedPatient]);

  const loadVisitRows = async (nextFilters = visitFilters, nextPage = page, includeTotals = false) => {
    const merged = { ...nextFilters, page: nextPage, page_size: PAGE_SIZE, include_totals: includeTotals ? 1 : 0 };
    const key = JSON.stringify(merged);
    if (receptionVisitCache.key === key && receptionVisitCache.rows.length > 0 && Date.now() - receptionVisitCache.at < 60000) {
      setVisitRows(receptionVisitCache.rows);
      setVisitTotals(receptionVisitCache.totals);
      return;
    }
    const warmed = getCachedData<{ rows: ReceptionVisitRow[]; totals: VisitTotals }>(receptionVisitsKey(merged), 60_000);
    if (warmed?.rows) {
      receptionVisitCache.key = key;
      receptionVisitCache.rows = warmed.rows;
      receptionVisitCache.totals = warmed.totals || EMPTY_TOTALS;
      receptionVisitCache.at = Date.now();
      setVisitRows(warmed.rows);
      setVisitTotals(warmed.totals || EMPTY_TOTALS);
    }
    try {
      const { rows, totals } = await apiReceptionVisits(merged);
      receptionVisitCache.key = key;
      receptionVisitCache.rows = rows;
      receptionVisitCache.totals = totals;
      receptionVisitCache.at = Date.now();
      setVisitRows(rows);
      setVisitTotals(totals);
    } catch {
      if (receptionVisitCache.rows.length > 0) { setVisitRows(receptionVisitCache.rows); setVisitTotals(receptionVisitCache.totals); }
      else { setVisitRows([]); setVisitTotals(EMPTY_TOTALS); }
    }
  };

  const gotoPage = (p: number) => { setPage(p); loadVisitRows(visitFilters, p); };

  const updateVisitFilter = (key: keyof typeof visitFilters, value: string | boolean) => {
    setVisitFilters((current) => ({ ...current, [key]: value }));
  };

  const updatePatientEditField = (key: keyof Patient, value: string | number | null) => {
    setPatientEditForm((current) => ({ ...current, [key]: value }));
  };

  const savePatientDetails = async () => {
    if (!selectedPatient || patientSaving) return;
    setPatientSaving(true);
    try {
      const saved = await apiUpdatePatient({ id: selectedPatient.id, ...patientEditForm });
      setSelectedPatient(saved);
      setHistory((current) => current ? { ...current, patient: saved } : current);
      patientHistoryCache.delete(selectedPatient.id);
      setPatientEditing(false);
      setMessage('Patient details updated');
    } catch (err: any) {
      setMessage(err?.message || 'Could not update patient details');
    } finally {
      setPatientSaving(false);
    }
  };

  useEffect(() => {
    if (!RECEPTION_ROLES.includes(role)) return;
    const id = window.setTimeout(() => {
      setPage(1);
      loadVisitRows(visitFilters, 1);
    }, 80);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitFilters, role]);

  // Close the row action menu on any outside click, scroll, or Escape.
  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setRowMenu(null); };
    // Defer so the opening click itself does not immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('contextmenu', close);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [rowMenu]);

  // Close the legend popover on any outside click or Escape.
  useEffect(() => {
    if (!showLegend) return;
    const close = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target && target.closest && (target.closest('.legend-pop') || target.closest('.legend-toggle'))) return;
      setShowLegend(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setShowLegend(false); };
    const id = window.setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [showLegend]);

  // Open the row action menu from a button, clamped inside the viewport.
  const openRowMenu = (event: React.MouseEvent, row: ReceptionVisitRow) => {
    event.preventDefault();
    event.stopPropagation();
    const menuW = 210;
    const menuH = Math.min(560, window.innerHeight * 0.85);
    const x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuW - 8));
    const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuH - 8));
    setRowMenu({ x, y, row });
  };

  const markStatus = async (row: ReceptionVisitRow, mark: 'emailed' | 'printed' | 'ready' | 'not_ready', label: string) => {
    setRowMenu(null);
    try {
      await apiQuickUpdateVisit({ visit_id: row.id, mark });
      setMessage(label);
      await refreshAfterVisitChange();
    } catch (err: any) {
      setMessage(err?.message || 'Could not update status');
    }
  };

  const selectedServices = services.filter((service) => serviceIds.includes(service.id));
  const selectedTotal = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const netTotal = Math.max(0, selectedTotal + Number(miscCharge || 0) + Number(homeVisitAmount || 0) - Number(discount || 0));
  const balanceDue = Math.max(0, netTotal - Number(payAmount || 0));

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
    setVisitSaveError(null);
    setMessage(`${patient.full_name} selected`);
    const cached = patientHistoryCache.get(patient.id);
    if (cached) {
      setHistory(cached);
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
    }
    try {
      const next = await apiPatientHistory(patient.id);
      patientHistoryCache.set(patient.id, next);
      setHistory(next);
    } catch {
      if (!cached) setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const optimisticHistoryFromRow = (row: ReceptionVisitRow): PatientHistory => ({
    patient: {
      id: row.patient_id,
      mrn: row.mrn,
      dicom_patient_id: null,
      name_prefix: null,
      full_name: row.full_name,
      last_name: null,
      dob: null,
      age_years: row.age_years,
      sex: row.sex,
      phone: row.phone,
      alt_phone: null,
      patient_group: row.patient_group,
      email: null,
      address: null,
      address_line1: null,
      address_line2: null,
      address_line3: null,
      city: null,
      state: null,
      husband_or_father_name: null,
      id_proof_type: null,
      id_proof_number: null,
      aadhaar_number: null,
    },
    visits: [{
      id: row.id,
      visit_no: row.visit_no,
      patient_id: row.patient_id,
      center_name: row.center_name,
      consultant_doctor: row.consultant_doctor,
      sample_collected_at: null,
      ref_no: row.ref_no,
      urgent_report: row.urgent_report,
      visit_comment: row.visit_comment,
      misc_charge: row.misc_charge,
      dispatch_mode: row.dispatch_mode,
      dispatch_note: row.dispatch_note,
      delivery_destination: row.delivery_destination,
      print_barcode: row.print_barcode,
      print_srs: row.print_srs,
      print_receipt: row.print_receipt,
      print_bill_receipt: row.print_bill_receipt,
      send_to_printer: row.send_to_printer,
      visit_datetime: row.visit_datetime,
      total_amount: row.total_amount,
      discount: row.discount,
      net_amount: row.net_amount,
      paid_amount: row.paid_amount,
      balance: row.balance,
      status: row.status,
      orders: [],
      receipts: [],
      payments: [],
    } as PatientHistoryVisit],
    duplicate_patient_ids: [row.patient_id],
  });

  const chooseVisitRow = async (row: ReceptionVisitRow) => {
    const patient = {
      id: row.patient_id,
      mrn: row.mrn,
      dicom_patient_id: null,
      name_prefix: null,
      full_name: row.full_name,
      last_name: null,
      dob: null,
      age_years: row.age_years,
      sex: row.sex,
      phone: row.phone,
      alt_phone: null,
      patient_group: row.patient_group,
      email: null,
      address: null,
      address_line1: null,
      address_line2: null,
      address_line3: null,
      city: null,
      state: null,
      husband_or_father_name: null,
      id_proof_type: null,
      id_proof_number: null,
      aadhaar_number: null,
    };
    setSelectedPatient(patient);
    setCompleted(null);
    setVisitSaveError(null);
    setMessage(`${row.full_name} selected`);
    const cached = patientHistoryCache.get(row.patient_id);
    setHistory(cached || optimisticHistoryFromRow(row));
    setHistoryLoading(!cached);
    try {
      const next = await apiPatientHistory(row.patient_id);
      patientHistoryCache.set(row.patient_id, next);
      setHistory(next);
    } catch {
      if (!cached) setHistory(optimisticHistoryFromRow(row));
    } finally {
      setHistoryLoading(false);
    }
  };

  const syncReturnedReports = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = 'sync-reports';
    setActionKey('sync-reports');
    try {
      const result = await apiSyncReturnedReports();
      setMessage(`Received studies synced. Matched ${result.matched || 0} report/image set(s).`);
      receptionVisitCache.at = 0;
      await loadVisitRows();
      if (selectedPatient) {
        const next = await apiPatientHistory(selectedPatient.id);
        patientHistoryCache.set(selectedPatient.id, next);
        setHistory(next);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Could not sync returned reports');
    } finally {
      actionLockRef.current = null;
      setActionKey(null);
    }
  };

  const refreshSelectedHistory = async () => {
    if (!selectedPatient) return;
    const next = await apiPatientHistory(selectedPatient.id);
    patientHistoryCache.set(selectedPatient.id, next);
    setHistory(next);
  };

  const updateHistoryVisit = (visitId: number, patch: Partial<PatientHistoryVisit>) => {
    setHistory((current) => {
      if (!current) return current;
      const next = {
        ...current,
        visits: current.visits.map((visit) => visit.id === visitId ? { ...visit, ...patch } : visit),
      };
      patientHistoryCache.set(current.patient.id, next);
      return next;
    });
    setVisitRows((current) => {
      const next = current.map((row) => row.id === visitId ? { ...row, ...patch } as ReceptionVisitRow : row);
      if (receptionVisitCache.rows.length > 0) receptionVisitCache.rows = next;
      return next;
    });
  };

  const createPatient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (actionLockRef.current) return;
    actionLockRef.current = 'create-patient';
    setActionKey('create-patient');
    const mobile = (patientForm.phone || '').replace(/\D/g, '');
    const existing = mobile
      ? patients.find((patient) => (patient.phone || '').replace(/\D/g, '') === mobile)
      : null;
    try {
      if (existing) {
        setPatientForm({ ...EMPTY_PATIENT });
        setPatientModalOpen(false);
        await choosePatient(existing);
        setVisitModalOpen(true);
        setMessage(`Existing patient ${existing.mrn} selected for this mobile number`);
        return;
      }
      const created = await register(patientForm);
      if (created) {
        setPatientForm({ ...EMPTY_PATIENT });
        setPatientModalOpen(false);
        await choosePatient(created);
        setVisitModalOpen(true);
      }
    } finally {
      actionLockRef.current = null;
      setActionKey(null);
    }
  };

  const toggleService = (id: number) =>
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));

  const resetVisitForm = () => {
    setServiceIds([]);
    setRefDocId('');
    setRegDate(todayInput());
    setCenterName('Main Lab');
    setDoctorName('');
    setConsultantDoctor('');
    setSampleDate(todayInput());
    setSampleTime(timeInput());
    setRefNo('');
    setUrgentReport(false);
    setVisitComment('');
    setPhlebotomyStaff('');
    setHomeVisitArea('');
    setHomeVisitAmount('');
    setHomeVisitTime(timeInput());
    setDispatchMode('');
    setDispatchNote('');
    setDeliveryDestination('patient');
    setProName('');
    setCommissionAmount('');
    setRegularPatient(true);
    setMiscCharge('');
    setPrintBarcode(false);
    setPrintSrs(false);
    setPrintReceipt(true);
    setPrintBillReceipt(false);
    setSendToPrinter(true);
    setDiscount('');
    setPayAmount('');
    setPayMode('cash');
    setPaymentRef('');
    setPayerName('');
    setPayerRelation('');
    setPayerMobile('');
  };

  const completeVisit = async () => {
    if (!selectedPatient || selectedServices.length === 0) return;
    if (actionLockRef.current) return;
    actionLockRef.current = 'complete-visit';
    setActionKey('complete-visit');
    setMessage(null);
    setVisitSaveError(null);
    setCompleted(null);

    const visitForm: VisitForm = {
      patient_id: selectedPatient.id,
      referring_doctor_id: refDocId ? Number(refDocId) : null,
      center_name: centerName,
      consultant_doctor: consultantDoctor,
      sample_collected_at: sampleDate ? `${sampleDate} ${sampleTime || '00:00'}:00` : undefined,
      ref_no: refNo,
      urgent_report: urgentReport,
      visit_comment: visitComment,
      phlebotomy_staff: phlebotomyStaff,
      home_visit_area: homeVisitArea,
      home_visit_amount: homeVisitAmount,
      home_visit_time: homeVisitTime,
      dispatch_mode: dispatchMode,
      dispatch_note: dispatchNote,
      delivery_destination: deliveryDestination,
      pro_name: proName,
      commission_amount: commissionAmount,
      regular_patient: regularPatient,
      misc_charge: miscCharge,
      services: selectedServices.map((service) => ({
        service_id: service.id,
        price: service.price,
        modality: service.modality,
      })),
      discount,
    };

    try {
      const result = await registerVisit(visitForm);
      if (!result) {
        const stateError = useReceptionStore.getState().error;
        setVisitSaveError(stateError || 'Visit could not be saved. Check required fields and try again.');
        return;
      }

      let balance = result.visit.balance;
      const amount = Number(payAmount || 0);
      if (amount > 0) {
        const paidVisit = await takePayment(result.visit.id, amount, payMode, paymentRef || undefined, false, {
          payer_name: payerName || undefined,
          payer_relation: payerRelation || undefined,
          payer_mobile: payerMobile || undefined,
        });
        if (!paidVisit) {
          const stateError = useBillingStore.getState().error;
          setVisitSaveError(stateError || 'Visit was saved, but payment could not be recorded. Open the patient and collect payment again.');
          return;
        }
        balance = paidVisit.balance;
      }

      const receipt = await generateReceipt(result.visit.id);
      if (!receipt) {
        const stateError = useBillingStore.getState().error;
        setVisitSaveError(stateError || 'Visit and payment were saved, but receipt could not be generated.');
      }

      const completedOrders = result.orders.map((order) => {
        const service = selectedServices.find((item) => item.id === order.service_id);
        return {
          ...order,
          service_name: service?.name || '',
        };
      });
      // Offer every print document on the completed screen; the user prints what they need.
      const printLinks = buildPrintLinks(result.visit.id, {
        barcode: true,
        srs: true,
        receipt: true,
        billReceipt: true,
      }, receipt);
      setCompleted({ visitNo: result.visit.visit_no, orders: completedOrders, receipt, balance, printLinks });
      setMessage('Visit and payment saved');
      resetVisitForm();
      await refreshSelectedHistory();
      receptionVisitCache.at = 0;
      await loadVisitRows();
    } catch (err: any) {
      setVisitSaveError(err?.message || 'Save failed. Please try again.');
    } finally {
      actionLockRef.current = null;
      setActionKey(null);
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

  const refreshAfterVisitChange = async () => {
    receptionVisitCache.at = 0;
    await loadVisitRows();
    if (selectedPatient) {
      try { setHistory(await apiPatientHistory(selectedPatient.id)); } catch { /* ignore */ }
    }
  };

  const openAction = (kind: 'payment' | 'refund' | 'others' | 'discount' | 'center' | 'comment', row: ReceptionVisitRow) => {
    if (kind === 'others') setActionValue(String(row.misc_charge ?? ''));
    else if (kind === 'discount') setActionValue(String(row.discount ?? ''));
    else if (kind === 'center') setActionValue(row.center_name ?? '');
    else if (kind === 'comment') setActionValue(row.visit_comment ?? '');
    else if (kind === 'payment') setActionValue(String(Math.max(0, Number(row.balance) || 0)));
    else setActionValue('');
    setActionMode('cash');
    setActionModal({ kind, row });
    setRowMenu(null);
  };

  const submitAction = async () => {
    if (!actionModal) return;
    const { kind, row } = actionModal;
    setMessage(null);
    try {
      if (kind === 'payment' || kind === 'refund') {
        const amt = Number(actionValue || 0);
        if (amt <= 0) { setMessage('Enter an amount greater than zero'); return; }
        await apiTakePayment({ visit_id: row.id, amount: amt, mode: actionMode, is_refund: kind === 'refund' });
      } else if (kind === 'others') {
        await apiQuickUpdateVisit({ visit_id: row.id, misc_charge: Number(actionValue || 0) });
      } else if (kind === 'discount') {
        await apiQuickUpdateVisit({ visit_id: row.id, discount: Number(actionValue || 0) });
      } else if (kind === 'center') {
        await apiQuickUpdateVisit({ visit_id: row.id, center_name: actionValue.trim() });
      } else if (kind === 'comment') {
        await apiQuickUpdateVisit({ visit_id: row.id, visit_comment: actionValue });
      }
      setActionModal(null);
      setMessage('Updated');
      await refreshAfterVisitChange();
    } catch (err: any) {
      setMessage(err?.message || 'Action failed');
    }
  };

  const toggleUrgent = async (row: ReceptionVisitRow) => {
    setRowMenu(null);
    const next = Number(row.urgent_report || 0) === 1 ? 0 : 1;
    try {
      await apiQuickUpdateVisit({ visit_id: row.id, urgent_report: next });
      setMessage(next ? 'Marked urgent — moved to top' : 'Urgent flag removed');
      await refreshAfterVisitChange();
    } catch (err: any) {
      setMessage(err?.message || 'Could not update urgent flag');
    }
  };

  const openResult = (row: ReceptionVisitRow) => {
    setRowMenu(null);
    navigate(`/results?visit=${row.id}`);
  };

  const invalidateVisit = async (row: ReceptionVisitRow) => {
    setRowMenu(null);
    if (!window.confirm(`Invalidate visit ${row.visit_no}? It will be marked cancelled.`)) return;
    try {
      await apiQuickUpdateVisit({ visit_id: row.id, action: 'cancel' });
      setMessage(`Visit ${row.visit_no} invalidated`);
      await refreshAfterVisitChange();
    } catch (err: any) {
      setMessage(err?.message || 'Could not invalidate visit');
    }
  };

  const editAccession = async (order: Order) => {
    const value = window.prompt('Enter accession number', order.accession_number);
    const next = value?.trim();
    if (!next || next === order.accession_number) return;
    try {
      await apiUpdateAccession(order.id, next);
      setMessage(`Accession updated to ${next.toUpperCase()}`);
      setVisitSaveError(null);
      if (selectedPatient) setHistory(await apiPatientHistory(selectedPatient.id));
      setCompleted((current) => current ? {
        ...current,
        orders: current.orders.map((item) => item.id === order.id ? { ...item, accession_number: next.toUpperCase() } : item),
      } : current);
    } catch (err: any) {
      const text = err?.message || 'Could not update accession';
      setMessage(text);
      setVisitSaveError(text);
    }
  };

  const actionTitles: Record<string, string> = {
    payment: 'Collect payment', refund: 'Record refund', others: 'Extra charge (Others)', discount: 'Discount', center: 'Change center', comment: 'Add / edit comment',
  };

  const displayedRows = indicatorFilter ? visitRows.filter((row) => rowFlags(row)[indicatorFilter]) : visitRows;
  const footerTotals: VisitTotals = indicatorFilter
    ? displayedRows.reduce((acc, r) => ({
        records: Number(acc.records) + 1,
        total: Number(acc.total) + Number(r.total_amount || 0),
        others: Number(acc.others) + Number(r.misc_charge || 0),
        discount: Number(acc.discount) + Number(r.discount || 0),
        net: Number(acc.net) + Number(r.net_amount || 0),
        paid: Number(acc.paid) + Number(r.paid_amount || 0),
        balance: Number(acc.balance) + Number(r.balance || 0),
        refund: Number(acc.refund) + Number(r.refund_total || 0),
      }), { ...EMPTY_TOTALS })
    : visitTotals;

  return (
    <div className="content-narrow">
      {(error || billingError) && <div className="banner banner-warning">{error || billingError}</div>}
      {message && <div className="banner banner-success mt-3">{message}</div>}

      {actionModal && (
        <div className="modal-backdrop" onClick={() => setActionModal(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 420 }}>
            <ModalCloseButton onClick={() => setActionModal(null)} />
            <SectionHeader icon={Receipt} title={actionTitles[actionModal.kind]} sub={`${actionModal.row.visit_no} · ${actionModal.row.full_name}`} />
            {actionModal.kind === 'center' ? (
              <SelectInput label="Center" value={actionValue} onChange={(event) => setActionValue(event.target.value)}>
                <option value="">Main Lab</option>
                {centers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </SelectInput>
            ) : actionModal.kind === 'comment' ? (
              <TextareaInput label="Comment" rows={3} value={actionValue} onChange={(event) => setActionValue(event.target.value)} autoFocus />
            ) : (
              <TextInput
                label={actionModal.kind === 'others' ? 'Extra charge amount' : actionModal.kind === 'discount' ? 'Discount amount' : 'Amount'}
                type="number"
                value={actionValue}
                onChange={(event) => setActionValue(event.target.value)}
                autoFocus
              />
            )}
            {(actionModal.kind === 'payment' || actionModal.kind === 'refund') && (
              <SelectInput label="Mode" value={actionMode} onChange={(event) => setActionMode(event.target.value)} className="mt-3">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </SelectInput>
            )}
            <div className="field-hint mt-3">Current balance: Rs {actionModal.row.balance}</div>
            <div className="actions mt-4">
              <Button variant="primary" onClick={submitAction}>Save</Button>
            </div>
          </div>
        </div>
      )}

      <div className="workflow-steps mt-4">
        <Step active={!selectedPatient} done={!!selectedPatient} label="Patient" />
        <Step active={!!selectedPatient && !completed} done={!!completed} label="Visit & payment" />
        <Step active={!!completed} done={!!completed} label="Receipt" />
      </div>

      {visitModalOpen && completed && (
        <div className="modal-backdrop" onClick={() => setVisitModalOpen(false)}>
        <div className="modal-panel modal-panel-wide" onClick={(event) => event.stopPropagation()} style={{ borderColor: 'var(--success)' }}>
          <ModalCloseButton onClick={() => setVisitModalOpen(false)} />
          <SectionHeader icon={CheckCircle2} title={`Visit ${completed.visitNo} completed`} sub="Print documents are ready">
            <StatusChip status={Number(completed.balance) <= 0 ? 'paid' : 'pending'} label={Number(completed.balance) <= 0 ? 'Paid' : `Balance Rs ${completed.balance}`} />
          </SectionHeader>
          <div className="grid-2">
            <div className="card card-surface card-pad">
              <div className="field-label">Saved tests</div>
              {completed.orders.map((order) => (
                <div key={order.id} className="card card-pad mt-3">
                  <div className="between">
                    <div>
                      <div className="strong">{order.service_name || 'Study'}</div>
                      {/* Accession/console details intentionally hidden from reception completion UI. */}
                    </div>
                    <ModalityTag modality={order.modality} />
                  </div>
                  {/* SendDetailsActions removed from visible flow per reception requirement. */}
                </div>
              ))}
            </div>
            <div className="card card-surface card-pad">
              <div className="field-label">Generated print documents</div>
              {completed.printLinks.length > 0 ? (
                <div className="actions mt-3">
                  {completed.printLinks.map((link) => (
                    <a key={link.label} className="btn btn-secondary" href={link.url} target="_blank" rel="noreferrer">
                      <Printer size={16} /> Print {link.label}
                    </a>
                  ))}
                </div>
              ) : <div className="field-hint mt-3">No print options were selected.</div>}
              {!completed.receipt && <div className="field-hint mt-3">Receipt could not be generated.</div>}
            </div>
          </div>
          <div className="actions mt-4">
            <Button variant="primary" icon={UserPlus} onClick={() => { setSelectedPatient(null); setHistory(null); setCompleted(null); setVisitModalOpen(false); }}>
              Next patient
            </Button>
            <Button variant="secondary" icon={ClipboardList} onClick={() => { setCompleted(null); resetVisitForm(); }}>
              Add another visit for this patient
            </Button>
          </div>
        </div>
        </div>
      )}

      {selectedPatient && visitModalOpen && !completed && (
        <div className="modal-backdrop" onClick={() => setVisitModalOpen(false)}>
        <div className="modal-panel modal-panel-wide" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={() => setVisitModalOpen(false)} />
        {(visitSaveError || error || billingError) && <div className="banner banner-warning">{visitSaveError || error || billingError}</div>}
        <VisitPanel
          patient={selectedPatient}
          services={services}
          selectedServiceIds={serviceIds}
          toggleService={toggleService}
          referringDoctors={referringDoctors}
          centers={centers}
          pros={pros}
          staffList={staffList}
          areaList={areaList}
          refDocId={refDocId}
          setRefDocId={setRefDocId}
          regDate={regDate}
          setRegDate={setRegDate}
          centerName={centerName}
          setCenterName={setCenterName}
          doctorName={doctorName}
          setDoctorName={setDoctorName}
          consultantDoctor={consultantDoctor}
          setConsultantDoctor={setConsultantDoctor}
          sampleDate={sampleDate}
          setSampleDate={setSampleDate}
          sampleTime={sampleTime}
          setSampleTime={setSampleTime}
          refNo={refNo}
          setRefNo={setRefNo}
          urgentReport={urgentReport}
          setUrgentReport={setUrgentReport}
          visitComment={visitComment}
          setVisitComment={setVisitComment}
          phlebotomyStaff={phlebotomyStaff}
          setPhlebotomyStaff={setPhlebotomyStaff}
          homeVisitArea={homeVisitArea}
          setHomeVisitArea={setHomeVisitArea}
          homeVisitAmount={homeVisitAmount}
          setHomeVisitAmount={setHomeVisitAmount}
          homeVisitTime={homeVisitTime}
          setHomeVisitTime={setHomeVisitTime}
          dispatchMode={dispatchMode}
          setDispatchMode={setDispatchMode}
          dispatchNote={dispatchNote}
          setDispatchNote={setDispatchNote}
          deliveryDestination={deliveryDestination}
          setDeliveryDestination={setDeliveryDestination}
          proName={proName}
          setProName={setProName}
          commissionAmount={commissionAmount}
          setCommissionAmount={setCommissionAmount}
          regularPatient={regularPatient}
          setRegularPatient={setRegularPatient}
          miscCharge={miscCharge}
          setMiscCharge={setMiscCharge}
          printBarcode={printBarcode}
          setPrintBarcode={setPrintBarcode}
          printSrs={printSrs}
          setPrintSrs={setPrintSrs}
          printReceipt={printReceipt}
          setPrintReceipt={setPrintReceipt}
          printBillReceipt={printBillReceipt}
          setPrintBillReceipt={setPrintBillReceipt}
          sendToPrinter={sendToPrinter}
          setSendToPrinter={setSendToPrinter}
          discount={discount}
          setDiscount={setDiscount}
          selectedTotal={selectedTotal}
          netTotal={netTotal}
          balanceDue={balanceDue}
          payAmount={payAmount}
          setPayAmount={setPayAmount}
          payMode={payMode}
          setPayMode={setPayMode}
          paymentRef={paymentRef}
          setPaymentRef={setPaymentRef}
          payerName={payerName}
          setPayerName={setPayerName}
          payerRelation={payerRelation}
          setPayerRelation={setPayerRelation}
          payerMobile={payerMobile}
          setPayerMobile={setPayerMobile}
          loading={loading}
          saving={actionKey === 'complete-visit'}
          completeVisit={completeVisit}
          changePatient={() => { setVisitModalOpen(false); resetVisitForm(); }}
        />
        </div>
        </div>
      )}

      {!selectedPatient && (
      <div className="card card-pad mt-5">
        <SectionHeader icon={Search} title="Registrations" sub="Filter registrations, open a record, or create a new patient">
          <Button variant="secondary" icon={RefreshCw} disabled={!!actionKey} onClick={syncReturnedReports}>
            Sync returned reports
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={() => setPatientModalOpen(true)}>
            New patient
          </Button>
        </SectionHeader>
        <div className="grid-5">
          <TextInput label="From" type="date" value={visitFilters.from} onChange={(event) => updateVisitFilter('from', event.target.value)} />
          <TextInput label="To" type="date" value={visitFilters.to} onChange={(event) => updateVisitFilter('to', event.target.value)} />
          <TextInput label="Center" list="center-options-main" value={visitFilters.center} onChange={(event) => updateVisitFilter('center', event.target.value)} />
          <datalist id="center-options-main">
            <option value="Main Lab" />
            <option value="NA" />
            <option value="Center" />
            <option value="Home visit" />
          </datalist>
          <SelectInput label="Doctor" value={visitFilters.doctor} onChange={(event) => updateVisitFilter('doctor', event.target.value)}>
            <option value="">All</option>
            {referringDoctors.map((doctor) => <option key={doctor.id} value={doctor.name}>{doctor.name}</option>)}
          </SelectInput>
          <SelectInput label="Status" value={visitFilters.status} onChange={(event) => updateVisitFilter('status', event.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="partly_paid">Partly paid</option>
            <option value="paid">Paid</option>
            <option value="collected">Collected</option>
          </SelectInput>
          <TextInput label="Patient" value={visitFilters.patient} onChange={(event) => updateVisitFilter('patient', event.target.value)} />
          <SelectInput label="Consultant" value={visitFilters.consultant} onChange={(event) => updateVisitFilter('consultant', event.target.value)}>
            <option value="">All</option>
            {referringDoctors.map((doctor) => <option key={doctor.id} value={doctor.name}>{doctor.name}</option>)}
          </SelectInput>
          <TextInput label="Department" value={visitFilters.dept} onChange={(event) => updateVisitFilter('dept', event.target.value)} />
          <TextInput label="Group" value={visitFilters.group} onChange={(event) => updateVisitFilter('group', event.target.value)} />
          <TextInput label="Test" value={visitFilters.test} onChange={(event) => updateVisitFilter('test', event.target.value)} />
          <TextInput label="Reference" value={visitFilters.ref_no} onChange={(event) => updateVisitFilter('ref_no', event.target.value)} />
        </div>
        <div className="actions mt-3" style={{ alignItems: 'flex-end' }}>
          <label className="checkrow">
            <input type="checkbox" checked={visitFilters.outstanding} onChange={(event) => updateVisitFilter('outstanding', event.target.checked)} />
            <span>Outstanding only</span>
          </label>
          <Button variant="secondary" icon={Search} onClick={() => loadVisitRows()}>Search</Button>
          <div style={{ position: 'relative' }}>
            <Button variant={indicatorFilter ? 'secondary' : 'ghost'} className="legend-toggle" onClick={() => setShowLegend((v) => !v)}>
              {indicatorFilter ? `Filter: ${INDICATOR_ITEMS.find((i) => i.key === indicatorFilter)?.label.split(' (')[0]}` : 'Legend'}
            </Button>
            {showLegend && <IndicatorLegend active={indicatorFilter} onSelect={(key) => { setIndicatorFilter(key); setShowLegend(false); }} />}
          </div>
        </div>
        <div className="table-wrap mt-3">
          <table className="dt">
            <thead>
              <tr>
                <th />
                <th>Reg No</th>
                <th>Date / Time</th>
                <th>Center</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Total</th>
                <th>Others</th>
                <th>Discount</th>
                <th>Final</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Refund</th>
                <th>Mobile</th>
                <th>Consultant</th>
                <th>User</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => chooseVisitRow(row)}
                  onContextMenu={(event) => openRowMenu(event, row)}
                  style={{
                    cursor: 'pointer',
                    borderLeft: Number(row.urgent_report || 0) === 1 ? '3px solid var(--warning, #d97706)' : '3px solid transparent',
                    opacity: row.status === 'cancelled' ? 0.5 : 1,
                    textDecoration: row.status === 'cancelled' ? 'line-through' : 'none',
                  }}
                >
                  <td><RowIndicators row={row} /></td>
                  <td className="mono">{row.visit_no}</td>
                  <td>{formatRisDateTime(row.visit_datetime)}</td>
                  <td>{row.center_name || '-'}</td>
                  <td className="strong">{row.full_name} <span className="field-hint">[{row.age_years || '-'} {row.sex || '-'}]</span></td>
                  <td>{row.doctor_name || '-'}</td>
                  <td className="num">{row.total_amount}</td>
                  <td className="num">{row.misc_charge || '0.00'}</td>
                  <td className="num">{row.discount}</td>
                  <td className="num">{row.net_amount}</td>
                  <td className="num">{row.paid_amount}</td>
                  <td className="num">{row.balance}</td>
                  <td className="num">{Number(row.refund_total || 0) > 0 ? row.refund_total : '0.00'}</td>
                  <td>{row.phone || '-'}</td>
                  <td>{row.consultant_doctor || '-'}</td>
                  <td>{row.user_name || '-'}</td>
                  <td>
                    <VisitStatusCell row={row} />
                  </td>
                  <td className="num">
                    <div className="actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); chooseVisitRow(row); }}>
                        Open
                      </Button>
                      <Button size="sm" variant="ghost" title="Actions" aria-label="Actions" onClick={(event) => openRowMenu(event, row)}>
                        <MoreVertical size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayedRows.length === 0 && <tr><td colSpan={18}><EmptyState title="No registrations" sub={indicatorFilter ? 'No visits match this status filter.' : 'Adjust filters or add a new patient and visit.'} /></td></tr>}
            </tbody>
            {displayedRows.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--app-border)' }}>
                  <td colSpan={6} className="num">Totals ({footerTotals.records} records{indicatorFilter ? ', filtered' : ''})</td>
                  <td className="num">{Number(footerTotals.total).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.others).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.discount).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.net).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.paid).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.balance).toFixed(2)}</td>
                  <td className="num">{Number(footerTotals.refund).toFixed(2)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!indicatorFilter && Number(visitTotals.records) > PAGE_SIZE && (
          <div className="between mt-3">
            <span className="field-hint">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, Number(visitTotals.records))} of {visitTotals.records}
            </span>
            <div className="actions">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => gotoPage(page - 1)}>Previous</Button>
              <span className="field-hint" style={{ alignSelf: 'center' }}>Page {page} of {Math.max(1, Math.ceil(Number(visitTotals.records) / PAGE_SIZE))}</span>
              <Button size="sm" variant="secondary" disabled={page >= Math.ceil(Number(visitTotals.records) / PAGE_SIZE)} onClick={() => gotoPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
        {rowMenu && (
          <div className="context-menu" style={{ left: rowMenu.x, top: rowMenu.y }} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => openResult(rowMenu.row)}>Result entry</button>
            <button type="button" onClick={() => openAction('payment', rowMenu.row)}>Payment</button>
            <button type="button" onClick={() => { window.open(printAssetUrl(rowMenu.row.id, 'barcode'), '_blank', 'noopener,noreferrer'); setRowMenu(null); }}>Print Barcode</button>
            <button type="button" onClick={() => openAction('comment', rowMenu.row)}>Add / edit comment</button>
            <div style={{ borderTop: '1px solid var(--app-border)', margin: '4px 0' }} />
            <button type="button" onClick={() => toggleUrgent(rowMenu.row)}>{Number(rowMenu.row.urgent_report || 0) === 1 ? 'Remove urgent' : 'Mark urgent report'}</button>
            <button type="button" onClick={() => markStatus(rowMenu.row, 'emailed', 'Marked report emailed')}>Mark report emailed</button>
            <button type="button" onClick={() => markStatus(rowMenu.row, 'printed', 'Marked report printed')}>Mark report printed</button>
            <button type="button" onClick={() => invalidateVisit(rowMenu.row)}>Invalidate</button>
          </div>
        )}
      </div>
      )}

      {selectedPatient && !visitModalOpen && (
        <div className="patient-profile mt-5">
          <div className="patient-profile-head">
            <div>
              <div className="patient-name">{selectedPatient.full_name}</div>
              <div className="patient-sub">{selectedPatient.mrn} | Patient ID {selectedPatient.id}</div>
            </div>
            <div className="actions">
            <Button variant="secondary" onClick={() => setPatientEditing((current) => !current)}>
              {patientEditing ? 'Cancel edit' : 'Edit patient'}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => { setCompleted(null); resetVisitForm(); setVisitModalOpen(true); }}>
              New visit
            </Button>
              <IconButton bordered icon={X} title="Close patient" aria-label="Close patient" onClick={() => { setSelectedPatient(null); setHistory(null); resetVisitForm(); }} />
            </div>
          </div>
          <PatientBalanceSummary visits={history?.visits || []} />
          <div className="patient-facts">
            <PatientFact label="Mobile" value={selectedPatient.phone || '-'} />
            <PatientFact label="Type" value={selectedPatient.patient_group || '-'} />
            <PatientFact label="Age / Gender" value={`${selectedPatient.age_years || '-'} / ${selectedPatient.sex || '-'}`} />
            <PatientFact label="Address" value={[selectedPatient.address_line1 || selectedPatient.address, selectedPatient.city, selectedPatient.state].filter(Boolean).join(', ') || '-'} wide />
          </div>
          {patientEditing && (
            <div className="patient-edit-panel mt-3">
              <div className="grid-2">
                <TextInput label="Patient ID" value={String(selectedPatient.id)} disabled />
                <TextInput label="Mobile" value={String(patientEditForm.phone || '')} onChange={(event) => updatePatientEditField('phone', event.target.value)} />
                <SelectInput label="Title" value={String(patientEditForm.name_prefix || '')} onChange={(event) => updatePatientEditField('name_prefix', event.target.value)}>
                  <option value="">-</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Master">Master</option>
                  <option value="Baby">Baby</option>
                </SelectInput>
                <TextInput label="Name" required value={String(patientEditForm.full_name || '')} onChange={(event) => updatePatientEditField('full_name', event.target.value)} />
                <TextInput label="WhatsApp number" value={String(patientEditForm.alt_phone || '')} onChange={(event) => updatePatientEditField('alt_phone', event.target.value)} placeholder="Optional" />
                <SelectInput label="Type" value={String(patientEditForm.patient_group || '')} onChange={(event) => updatePatientEditField('patient_group', event.target.value)}>
                  <option value="">Select type</option>
                  {(groupList.length > 0 ? groupList.map((g) => g.value) : ['Regular', 'Center', 'Home visit', 'Corporate']).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </SelectInput>
                <SelectInput label="Gender" value={String(patientEditForm.sex || '')} onChange={(event) => updatePatientEditField('sex', event.target.value)}>
                  <option value="">-</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </SelectInput>
                <TextInput label="DOB" type="date" value={String(patientEditForm.dob || '')} onChange={(event) => updatePatientEditField('dob', event.target.value)} hint="Age fills in automatically" />
                <TextInput label="Age (years)" type="number" value={String(patientEditForm.age_years ?? '')} onChange={(event) => updatePatientEditField('age_years', event.target.value)} hint="Or enter directly if DOB unknown" />
                <TextInput label="Email" type="email" value={String(patientEditForm.email || '')} onChange={(event) => updatePatientEditField('email', event.target.value)} />
              </div>
              <TextareaInput label="Address" rows={3} className="mt-3" value={String(patientEditForm.address_line1 || '')} onChange={(event) => updatePatientEditField('address_line1', event.target.value)} />
              <div className="actions mt-3">
                <Button variant="primary" disabled={patientSaving} onClick={savePatientDetails}>{patientSaving ? 'Saving...' : 'Save patient'}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {patientModalOpen && (
        <div className="modal-backdrop" onClick={() => setPatientModalOpen(false)}>
          <form className="modal-panel" onSubmit={createPatient} onClick={(event) => event.stopPropagation()}>
            <ModalCloseButton onClick={() => setPatientModalOpen(false)} />
            <SectionHeader icon={UserPlus} title="New patient" sub="Create the patient and continue to visit entry" />
            <div className="grid-2">
              <TextInput label="Patient ID" value="Generated on save" disabled />
              <TextInput label="Mobile" value={patientForm.phone || ''} onChange={(event) => setPatientField('phone', event.target.value)} placeholder="10 digit mobile" />
              <SelectInput label="Title" value={patientForm.name_prefix || ''} onChange={(event) => setPatientField('name_prefix', event.target.value)}>
                <option value="">-</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
                <option value="Master">Master</option>
                <option value="Baby">Baby</option>
              </SelectInput>
              <TextInput label="Name" required value={patientForm.full_name || ''} onChange={(event) => setPatientField('full_name', event.target.value)} />
              <TextInput label="WhatsApp number" value={patientForm.alt_phone || ''} onChange={(event) => setPatientField('alt_phone', event.target.value)} placeholder="Optional" />
              <SelectInput label="Type" value={patientForm.patient_group || ''} onChange={(event) => setPatientField('patient_group', event.target.value)}>
                <option value="">Select type</option>
                {(groupList.length > 0 ? groupList.map((g) => g.value) : ['Regular', 'Center', 'Home visit', 'Corporate']).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </SelectInput>
              <SelectInput label="Gender" value={patientForm.sex || ''} onChange={(event) => setPatientField('sex', event.target.value)}>
                <option value="">-</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </SelectInput>
              <TextInput label="DOB" type="date" value={patientForm.dob || ''} onChange={(event) => setPatientField('dob', event.target.value)} hint="Age fills in automatically" />
              <TextInput label="Age (years)" type="number" value={String(patientForm.age_years ?? '')} onChange={(event) => setPatientField('age_years', event.target.value)} hint="Or enter directly if DOB unknown" />
              <TextInput label="Email" type="email" value={patientForm.email || ''} onChange={(event) => setPatientField('email', event.target.value)} />
            </div>
            <TextareaInput label="Address" rows={3} className="mt-3" value={patientForm.address_line1 || ''} onChange={(event) => setPatientField('address_line1', event.target.value)} />
            <div className="actions mt-4">
              <Button type="submit" disabled={loading || actionKey === 'create-patient'} variant="primary" icon={Plus}>
                {loading || actionKey === 'create-patient' ? 'Saving...' : 'Save patient'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPatientForm({ ...EMPTY_PATIENT })}>
                Clear
              </Button>
            </div>
          </form>
        </div>
      )}

      {selectedPatient && !visitModalOpen && (
        <HistoryPanel
          history={history}
          nodes={nodes}
          centers={centers}
          referringDoctors={referringDoctors}
          staffList={staffList}
          areaList={areaList}
          pros={pros}
          loading={historyLoading}
          onMessage={setMessage}
          onRefresh={refreshSelectedHistory}
          onVisitUpdated={updateHistoryVisit}
        />
      )}
    </div>
  );
}

function buildPrintLinks(
  visitId: number,
  flags: { barcode: boolean; srs: boolean; receipt: boolean; billReceipt: boolean },
  receipt: ReceiptRow | null,
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];
  if (flags.barcode) links.push({ label: 'Barcode', url: printAssetUrl(visitId, 'barcode') });
  if (flags.srs) links.push({ label: 'SRS', url: printAssetUrl(visitId, 'srs') });
  if (flags.receipt && receipt?.print_url) links.push({ label: `Receipt ${receipt.receipt_no}`, url: receipt.print_url });
  if (flags.billReceipt) links.push({ label: 'Bill Receipt', url: printAssetUrl(visitId, 'bill_receipt') });
  return links;
}

function Step({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return <div className={`workflow-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>{label}</div>;
}

function VisitStatusLabel({ row }: { row: ReceptionVisitRow }) {
  const note = `${row.dispatch_mode || ''} ${row.dispatch_note || ''}`.toLowerCase();
  const labels: string[] = [];
  if (Number(row.urgent_report || 0) === 1) labels.push('Urgent report');
  if (note.includes('delivered') || note.includes('report given')) labels.push('Delivered');
  else if (note.includes('report received')) labels.push('Report received');
  else if (note.includes('images print received')) labels.push('Print received');
  return <span className="field-hint">{labels.length ? labels.join(' / ') : 'Pending'}</span>;
}

function VisitStatusCell({ row }: { row: ReceptionVisitRow }) {
  return (
    <div className="status-cell">
      <div className="status-main">
        <strong>{workflowForRow(row).label}</strong>
        <StatusChip status={row.status || 'open'} />
      </div>
      <VisitStatusLabel row={row} />
      <VisitTags visit={row} />
    </div>
  );
}

// Status flags for a row, used by both the icon cluster and the legend filter.
type IndicatorKey = 'urgent' | 'comment' | 'ready' | 'emailed' | 'printed' | 'none';

function rowFlags(row: ReceptionVisitRow): Record<IndicatorKey, boolean> {
  const note = `${row.dispatch_mode || ''} ${row.dispatch_note || ''}`.toLowerCase();
  const urgent = Number(row.urgent_report || 0) === 1;
  const comment = !!(row.visit_comment && String(row.visit_comment).trim() !== '');
  const emailed = !!row.report_emailed_at || note.includes('email');
  const printed = !!row.report_printed_at || note.includes('print') || note.includes('deliver') || note.includes('given') || note.includes('pickup');
  const orderCount = Number(row.order_count || 0);
  const readyCount = Number(row.results_ready_count || 0);
  const ready = orderCount > 0 && readyCount >= orderCount;
  const none = !urgent && !comment && !emailed && !printed && !ready;
  return { urgent, comment, ready, emailed, printed, none };
}

const INDICATOR_ITEMS: Array<{ key: IndicatorKey; label: string; render: () => JSX.Element }> = [
  { key: 'urgent', label: 'Urgent report (sorted to top)', render: () => <Flag size={14} style={{ color: 'var(--warning, #d97706)' }} /> },
  { key: 'comment', label: 'Has comment', render: () => <MessageSquare size={14} style={{ color: 'var(--danger, #dc2626)' }} /> },
  { key: 'ready', label: 'Report ready', render: () => <CheckCircle2 size={14} style={{ color: 'var(--success, #16a34a)' }} /> },
  { key: 'emailed', label: 'Report emailed', render: () => <Mail size={14} style={{ color: '#ca8a04' }} /> },
  { key: 'printed', label: 'Report printed', render: () => <Printer size={14} /> },
  { key: 'none', label: 'Report not ready', render: () => <span className="field-hint">—</span> },
];

// Subtle status icons per row (replaces full-row colour coding).
function RowIndicators({ row }: { row: ReceptionVisitRow }) {
  const f = rowFlags(row);
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 72 }}>
      {f.urgent && <span title="Urgent report" style={{ color: 'var(--warning, #d97706)' }}><Flag size={14} /></span>}
      {f.comment && <span title="Has comment" style={{ color: 'var(--danger, #dc2626)' }}><MessageSquare size={14} /></span>}
      {f.ready && <span title="Report ready" style={{ color: 'var(--success, #16a34a)' }}><CheckCircle2 size={14} /></span>}
      {f.emailed && <span title="Report emailed" style={{ color: '#ca8a04' }}><Mail size={14} /></span>}
      {f.printed && <span title="Report printed" style={{ color: 'var(--app-text-muted)' }}><Printer size={14} /></span>}
      {f.none && <span title="Report not ready" className="field-hint">—</span>}
    </div>
  );
}

function IndicatorLegend({ active, onSelect }: { active: IndicatorKey | null; onSelect: (key: IndicatorKey | null) => void }) {
  return (
    <div className="card card-surface card-pad legend-pop" style={{ position: 'absolute', zIndex: 60, right: 0, marginTop: 4, minWidth: 240 }} onClick={(e) => e.stopPropagation()}>
      <div className="between">
        <div className="field-label">Filter by status</div>
        {active && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(null)}>Clear</button>}
      </div>
      <div className="stack-tight mt-3" style={{ display: 'grid', gap: 4 }}>
        {INDICATOR_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`legend-item ${active === item.key ? 'active' : ''}`}
            onClick={() => onSelect(active === item.key ? null : item.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6,
              border: '1px solid var(--app-border)', background: active === item.key ? 'var(--app-hover)' : 'transparent',
              cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--app-text)',
            }}
          >
            {item.render()} <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function workflowForRow(row: ReceptionVisitRow) {
  return workflowFromParts({
    urgent: row.urgent_report,
    dispatchMode: row.dispatch_mode,
    dispatchNote: row.dispatch_note,
    balance: row.balance,
  });
}

function workflowForVisit(visit: PatientHistoryVisit) {
  const hasSoftCopy = visit.orders.some((order) => Boolean(order.linked_study_uid));
  const hasConsoleOrder = visit.orders.length > 0;
  return workflowFromParts({
    urgent: visit.urgent_report,
    dispatchMode: visit.dispatch_mode,
    dispatchNote: visit.dispatch_note,
    balance: visit.balance,
    hasSoftCopy,
    hasConsoleOrder,
  });
}

function workflowFromParts({
  urgent,
  dispatchMode,
  dispatchNote,
  balance,
  hasSoftCopy,
  hasConsoleOrder,
}: {
  urgent?: number | string | null;
  dispatchMode?: string | null;
  dispatchNote?: string | null;
  balance?: string | number | null;
  hasSoftCopy?: boolean;
  hasConsoleOrder?: boolean;
}) {
  const mode = String(dispatchMode || '').toLowerCase();
  const note = String(dispatchNote || '').toLowerCase();
  const due = Number(balance || 0);
  const urgentPrefix = Number(urgent || 0) === 1 ? 'Urgent - ' : '';
  if (mode === 'patient_pickup' || note.includes('delivered') || note.includes('report given')) {
    return { label: `${urgentPrefix}Delivered`, step: 5 };
  }
  if (['email', 'center', 'home', 'courier'].includes(mode)) {
    return { label: `${urgentPrefix}Delivery selected`, step: 4 };
  }
  if (mode === 'report_received' || note.includes('report received')) {
    return { label: `${urgentPrefix}Report received`, step: 3 };
  }
  if (mode === 'images_print_received' || note.includes('images print received')) {
    return { label: `${urgentPrefix}Images print received`, step: 3 };
  }
  if (hasSoftCopy) return { label: `${urgentPrefix}Soft copy received`, step: 2 };
  if (hasConsoleOrder) return { label: `${urgentPrefix}Registered`, step: 1 };
  if (due > 0) return { label: `${urgentPrefix}Payment pending`, step: 1 };
  return { label: `${urgentPrefix}Registered`, step: 0 };
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
  centers: Center[];
  pros: Pro[];
  staffList: Lookup[];
  areaList: Lookup[];
  refDocId: string;
  setRefDocId: (value: string) => void;
  regDate: string;
  setRegDate: (value: string) => void;
  centerName: string;
  setCenterName: (value: string) => void;
  doctorName: string;
  setDoctorName: (value: string) => void;
  consultantDoctor: string;
  setConsultantDoctor: (value: string) => void;
  sampleDate: string;
  setSampleDate: (value: string) => void;
  sampleTime: string;
  setSampleTime: (value: string) => void;
  refNo: string;
  setRefNo: (value: string) => void;
  urgentReport: boolean;
  setUrgentReport: (value: boolean) => void;
  visitComment: string;
  setVisitComment: (value: string) => void;
  phlebotomyStaff: string;
  setPhlebotomyStaff: (value: string) => void;
  homeVisitArea: string;
  setHomeVisitArea: (value: string) => void;
  homeVisitAmount: string;
  setHomeVisitAmount: (value: string) => void;
  homeVisitTime: string;
  setHomeVisitTime: (value: string) => void;
  dispatchMode: string;
  setDispatchMode: (value: string) => void;
  dispatchNote: string;
  setDispatchNote: (value: string) => void;
  deliveryDestination: string;
  setDeliveryDestination: (value: string) => void;
  proName: string;
  setProName: (value: string) => void;
  commissionAmount: string;
  setCommissionAmount: (value: string) => void;
  regularPatient: boolean;
  setRegularPatient: (value: boolean) => void;
  miscCharge: string;
  setMiscCharge: (value: string) => void;
  printBarcode: boolean;
  setPrintBarcode: (value: boolean) => void;
  printSrs: boolean;
  setPrintSrs: (value: boolean) => void;
  printReceipt: boolean;
  setPrintReceipt: (value: boolean) => void;
  printBillReceipt: boolean;
  setPrintBillReceipt: (value: boolean) => void;
  sendToPrinter: boolean;
  setSendToPrinter: (value: boolean) => void;
  discount: string;
  setDiscount: (value: string) => void;
  selectedTotal: number;
  netTotal: number;
  balanceDue: number;
  payAmount: string;
  setPayAmount: (value: string) => void;
  payMode: string;
  setPayMode: (value: string) => void;
  paymentRef: string;
  setPaymentRef: (value: string) => void;
  payerName: string;
  setPayerName: (value: string) => void;
  payerRelation: string;
  setPayerRelation: (value: string) => void;
  payerMobile: string;
  setPayerMobile: (value: string) => void;
  loading: boolean;
  saving: boolean;
  completeVisit: () => void;
  changePatient: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'home' | 'dispatch' | 'other'>('general');
  const [serviceSearch, setServiceSearch] = useState('');
  const dispatchEntries = props.dispatchNote
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const serviceQuery = serviceSearch.trim().toLowerCase();
  const filteredServices = serviceQuery
    ? props.services.filter((s) => `${s.name} ${s.code} ${s.department || ''} ${s.lab_name || ''}`.toLowerCase().includes(serviceQuery))
    : props.services;
  const chosenServices = props.services.filter((s) => props.selectedServiceIds.includes(s.id));

  // Doctor vs consultant split (a "both" doctor shows in both lists).
  const gpDoctors = props.referringDoctors.filter((d) => !d.doctor_type || d.doctor_type === 'gp' || d.doctor_type === 'both');
  const consultants = props.referringDoctors.filter((d) => d.doctor_type === 'consultant' || d.doctor_type === 'both');
  const selectedCenter = props.centers.find((c) => c.name === props.centerName) || null;

  // When the Home Visit tab opens, prefill the area from the patient's saved address once.
  useEffect(() => {
    if (activeTab === 'home' && !props.homeVisitArea) {
      const fromPatient = props.patient.city || props.patient.address_line1 || '';
      if (fromPatient) props.setHomeVisitArea(fromPatient);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="card card-pad mt-4" style={{ borderColor: 'var(--app-accent)' }}>
      <SectionHeader icon={ClipboardList} title={`Visit for ${props.patient.full_name}`} sub={`${props.patient.mrn} | ${props.patient.phone || 'No phone'}`}>
        <Button size="sm" variant="ghost" onClick={props.changePatient}>Change patient</Button>
      </SectionHeader>
      <div>
        <div>
          <div className="grid-2">
            <TextInput label="Visit ID" value="Generated on save" disabled />
            <TextInput label="Date" type="date" value={props.regDate} onChange={(event) => props.setRegDate(event.target.value)} />
            {props.centers.length > 0 ? (
              <div>
                <SelectInput label="Center" value={props.centerName} onChange={(event) => props.setCenterName(event.target.value)}>
                  <option value="Main Lab">Main Lab</option>
                  {props.centers.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}
                </SelectInput>
                {selectedCenter && (
                  <div className="mt-3">
                    <StatusChip status={selectedCenter.billing_type === 'credit' ? 'pending' : 'online'} label={selectedCenter.billing_type === 'credit' ? 'Credit center (monthly invoice)' : 'Debit center (pays per visit)'} />
                  </div>
                )}
              </div>
            ) : (
              <TextInput label="Center" list="center-options" value={props.centerName} onChange={(event) => props.setCenterName(event.target.value)} />
            )}
            <datalist id="center-options">
              <option value="Main Lab" />
              <option value="Center" />
              <option value="Home visit" />
              <option value="NA" />
            </datalist>
            <SelectInput
              label="Doctor (GP)"
              value={props.refDocId}
              onChange={(event) => {
                const id = event.target.value;
                props.setRefDocId(id);
                const match = props.referringDoctors.find((doctor) => String(doctor.id) === id);
                props.setDoctorName(match?.name || '');
              }}
            >
              <option value="">Select doctor</option>
              {gpDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </SelectInput>
            <SelectInput label="Consultant" value={props.consultantDoctor} onChange={(event) => props.setConsultantDoctor(event.target.value)}>
              <option value="">Select consultant</option>
              {consultants.map((doctor) => <option key={doctor.id} value={doctor.name}>{doctor.name}</option>)}
            </SelectInput>
          </div>

          <div className="card card-surface card-pad mt-4">
            <div className="visit-tabs">
              <button type="button" className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
              <button type="button" className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>Home Visit</button>
              <button type="button" className={activeTab === 'dispatch' ? 'active' : ''} onClick={() => setActiveTab('dispatch')}>Dispatch</button>
              <button type="button" className={activeTab === 'other' ? 'active' : ''} onClick={() => setActiveTab('other')}>Other</button>
            </div>
            {activeTab === 'general' && (
              <>
                <div className="grid-2 mt-3">
                  <TextInput label="Sample date" type="date" value={props.sampleDate} onChange={(event) => props.setSampleDate(event.target.value)} />
                  <TextInput label="Time" type="time" value={props.sampleTime} onChange={(event) => props.setSampleTime(event.target.value)} />
                  <TextInput label="Reference" value={props.refNo} onChange={(event) => props.setRefNo(event.target.value)} />
                  <label className="checkrow" style={{ alignSelf: 'end' }}>
                    <input type="checkbox" checked={props.urgentReport} onChange={(event) => props.setUrgentReport(event.target.checked)} />
                    <span>Urgent report</span>
                  </label>
                </div>
                <TextareaInput label="Comment" rows={3} className="mt-3" value={props.visitComment} onChange={(event) => props.setVisitComment(event.target.value)} />
              </>
            )}
            {activeTab === 'home' && (
              <div className="grid-2 mt-3">
                <TextInput label="Staff" list="staff-options" value={props.phlebotomyStaff} onChange={(event) => props.setPhlebotomyStaff(event.target.value)} placeholder="Select staff" />
                <datalist id="staff-options">
                  {props.staffList.map((s) => <option key={s.id} value={s.value} />)}
                </datalist>
                <TextInput label="Area" list="area-options" value={props.homeVisitArea} onChange={(event) => props.setHomeVisitArea(event.target.value)} placeholder="Select area" hint="Prefilled from patient address" />
                <datalist id="area-options">
                  {props.areaList.map((a) => <option key={a.id} value={a.value} />)}
                </datalist>
                <TextInput label="Amount" value={props.homeVisitAmount} onChange={(event) => props.setHomeVisitAmount(event.target.value)} />
                <TextInput label="Time" type="time" value={props.homeVisitTime} onChange={(event) => props.setHomeVisitTime(event.target.value)} />
              </div>
            )}
            {activeTab === 'dispatch' && (
              <>
                <div className="actions mt-3">
                  <SelectInput label="Dispatch mode" value={props.dispatchMode} onChange={(event) => props.setDispatchMode(event.target.value)} style={{ minWidth: 260 }}>
                    <option value="">All</option>
                    <option value="center">Center delivery</option>
                    <option value="home">Home delivery</option>
                    <option value="email">Email</option>
                    <option value="printed">Printed</option>
                    <option value="courier">Courier</option>
                    <option value="pickup">Patient pickup</option>
                  </SelectInput>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => {
                      const label = props.dispatchMode || 'All';
                      props.setDispatchNote([...dispatchEntries, label].join('\n'));
                    }}
                  >
                    Add
                  </Button>
                </div>
                <TextareaInput label="Dispatch list" rows={4} className="mt-3" value={props.dispatchNote} onChange={(event) => props.setDispatchNote(event.target.value)} />
              </>
            )}
            {activeTab === 'other' && (
              <div className="grid-2 mt-3">
                {props.pros.length > 0 ? (
                  <SelectInput label="PRO" value={props.proName} onChange={(event) => {
                    const name = event.target.value;
                    props.setProName(name);
                    const pro = props.pros.find((p) => p.name === name);
                    if (pro && pro.commission_type === 'flat') {
                      props.setCommissionAmount(String(pro.commission_value));
                    } else if (pro && pro.commission_type === 'percent') {
                      const pct = Number(pro.commission_value) || 0;
                      props.setCommissionAmount((props.netTotal * pct / 100).toFixed(2));
                    }
                  }}>
                    <option value="">Select PRO</option>
                    {props.pros.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </SelectInput>
                ) : (
                  <TextInput label="PRO" value={props.proName} onChange={(event) => props.setProName(event.target.value)} placeholder="Select PRO" />
                )}
                <TextInput label="Commission" value={props.commissionAmount} onChange={(event) => props.setCommissionAmount(event.target.value)} />
                <SelectInput label="Delivery to" value={props.deliveryDestination} onChange={(event) => props.setDeliveryDestination(event.target.value)}>
                  <option value="patient">Patient</option>
                  <option value="center">Center</option>
                  <option value="home">Home</option>
                  <option value="other">Other</option>
                </SelectInput>
                <label className="checkrow" style={{ alignSelf: 'end' }}>
                  <input type="checkbox" checked={props.regularPatient} onChange={(event) => props.setRegularPatient(event.target.checked)} />
                  <span>Regular patient</span>
                </label>
              </div>
            )}
          </div>

          <div className="between mt-4">
            <div className="field-label">Services</div>
            <div className="field-hint">Test(s): {chosenServices.length}</div>
          </div>
          <TextInput placeholder="Search tests by name, code, department or lab..." value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} className="mt-3" />
          <div className="grid-auto mt-3" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filteredServices.map((service) => (
              <label key={service.id} className={`checkrow ${props.selectedServiceIds.includes(service.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={props.selectedServiceIds.includes(service.id)} onChange={() => props.toggleService(service.id)} />
                <span className="strong" style={{ flex: 1 }}>{service.name}</span>
                <ModalityTag modality={service.modality} />
                <span className="mono">Rs {service.price}</span>
              </label>
            ))}
            {filteredServices.length === 0 && <div className="field-hint">No tests match "{serviceSearch}".</div>}
          </div>

          {chosenServices.length > 0 && (
            <div className="table-wrap mt-3">
              <table className="dt">
                <thead><tr><th>Selected test</th><th className="num">Rate</th><th>Lab</th><th /></tr></thead>
                <tbody>
                  {chosenServices.map((service) => (
                    <tr key={service.id}>
                      <td className="strong">{service.name}</td>
                      <td className="num mono">Rs {service.price}</td>
                      <td>{service.lab_name || '-'}</td>
                      <td className="num"><Button size="sm" variant="ghost" onClick={() => props.toggleService(service.id)}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card card-surface card-pad mt-4">
          <div className="field-label">Costing and payment</div>
          <div className="grid-3 mt-3">
            <TextInput label="Total" value={props.selectedTotal.toFixed(2)} disabled />
            <TextInput label="Home visit" value={props.homeVisitAmount} onChange={(event) => props.setHomeVisitAmount(event.target.value)} />
            <TextInput label="Extra charge" value={props.miscCharge} onChange={(event) => props.setMiscCharge(event.target.value)} />
            <TextInput label="Discount" value={props.discount} onChange={(event) => props.setDiscount(event.target.value)} />
            <TextInput label="Final amount" value={props.netTotal.toFixed(2)} disabled />
            <TextInput label="Advance" value={props.payAmount} onChange={(event) => props.setPayAmount(event.target.value)} />
            <TextInput label="Balance" value={props.balanceDue.toFixed(2)} disabled />
            <SelectInput label="Payment mode" value={props.payMode} onChange={(event) => props.setPayMode(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="Payment reference" value={props.paymentRef} onChange={(event) => props.setPaymentRef(event.target.value)} />
          </div>
          <div className="grid-3 mt-3">
            <TextInput label="Paid by" value={props.payerName} onChange={(event) => props.setPayerName(event.target.value)} placeholder="Patient, mother, relative..." />
            <TextInput label="Relation" value={props.payerRelation} onChange={(event) => props.setPayerRelation(event.target.value)} />
            <TextInput label="Payer mobile" value={props.payerMobile} onChange={(event) => props.setPayerMobile(event.target.value)} />
          </div>
          <div className="cost-summary mt-3">
            <div className="cost-row"><span>Tests total</span><strong>Rs {props.selectedTotal.toFixed(2)}</strong></div>
            <div className="cost-row"><span>Home visit</span><strong>Rs {Number(props.homeVisitAmount || 0).toFixed(2)}</strong></div>
            <div className="cost-row"><span>Extra charge</span><strong>Rs {Number(props.miscCharge || 0).toFixed(2)}</strong></div>
            <div className="cost-row"><span>Discount</span><strong>- Rs {Number(props.discount || 0).toFixed(2)}</strong></div>
            <div className="cost-row total"><span>Net</span><strong>Rs {props.netTotal.toFixed(2)}</strong></div>
            <div className="cost-row"><span>Advance / paid now</span><strong>Rs {Number(props.payAmount || 0).toFixed(2)}</strong></div>
            <div className={`cost-row ${props.balanceDue > 0 ? 'balance-due' : ''}`}><span>Balance</span><strong>Rs {props.balanceDue.toFixed(2)}</strong></div>
          </div>
          <Button className="mt-3" variant="primary" icon={Receipt} disabled={props.loading || props.saving || props.selectedServiceIds.length === 0} onClick={props.completeVisit}>
            {props.saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  nodes,
  centers,
  referringDoctors,
  staffList,
  areaList,
  pros,
  loading,
  onMessage,
  onRefresh,
  onVisitUpdated,
}: {
  history: PatientHistory | null;
  nodes: DicomNode[];
  centers: Center[];
  referringDoctors: any[];
  staffList: Lookup[];
  areaList: Lookup[];
  pros: Pro[];
  loading: boolean;
  onMessage: (message: string | null) => void;
  onRefresh: () => Promise<void>;
  onVisitUpdated: (visitId: number, patch: Partial<PatientHistoryVisit>) => void;
}) {
  const visits = useMemo(() => history?.visits || [], [history]);
  const [openVisitId, setOpenVisitId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingActionRef = useRef<string | null>(null);
  const [printVisit, setPrintVisit] = useState<PatientHistoryVisit | null>(null);
  const [paymentEditor, setPaymentEditor] = useState<{ visitId: number; isRefund: boolean } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    mode: 'cash',
    payer_name: '',
    payer_relation: '',
    payer_mobile: '',
    reference: '',
  });
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
  const markVisitDelivery = async (visit: PatientHistoryVisit, mode: string, destination: string, label: string) => {
    const key = `delivery:${visit.id}:${mode}`;
    if (pendingActionRef.current) return;
    pendingActionRef.current = key;
    setPendingAction(key);
    try {
      const stamp = new Date().toLocaleString();
      const nextNote = [visit.dispatch_note, `${label} (${stamp})`].filter(Boolean).join('\n');
      onVisitUpdated(visit.id, {
        dispatch_mode: mode,
        delivery_destination: destination,
        dispatch_note: nextNote,
      });
      await apiUpdateDispatch({
        visit_id: visit.id,
        dispatch_mode: mode,
        delivery_destination: destination,
        dispatch_note: label,
      });
      onMessage(label);
      await onRefresh();
    } catch (err: any) {
      onMessage(err?.message || 'Could not update delivery status');
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  };
  const saveVisitDetails = async (payload: Record<string, unknown>) => {
    const visitId = Number(payload.visit_id || 0);
    const key = `details:${visitId}`;
    if (pendingActionRef.current) return;
    pendingActionRef.current = key;
    setPendingAction(key);
    try {
      await apiUpdateVisitDetails(payload);
      // Patch the reception grid row so status icons (comment, etc.) update immediately.
      onVisitUpdated(visitId, payload as Partial<PatientHistoryVisit>);
      receptionVisitCache.at = 0;
      onMessage('Visit details updated');
      await onRefresh();
    } catch (err: any) {
      onMessage(err?.message || 'Could not update visit details');
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  };
  const openPaymentAdjustment = (visit: PatientHistoryVisit, isRefund = false) => {
    setPaymentEditor({ visitId: visit.id, isRefund });
    setPaymentForm({
      amount: '',
      mode: 'cash',
      payer_name: history?.patient.full_name || '',
      payer_relation: 'Self',
      payer_mobile: history?.patient.phone || '',
      reference: isRefund ? 'Correction refund' : '',
    });
  };
  const updatePaymentForm = (key: keyof typeof paymentForm, value: string) => {
    setPaymentForm((current) => ({ ...current, [key]: value }));
  };
  const recordPaymentAdjustment = async (visit: PatientHistoryVisit) => {
    if (!paymentEditor || paymentEditor.visitId !== visit.id) return;
    const key = `payment:${visit.id}`;
    if (pendingActionRef.current) return;
    const amount = Number(paymentForm.amount || 0);
    if (!amount || amount <= 0) return;
    pendingActionRef.current = key;
    setPendingAction(key);
    try {
      await apiTakePayment({
        visit_id: visit.id,
        amount,
        mode: paymentForm.mode,
        reference: paymentForm.reference || undefined,
        is_refund: paymentEditor.isRefund,
        payer_name: paymentForm.payer_name || undefined,
        payer_relation: paymentForm.payer_relation || undefined,
        payer_mobile: paymentForm.payer_mobile || undefined,
        notes: paymentEditor.isRefund ? 'Refund / correction from reception history' : 'Additional payment from reception history',
      });
      onMessage(paymentEditor.isRefund ? 'Refund / correction recorded' : 'Payment recorded');
      setPaymentEditor(null);
      await onRefresh();
    } catch (err: any) {
      onMessage(err?.message || 'Could not record payment');
    } finally {
      pendingActionRef.current = null;
      setPendingAction(null);
    }
  };
  return (
    <div className="card mt-5">
      {printVisit && (
        <PrintOptionsModal visit={printVisit} onClose={() => setPrintVisit(null)} />
      )}
      <div className="card-head">
        <span className="ch-title"><History size={16} /> Patient history</span>
      </div>
      {loading && visits.length > 0 ? <div className="banner banner-info" style={{ margin: 12 }}>Refreshing full history...</div> : null}
      {loading && visits.length === 0 ? <div className="card-pad field-hint">Loading history...</div> : visits.length === 0 ? (
        <EmptyState title="No previous visits" sub="Create the first visit above." />
      ) : (
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="dt">
            <thead><tr><th>Visit</th><th>Date / Time</th><th>Tests</th><th>Paid</th><th>Status</th><th>Print</th></tr></thead>
            <tbody>
              {visits.map((visit) => (
                <Fragment key={visit.id}>
                  <tr className={openVisitId === visit.id ? 'selected' : ''} onClick={() => setOpenVisitId(openVisitId === visit.id ? null : visit.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">
                      {visit.visit_no}
                      {Number(visit.urgent_report || 0) === 1 ? <div className="status-chip"><Flag size={13} /> Urgent report</div> : null}
                      <VisitTags visit={visit} />
                    </td>
                    <td>{formatRisDateTime(visit.visit_datetime)}</td>
                    <td>
                      {visit.orders.map((order) => (
                        <div key={order.id}>
                          <span className="strong">{order.service_name || 'Service'}</span>
                          {/* Accession hidden from reception history list. */}
                          {order.linked_study_uid ? <span className="field-hint"> Soft copy received</span> : null}
                        </div>
                      ))}
                    </td>
                    <td>Rs {visit.paid_amount}</td>
                    <td>
                      <div className="stack-tight">
                        <strong>{workflowForVisit(visit).label}</strong>
                        <StatusChip status={visit.status} />
                      </div>
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-secondary" onClick={() => setPrintVisit(visit)}>
                        <Printer size={16} /> Print
                      </button>
                    </td>
                  </tr>
                  {openVisitId === visit.id && (
                    <tr>
                      <td colSpan={6}>
                        <div className="history-detail">
                          <div className="grid-3">
                            <DetailBox label="Visit" value={`${visit.visit_no} | ${visit.status}`} />
                            <div className="card card-surface card-pad">
                              <div className="field-label">Amount</div>
                              <div className="mt-3"><AmountBadges visit={visit} /></div>
                            </div>
                            <DetailBox label="Dispatch" value={visit.dispatch_mode ? `${visit.dispatch_mode} | ${visit.delivery_destination || 'patient'}` : 'Pending'} />
                          </div>
                          {Number(visit.urgent_report || 0) === 1 ? <div className="banner banner-warning mt-3"><Flag /> This report is urgent.</div> : null}
                          <div className="actions mt-3">
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'report_received' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'report_received', 'patient', 'Report received by reception')}>Report received</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'images_print_received' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'images_print_received', 'patient', 'Images print received by reception')}>Images print received</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'email' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'email', 'patient', 'Report emailed to patient')}>Email</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'center' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'center', 'center', 'Report sent for center delivery')}>Center delivery</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'home' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'home', 'home', 'Report sent for home delivery')}>Home delivery</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'courier' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'courier', 'other', 'Report sent by courier')}>Courier</Button>
                            <Button size="sm" disabled={!!pendingAction} variant={visit.dispatch_mode === 'patient_pickup' ? 'success' : 'secondary'} onClick={() => markVisitDelivery(visit, 'patient_pickup', 'patient', 'Report delivered to patient')}>Delivered</Button>
                          </div>
                          <div className="grid-2 mt-3">
                            <div>
                              <div className="field-label">Services</div>
                              {visit.orders.map((order) => (
                                <div key={order.id} className="card card-surface card-pad mt-3">
                                  <div className="between">
                                    <span className="strong">{order.service_name || 'Service'}</span>
                                    <StatusChip status={order.status} />
                                  </div>
                                  {/* Accession hidden from reception visit detail. */}
                                  {order.room_title ? <div className="field-hint mt-3">Room: {order.room_title}</div> : null}
                                  {/* Console / accession actions intentionally hidden from reception. */}
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="field-label">Payments and receipts</div>
                              <div className="actions mt-3">
                                <Button size="sm" disabled={!!pendingAction} variant="secondary" onClick={() => openPaymentAdjustment(visit, false)}>Add payment</Button>
                                <Button size="sm" disabled={!!pendingAction} variant="secondary" onClick={() => openPaymentAdjustment(visit, true)}>Refund / correction</Button>
                              </div>
                              {paymentEditor?.visitId === visit.id ? (
                                <div className="card card-pad mt-3">
                                  <div className="field-label">{paymentEditor.isRefund ? 'Refund / correction' : 'Add payment'}</div>
                                  <div className="grid-2 mt-3">
                                    <TextInput label="Amount" value={paymentForm.amount} onChange={(event) => updatePaymentForm('amount', event.target.value)} />
                                    <SelectInput label="Mode" value={paymentForm.mode} onChange={(event) => updatePaymentForm('mode', event.target.value)}>
                                      <option value="cash">Cash</option>
                                      <option value="upi">UPI</option>
                                      <option value="card">Card</option>
                                      <option value="other">Other</option>
                                    </SelectInput>
                                    <TextInput label="Paid by" value={paymentForm.payer_name} onChange={(event) => updatePaymentForm('payer_name', event.target.value)} />
                                    <TextInput label="Relation" value={paymentForm.payer_relation} onChange={(event) => updatePaymentForm('payer_relation', event.target.value)} />
                                    <TextInput label="Payer mobile" value={paymentForm.payer_mobile} onChange={(event) => updatePaymentForm('payer_mobile', event.target.value)} />
                                    <TextInput label="Reference" value={paymentForm.reference} onChange={(event) => updatePaymentForm('reference', event.target.value)} />
                                  </div>
                                  <div className="actions mt-3">
                                    <Button size="sm" variant="primary" disabled={!!pendingAction || Number(paymentForm.amount || 0) <= 0} onClick={() => recordPaymentAdjustment(visit)}>
                                      {pendingAction === `payment:${visit.id}` ? 'Saving...' : 'Save payment'}
                                    </Button>
                                    <Button size="sm" variant="ghost" disabled={!!pendingAction} onClick={() => setPaymentEditor(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : null}
                              {visit.payments.length === 0 ? <div className="field-hint mt-3">No payments recorded.</div> : visit.payments.map((payment) => (
                                <div key={payment.id} className="card card-surface card-pad mt-3">
                                  <div className="between">
                                    <span className="strong">Rs {payment.amount} ({payment.mode})</span>
                                    <span className="field-hint">{formatRisDateTime(payment.received_at)}</span>
                                  </div>
                                  <div className="field-hint mt-3">
                                    Paid by: <span className="strong">{payment.payer_name || 'Patient'}</span>
                                    {payment.payer_relation ? ` (${payment.payer_relation})` : ''}
                                    {payment.payer_mobile ? ` | ${payment.payer_mobile}` : ''}
                                  </div>
                                  <div className="field-hint mt-3">Reference: {payment.reference || '-'}</div>
                                  <div className="field-hint mt-3">Received by: {payment.received_by_name || '-'}</div>
                                </div>
                              ))}
                              {/* Print buttons moved to the receipt-column print modal. */}
                            </div>
                          </div>
                          <VisitDetailEditor
                            visit={visit}
                            centers={centers}
                            referringDoctors={referringDoctors}
                            staffList={staffList}
                            areaList={areaList}
                            pros={pros}
                            saving={pendingAction === `details:${visit.id}`}
                            onSave={saveVisitDetails}
                          />
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

function PrintOptionsModal({ visit, onClose }: { visit: PatientHistoryVisit; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 520 }}>
        <ModalCloseButton onClick={onClose} />
        <SectionHeader icon={Printer} title={`Print ${visit.visit_no}`} sub="Choose the document to print" />
        <div className="actions mt-3">
          <a className="btn btn-secondary" href={printAssetUrl(visit.id, 'barcode')} target="_blank" rel="noreferrer">
            <Printer size={16} /> Barcode
          </a>
          <a className="btn btn-secondary" href={printAssetUrl(visit.id, 'srs')} target="_blank" rel="noreferrer">
            <Printer size={16} /> SRS
          </a>
          {visit.receipts.map((receipt) => (
            <a key={receipt.id} className="btn btn-secondary" href={receipt.print_url || '#'} target="_blank" rel="noreferrer">
              <Printer size={16} /> Receipt {receipt.receipt_no}
            </a>
          ))}
          {visit.receipts.length === 0 ? <span className="field-hint">Receipt not generated yet</span> : null}
          <a className="btn btn-secondary" href={printAssetUrl(visit.id, 'bill_receipt')} target="_blank" rel="noreferrer">
            <Printer size={16} /> Bill Receipt
          </a>
        </div>
        <VisitTags visit={visit} />
      </div>
    </div>
  );
}

function VisitDetailEditor({
  visit,
  centers,
  referringDoctors,
  staffList,
  areaList,
  pros,
  saving,
  onSave,
}: {
  visit: PatientHistoryVisit;
  centers: Center[];
  referringDoctors: any[];
  staffList: Lookup[];
  areaList: Lookup[];
  pros: Pro[];
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => visitDetailForm(visit));
  useEffect(() => {
    setForm(visitDetailForm(visit));
  }, [visit]);
  const update = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  if (!open) {
    return (
      <div className="actions mt-3">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>View / edit details</Button>
      </div>
    );
  }
  return (
    <div className="card card-pad mt-3">
      <SectionHeader title="Visit details" sub="Edit registration, home visit, dispatch, print, and billing fields">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Hide</Button>
      </SectionHeader>
      <div className="grid-3">
        <SelectInput label="Center" value={form.center_name} onChange={(event) => update('center_name', event.target.value)}>
          <option value="Main Lab">Main Lab</option>
          {centers.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}
        </SelectInput>
        <SelectInput label="Consultant" value={form.consultant_doctor} onChange={(event) => update('consultant_doctor', event.target.value)}>
          <option value="">Select consultant</option>
          {referringDoctors.map((doctor) => <option key={doctor.id} value={doctor.name}>{doctor.name}</option>)}
        </SelectInput>
        <TextInput label="Reference" value={form.ref_no} onChange={(event) => update('ref_no', event.target.value)} />
        <TextInput label="Sample date/time" value={form.sample_collected_at} onChange={(event) => update('sample_collected_at', event.target.value)} placeholder="YYYY-MM-DD HH:MM:SS" />
        <SelectInput label="Home visit staff" value={form.phlebotomy_staff} onChange={(event) => update('phlebotomy_staff', event.target.value)}>
          <option value="">Select staff</option>
          {staffList.map((staff) => <option key={staff.id} value={staff.value}>{staff.value}</option>)}
        </SelectInput>
        <SelectInput label="Home visit area" value={form.home_visit_area} onChange={(event) => update('home_visit_area', event.target.value)}>
          <option value="">Select area</option>
          {areaList.map((area) => <option key={area.id} value={area.value}>{area.value}</option>)}
        </SelectInput>
        <TextInput label="Home visit amount" value={form.home_visit_amount} onChange={(event) => update('home_visit_amount', event.target.value)} />
        <TextInput label="Home visit time" value={form.home_visit_time} onChange={(event) => update('home_visit_time', event.target.value)} />
        <SelectInput label="PRO" value={form.pro_name} onChange={(event) => update('pro_name', event.target.value)}>
          <option value="">Select PRO</option>
          {pros.map((pro) => <option key={pro.id} value={pro.name}>{pro.name}</option>)}
        </SelectInput>
        <TextInput label="Commission" value={form.commission_amount} onChange={(event) => update('commission_amount', event.target.value)} />
        <TextInput label="Extra charge" value={form.misc_charge} onChange={(event) => update('misc_charge', event.target.value)} />
        <TextInput label="Discount" value={form.discount} onChange={(event) => update('discount', event.target.value)} />
        <SelectInput label="Dispatch mode" value={form.dispatch_mode} onChange={(event) => update('dispatch_mode', event.target.value)}>
          <option value="">Pending</option>
          <option value="report_received">Report received</option>
          <option value="images_print_received">Images print received</option>
          <option value="email">Email</option>
          <option value="center">Center delivery</option>
          <option value="home">Home delivery</option>
          <option value="courier">Courier</option>
          <option value="patient_pickup">Patient pickup</option>
        </SelectInput>
        <SelectInput label="Delivery to" value={form.delivery_destination} onChange={(event) => update('delivery_destination', event.target.value)}>
          <option value="patient">Patient</option>
          <option value="center">Center</option>
          <option value="home">Home</option>
          <option value="other">Other</option>
        </SelectInput>
        <label className="checkrow" style={{ alignSelf: 'end' }}><input type="checkbox" checked={!!form.urgent_report} onChange={(event) => update('urgent_report', event.target.checked)} /> <span>Urgent report</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.regular_patient} onChange={(event) => update('regular_patient', event.target.checked)} /> <span>Regular patient</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.print_barcode} onChange={(event) => update('print_barcode', event.target.checked)} /> <span>Barcode</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.print_srs} onChange={(event) => update('print_srs', event.target.checked)} /> <span>SRS</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.print_receipt} onChange={(event) => update('print_receipt', event.target.checked)} /> <span>Receipt</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.print_bill_receipt} onChange={(event) => update('print_bill_receipt', event.target.checked)} /> <span>Bill receipt</span></label>
        <label className="checkrow"><input type="checkbox" checked={!!form.send_to_printer} onChange={(event) => update('send_to_printer', event.target.checked)} /> <span>Printer</span></label>
      </div>
      <TextareaInput label="Comment" rows={3} className="mt-3" value={form.visit_comment} onChange={(event) => update('visit_comment', event.target.value)} />
      <TextareaInput label="Dispatch notes" rows={3} className="mt-3" value={form.dispatch_note} onChange={(event) => update('dispatch_note', event.target.value)} />
      <div className="actions mt-3">
        <Button size="sm" variant="primary" disabled={saving} onClick={async () => { await onSave({ visit_id: visit.id, ...form }); setOpen(false); }}>
          {saving ? 'Saving...' : 'Save details'}
        </Button>
      </div>
    </div>
  );
}

function visitDetailForm(visit: PatientHistoryVisit) {
  return {
    center_name: visit.center_name || '',
    consultant_doctor: visit.consultant_doctor || '',
    sample_collected_at: visit.sample_collected_at || '',
    ref_no: visit.ref_no || '',
    urgent_report: Number(visit.urgent_report || 0) === 1,
    visit_comment: visit.visit_comment || '',
    phlebotomy_staff: visit.phlebotomy_staff || '',
    home_visit_area: visit.home_visit_area || '',
    home_visit_amount: visit.home_visit_amount || '',
    home_visit_time: visit.home_visit_time || '',
    dispatch_mode: visit.dispatch_mode || '',
    dispatch_note: visit.dispatch_note || '',
    delivery_destination: visit.delivery_destination || 'patient',
    pro_name: visit.pro_name || '',
    commission_amount: visit.commission_amount || '',
    regular_patient: Number(visit.regular_patient || 0) === 1,
    misc_charge: visit.misc_charge || '',
    discount: visit.discount || '',
    print_barcode: Number(visit.print_barcode || 0) === 1,
    print_srs: Number(visit.print_srs || 0) === 1,
    print_receipt: Number(visit.print_receipt ?? 1) === 1,
    print_bill_receipt: Number(visit.print_bill_receipt || 0) === 1,
    send_to_printer: Number(visit.send_to_printer ?? 1) === 1,
  };
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
  prepareConsoleWorklist: (order?: Order, nodeId?: string) => Promise<void>;
  editAccession: (order: Order) => Promise<void>;
}) {
  void patient;
  const [nodeId, setNodeId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef<string | null>(null);
  const runOnce = async (key: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = key;
    setBusy(key);
    try {
      await action();
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  };
  return (
    <div className="actions">
      {nodes.length > 0 ? (
        <SelectInput value={nodeId} onChange={(event) => setNodeId(event.target.value)} style={{ width: 190 }}>
          <option value="">Select room</option>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.name} ({node.ae_title})</option>)}
        </SelectInput>
      ) : null}
      <Button size="sm" variant="secondary" icon={MonitorUp} disabled={!!busy} onClick={() => runOnce('send', () => prepareConsoleWorklist(order, nodeId))}>
        {busy === 'send' ? 'Sending...' : 'Send to console'}
      </Button>
      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => runOnce('accession', () => editAccession(order))}>
        Edit accession
      </Button>
    </div>
  );
}

function PatientBalanceSummary({ visits }: { visits: PatientHistoryVisit[] }) {
  const totalBalance = visits.reduce((sum, visit) => sum + Number(visit.balance || 0), 0);
  if (totalBalance <= 0) {
    return <div className="banner banner-success mt-3">No pending balance for this patient.</div>;
  }
  const unpaid = visits.filter((visit) => Number(visit.balance || 0) > 0);
  return (
    <div className="banner banner-warning mt-3" style={{ borderColor: 'var(--danger, #dc2626)', color: 'var(--danger, #dc2626)' }}>
      Pending balance: Rs {totalBalance.toFixed(2)} across {unpaid.length} visit(s)
    </div>
  );
}

function PatientFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`patient-fact ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function visitTags(visit: Partial<PatientHistoryVisit & ReceptionVisitRow>): Array<{ label: string; tone?: 'due' }> {
  const tags: Array<{ label: string; tone?: 'due' }> = [];
  if (Number(visit.home_visit_amount || 0) > 0 || visit.home_visit_area || visit.delivery_destination === 'home' || visit.dispatch_mode === 'home') {
    tags.push({ label: `Home visit${visit.home_visit_area ? `: ${visit.home_visit_area}` : ''}` });
  }
  if (visit.center_name && visit.center_name !== 'Main Lab') tags.push({ label: `Center: ${visit.center_name}` });
  if (Number(visit.urgent_report || 0) === 1) tags.push({ label: 'Urgent' });
  if (Number(visit.balance || 0) > 0) tags.push({ label: `Due Rs ${Number(visit.balance).toFixed(2)}`, tone: 'due' });
  return tags;
}

function VisitTags({ visit }: { visit: Partial<PatientHistoryVisit & ReceptionVisitRow> }) {
  const tags = visitTags(visit);
  if (tags.length === 0) return null;
  return (
    <div className="visit-tags">
      {tags.map((tag) => <span key={tag.label} className={`visit-tag ${tag.tone || ''}`}>{tag.label}</span>)}
    </div>
  );
}

function AmountBadges({ visit }: { visit: Partial<PatientHistoryVisit & ReceptionVisitRow> }) {
  const paymentRefundTotal = Array.isArray((visit as PatientHistoryVisit).payments)
    ? (visit as PatientHistoryVisit).payments.reduce((sum, payment) => (
        Number(payment.is_refund || 0) === 1 ? sum + Number(payment.amount || 0) : sum
      ), 0)
    : 0;
  const refund = Number((visit as any).refund_total || 0) || paymentRefundTotal;
  const balance = Number(visit.balance || 0);
  const items = [
    ['Net', Number(visit.net_amount || 0)],
    ['Paid', Number(visit.paid_amount || 0)],
    ['Refund', refund],
    ['Balance', balance],
  ] as const;
  return (
    <div className="amount-badges">
      {items.map(([label, value]) => (
        <div key={label} className={`amount-badge ${label === 'Balance' && value > 0 ? 'balance-due' : ''}`}>
          <div className="label">{label}</div>
          <div className="value">Rs {value.toFixed(2)}</div>
        </div>
      ))}
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
