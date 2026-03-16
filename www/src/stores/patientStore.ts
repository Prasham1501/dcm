import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Patient, PatientFilters, DateRangePreset } from '@/types/patient';
import { mockPatients } from '@/data/mockPatients';
import { patientService } from '@/services/patientService';

// Set to true to use real API, false for mock data
const USE_API = import.meta.env.VITE_USE_API === 'true';

interface PatientState {
  patients: Patient[];
  filteredPatients: Patient[];
  selectedPatient: Patient | null;
  selectedPatients: Set<string>;
  filters: PatientFilters;
  loading: boolean;
  error: string | null;

  // Pagination (from API)
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  perPage: number;
  sortBy: string;

  // Actions
  loadPatients: () => Promise<void>;
  fetchPage: (page: number) => Promise<void>;
  selectPatient: (patient: Patient | null) => void;
  togglePatientSelection: (id: string) => void;
  selectAll: () => void;
  invertSelection: () => void;
  clearSelection: () => void;
  setFilter: <K extends keyof PatientFilters>(key: K, value: PatientFilters[K]) => void;
  setDateRange: (preset: DateRangePreset) => void;
  applyFilters: () => Promise<void>;
  clearFilters: () => void;
  setSortBy: (sortBy: string) => void;
  deletePatient: (patientId: string) => Promise<void>;
  deleteOldStudies: (months: number) => Promise<void>;
  editPatient: (id: string, updates: Partial<Patient>) => void;
  createPatient: (patient: Patient) => void;
  deleteSelected: () => void;
  importPatients: (newPatients: Patient[]) => void;
  exportSelected: () => Patient[];
}

const defaultFilters: PatientFilters = {
  patientId: '',
  patientName: '',
  referringPhysician: '',
  studyDescription: '',
  accessionNumber: '',
  modality: '',
  dateRange: 'all',
  fromDate: '',
  toDate: '',
  month: '',
  year: '',
};

// Local filter for mock data mode
function matchesFilter(patient: Patient, filters: PatientFilters): boolean {
  if (filters.patientId && !patient.patientId.toLowerCase().includes(filters.patientId.toLowerCase())) return false;
  if (filters.patientName && !patient.patientName.toLowerCase().includes(filters.patientName.toLowerCase())) return false;
  if (filters.referringPhysician && !patient.referringPhysician.toLowerCase().includes(filters.referringPhysician.toLowerCase())) return false;
  if (filters.studyDescription && !patient.studyDescription.toLowerCase().includes(filters.studyDescription.toLowerCase())) return false;
  if (filters.accessionNumber && !patient.accessionNumber.toLowerCase().includes(filters.accessionNumber.toLowerCase())) return false;
  if (filters.modality && !patient.modality.toLowerCase().includes(filters.modality.toLowerCase())) return false;

  if (filters.dateRange !== 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = patient.studyDate.split('-');
    const studyDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));

    switch (filters.dateRange) {
      case 'today':
        if (studyDate.toDateString() !== today.toDateString()) return false;
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (studyDate.toDateString() !== yesterday.toDateString()) return false;
        break;
      }
      case 'yesterdayAndToday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (studyDate < yesterday || studyDate > today) return false;
        break;
      }
      case 'last7days': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (studyDate < weekAgo) return false;
        break;
      }
    }
  }

  return true;
}

export const usePatientStore = create<PatientState>()(
  persist(
    (set, get) => ({
  patients: [],
  filteredPatients: [],
  selectedPatient: null,
  selectedPatients: new Set(),
  filters: { ...defaultFilters },
  loading: false,
  error: null,

  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  perPage: 50,
  sortBy: 'date',

  loadPatients: async () => {
    set({ loading: true, error: null });

    if (USE_API) {
      try {
        const { patients, pagination } = await patientService.fetchPatients(
          get().filters,
          1,
          get().perPage,
          get().sortBy
        );
        set({
          patients,
          filteredPatients: patients,
          loading: false,
          currentPage: pagination.page,
          totalPages: pagination.total_pages,
          totalRecords: pagination.total,
        });
      } catch (err: any) {
        console.error('Failed to load patients from API:', err);
        // Fallback to mock data on error
        set({
          patients: mockPatients,
          filteredPatients: mockPatients,
          loading: false,
          error: err.message || 'Failed to load patients',
          totalRecords: mockPatients.length,
          totalPages: 1,
        });
      }
    } else {
      set({
        patients: mockPatients,
        filteredPatients: mockPatients,
        loading: false,
        totalRecords: mockPatients.length,
        totalPages: 1,
      });
    }
  },

  fetchPage: async (page: number) => {
    if (!USE_API) {
      set({ currentPage: page });
      return;
    }

    set({ loading: true });
    try {
      const { patients, pagination } = await patientService.fetchPatients(
        get().filters,
        page,
        get().perPage,
        get().sortBy
      );
      set({
        patients,
        filteredPatients: patients,
        loading: false,
        currentPage: pagination.page,
        totalPages: pagination.total_pages,
        totalRecords: pagination.total,
      });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  selectPatient: (patient) => {
    set({ selectedPatient: patient });
  },

  togglePatientSelection: (id) => {
    const { selectedPatients } = get();
    const next = new Set(selectedPatients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedPatients: next });
  },

  selectAll: () => {
    const { filteredPatients } = get();
    set({ selectedPatients: new Set(filteredPatients.map((p) => p.id)) });
  },

  invertSelection: () => {
    const { filteredPatients, selectedPatients } = get();
    const next = new Set<string>();
    filteredPatients.forEach((p) => {
      if (!selectedPatients.has(p.id)) next.add(p.id);
    });
    set({ selectedPatients: next });
  },

  clearSelection: () => {
    set({ selectedPatients: new Set() });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
  },

  setDateRange: (preset) => {
    set((state) => ({
      filters: { ...state.filters, dateRange: preset },
    }));
    get().applyFilters();
  },

  applyFilters: async () => {
    if (USE_API) {
      set({ loading: true, currentPage: 1 });
      try {
        const { patients, pagination } = await patientService.fetchPatients(
          get().filters,
          1,
          get().perPage,
          get().sortBy
        );
        set({
          patients,
          filteredPatients: patients,
          loading: false,
          currentPage: pagination.page,
          totalPages: pagination.total_pages,
          totalRecords: pagination.total,
        });
      } catch (err: any) {
        set({ loading: false, error: err.message });
      }
    } else {
      const { patients, filters } = get();
      const filtered = patients.filter((p) => matchesFilter(p, filters));
      set({ filteredPatients: filtered, totalRecords: filtered.length });
    }
  },

  clearFilters: () => {
    set({ filters: { ...defaultFilters } });
    get().loadPatients();
  },

  setSortBy: (sortBy: string) => {
    set({ sortBy });
    if (USE_API) {
      get().applyFilters();
    }
  },

  deletePatient: async (patientId: string) => {
    if (USE_API) {
      await patientService.deletePatient(patientId);
      get().loadPatients();
    } else {
      set((state) => {
        const patients = state.patients.filter((p) => p.patientId !== patientId);
        return {
          patients,
          filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
        };
      });
    }
  },

  deleteOldStudies: async (months: number) => {
    if (USE_API) {
      await patientService.deleteOldStudies(months);
      get().loadPatients();
    }
  },

  editPatient: (id: string, updates: Partial<Patient>) => {
    set((state) => {
      const patients = state.patients.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      return {
        patients,
        filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
        selectedPatient: state.selectedPatient?.id === id
          ? { ...state.selectedPatient, ...updates }
          : state.selectedPatient,
      };
    });
  },

  createPatient: (patient: Patient) => {
    set((state) => {
      const patients = [patient, ...state.patients];
      return {
        patients,
        filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
        totalRecords: patients.length,
      };
    });
  },

  deleteSelected: () => {
    set((state) => {
      const patients = state.patients.filter((p) => !state.selectedPatients.has(p.id));
      return {
        patients,
        filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
        selectedPatients: new Set<string>(),
        selectedPatient: state.selectedPatient && state.selectedPatients.has(state.selectedPatient.id)
          ? null
          : state.selectedPatient,
        totalRecords: patients.length,
      };
    });
  },

  importPatients: (newPatients: Patient[]) => {
    set((state) => {
      const existingIds = new Set(state.patients.map((p) => p.id));
      const unique = newPatients.filter((p) => !existingIds.has(p.id));
      const patients = [...state.patients, ...unique];
      return {
        patients,
        filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
        totalRecords: patients.length,
      };
    });
  },

  exportSelected: () => {
    const { patients, selectedPatients } = get();
    return patients.filter((p) => selectedPatients.has(p.id));
  },
}),
    {
      name: 'patient-store',
      partialize: (state) => ({
        patients: state.patients,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Restore Set from array
          return parsed;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);
