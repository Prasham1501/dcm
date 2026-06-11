import { create } from 'zustand';
import {
  apiSearchPatients,
  apiCreatePatient,
  apiListServices,
  apiListReferringDoctors,
  apiRegisterVisit,
  type Patient,
  type Service,
  type ReferringDoctor,
  type RegisterResult,
} from '../api/receptionApi';
import { validatePatientForm, buildPatientPayload, type PatientForm } from '../lib/patientForm';
import { validateVisitForm, buildVisitPayload, type VisitForm } from '../lib/visitForm';

interface ReceptionState {
  patients: Patient[];
  services: Service[];
  referringDoctors: ReferringDoctor[];
  loading: boolean;
  error: string | null;
  lastCreated: Patient | null;
  lastVisit: RegisterResult | null;
  search: (query: string) => Promise<void>;
  register: (form: PatientForm) => Promise<Patient | null>;
  loadServices: () => Promise<void>;
  loadReferringDoctors: (query?: string) => Promise<void>;
  registerVisit: (form: VisitForm) => Promise<RegisterResult | null>;
  reset: () => void;
}

export const useReceptionStore = create<ReceptionState>()((set) => ({
  patients: [],
  services: [],
  referringDoctors: [],
  loading: false,
  error: null,
  lastCreated: null,
  lastVisit: null,

  search: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const patients = await apiSearchPatients(query);
      set({ patients, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Search failed' });
    }
  },

  register: async (form: PatientForm) => {
    const errors = validatePatientForm(form);
    if (errors.length > 0) {
      set({ error: errors.join('. ') });
      return null;
    }
    set({ loading: true, error: null });
    try {
      const patient = await apiCreatePatient(buildPatientPayload(form, { action: 'create' }));
      set((s) => ({ loading: false, lastCreated: patient, patients: [patient, ...s.patients] }));
      return patient;
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Registration failed' });
      return null;
    }
  },

  loadServices: async () => {
    if (useReceptionStore.getState().services.length > 0) return;
    try {
      const services = await apiListServices();
      set({ services });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load services' });
    }
  },

  loadReferringDoctors: async (query = '') => {
    if (query === '' && useReceptionStore.getState().referringDoctors.length > 0) return;
    try {
      const referringDoctors = await apiListReferringDoctors(query);
      set({ referringDoctors });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load referring doctors' });
    }
  },

  registerVisit: async (form: VisitForm) => {
    const errors = validateVisitForm(form);
    if (errors.length > 0) {
      set({ error: errors.join(' ') });
      return null;
    }
    set({ loading: true, error: null });
    try {
      const result = await apiRegisterVisit(buildVisitPayload(form));
      set({ loading: false, lastVisit: result });
      return result;
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Visit registration failed' });
      return null;
    }
  },

  reset: () =>
    set({
      patients: [],
      services: [],
      referringDoctors: [],
      loading: false,
      error: null,
      lastCreated: null,
      lastVisit: null,
    }),
}));
