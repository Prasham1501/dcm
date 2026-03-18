import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Patient, PatientFilters, DateRangePreset } from '@/types/patient';
import { patientService } from '@/services/patientService';

// Set to true to use real API (PHP backend), false for local file mode
const USE_API = import.meta.env.VITE_USE_API === 'true';

interface PatientState {
  patients: Patient[];
  filteredPatients: Patient[];
  selectedPatient: Patient | null;
  selectedPatients: Set<string>;
  filters: PatientFilters;
  loading: boolean;
  error: string | null;
  folderPath: string;
  syncing: boolean;
  syncError: string | null;

  // Pagination (from API)
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  perPage: number;
  sortBy: string;

  // Actions
  loadPatients: () => Promise<void>;
  fetchPage: (page: number) => Promise<void>;
  scanFolder: (dirPath: string) => Promise<void>;
  setFolderPath: (path: string) => void;
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
  importToManagedStorage: (filePaths: string[], destDir?: string) => Promise<{ imported: string[]; errors: string[]; managedDir: string }>;
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
// NOTE: All field accesses are null-safe (use || '') to avoid crashes on
// incomplete records loaded from localStorage.
function matchesFilter(patient: Patient, filters: PatientFilters): boolean {
  try {
    const pId   = (patient.patientId          || '').toLowerCase();
    const pName = (patient.patientName        || '').toLowerCase();
    const pRef  = (patient.referringPhysician || '').toLowerCase();
    const pDesc = (patient.studyDescription   || '').toLowerCase();
    const pAcc  = (patient.accessionNumber    || '').toLowerCase();
    const pMod  = (patient.modality           || '').toLowerCase();

    if (filters.patientId          && !pId.includes(filters.patientId.toLowerCase()))          return false;
    if (filters.patientName        && !pName.includes(filters.patientName.toLowerCase()))       return false;
    if (filters.referringPhysician && !pRef.includes(filters.referringPhysician.toLowerCase())) return false;
    if (filters.studyDescription   && !pDesc.includes(filters.studyDescription.toLowerCase()))  return false;
    if (filters.accessionNumber    && !pAcc.includes(filters.accessionNumber.toLowerCase()))    return false;
    if (filters.modality           && !pMod.includes(filters.modality.toLowerCase()))           return false;

    if (filters.dateRange && filters.dateRange !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Support both DD-MM-YYYY and YYYY-MM-DD formats
      const raw = patient.studyDate || '';
      let studyDate: Date;
      if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
        const parts = raw.split('-');
        studyDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        studyDate = new Date(raw);
      } else {
        studyDate = new Date(raw);
      }

      if (isNaN(studyDate.getTime())) return true; // can't parse date — don't exclude

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
        case 'custom': {
          if (filters.month && filters.year) {
            if (studyDate.getMonth() + 1 !== parseInt(filters.month)) return false;
            if (studyDate.getFullYear() !== parseInt(filters.year)) return false;
          } else if (filters.year) {
            if (studyDate.getFullYear() !== parseInt(filters.year)) return false;
          } else {
            const parseDDMMYYYY = (d: string) => {
              if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
                const parts = d.split('-');
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
              return new Date(d);
            };
            if (filters.fromDate) {
              const fromD = parseDDMMYYYY(filters.fromDate);
              if (!isNaN(fromD.getTime()) && studyDate < fromD) return false;
            }
            if (filters.toDate) {
              const toD = parseDDMMYYYY(filters.toDate);
              toD.setHours(23, 59, 59, 999);
              if (!isNaN(toD.getTime()) && studyDate > toD) return false;
            }
          }
          break;
        }
      }
    }

    return true;
  } catch {
    return true; // never hide a patient due to filter crash
  }
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
  folderPath: '',
  syncing: false,
  syncError: null,

  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  perPage: 50,
  sortBy: 'date',

  loadPatients: async () => {
    set({ loading: true, error: null });

    if (USE_API) {
      try {
        const { patients: apiPatients, pagination } = await patientService.fetchPatients(
          get().filters,
          1,
          get().perPage,
          get().sortBy
        );

        // Preserve filePaths/studyInstanceUID from existing patients (e.g. from folder sync)
        const existing = get().patients;
        const existingMap = new Map<string, Patient>();
        existing.forEach((p) => {
          existingMap.set(p.patientId, p);
          if (p.studyInstanceUID) existingMap.set(p.studyInstanceUID, p);
        });

        const mergedPatients = apiPatients.map((ap) => {
          const prev = existingMap.get(ap.patientId);
          if (prev?.filePaths && prev.filePaths.length > 0 && !ap.filePaths) {
            return { ...ap, filePaths: prev.filePaths, studyInstanceUID: prev.studyInstanceUID || ap.studyInstanceUID };
          }
          return ap;
        });

        // Also keep folder-synced patients that aren't in API results
        const apiIds = new Set(apiPatients.map((p) => p.patientId));
        const folderOnlyPatients = existing.filter(
          (p) => p.filePaths && p.filePaths.length > 0 && !apiIds.has(p.patientId)
        );

        const patients = [...mergedPatients, ...folderOnlyPatients];

        set({
          patients,
          filteredPatients: patients,
          loading: false,
          currentPage: pagination.page,
          totalPages: pagination.total_pages,
          totalRecords: patients.length,
        });
      } catch {
        // API unavailable — keep persisted patients (from folder sync), don't override with mock
        const { patients, filters } = get();
        set({
          filteredPatients: patients.filter((p) => matchesFilter(p, filters)),
          loading: false,
          totalRecords: patients.length,
          totalPages: 1,
        });
      }
    } else {
      // Local mode: show all persisted patients and apply current filters
      const { patients, filters } = get();
      try {
        const filtered = patients.filter((p) => matchesFilter(p, filters));
        set({
          filteredPatients: filtered,
          loading: false,
          totalRecords: patients.length,
          totalPages: 1,
        });
      } catch (err: any) {
        console.error('[patientStore] loadPatients filter error:', err);
        // Fallback: show all patients unfiltered
        set({ filteredPatients: patients, loading: false, totalRecords: patients.length, totalPages: 1 });
      }
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
    // Also sync selectedPatients Set so Delete Selected / Backup Selected work on the clicked row
    const next = new Set<string>();
    if (patient) next.add(patient.id);
    set({ selectedPatient: patient, selectedPatients: next });
  },

  togglePatientSelection: (id) => {
    const { selectedPatients, patients, filteredPatients } = get();
    const next = new Set(selectedPatients);
    const adding = !next.has(id);
    if (adding) next.add(id); else next.delete(id);

    // Keep selectedPatient in sync: point to the last added patient, or
    // the first remaining selected one when deselecting.
    const allPatients = [...patients, ...filteredPatients];
    const patientObj = allPatients.find((p) => p.id === id) ?? null;
    const selectedPatient = adding
      ? patientObj
      : (next.size > 0
          ? allPatients.find((p) => next.has(p.id)) ?? null
          : null);

    set({ selectedPatients: next, selectedPatient });
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
    const { patients, filters } = get();

    // Always apply local filtering immediately for instant feedback
    const localFiltered = patients.filter((p) => matchesFilter(p, filters));
    set({ filteredPatients: localFiltered, totalRecords: localFiltered.length });

    if (USE_API) {
      set({ loading: true, currentPage: 1 });
      try {
        const { patients: apiPatients, pagination } = await patientService.fetchPatients(
          get().filters,
          1,
          get().perPage,
          get().sortBy
        );
        // Merge API results with any folder-synced patients that have local file paths
        const existing = get().patients;
        const apiIds = new Set(apiPatients.map((p) => p.patientId));
        const folderOnly = existing.filter(
          (p) => p.filePaths && p.filePaths.length > 0 && !apiIds.has(p.patientId)
        );
        const merged = [...apiPatients, ...folderOnly];
        set({
          patients: merged,
          filteredPatients: merged,
          loading: false,
          currentPage: pagination.page,
          totalPages: pagination.total_pages,
          totalRecords: pagination.total,
        });
      } catch (err: any) {
        // API failed — keep local filter result already applied above
        console.warn('[patientStore] applyFilters API call failed, using local filter:', err.message);
        set({ loading: false, error: null });
      }
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
    } else {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      set((state) => {
        const patients = state.patients.filter((p) => {
          const parts = p.studyDate.split('-');
          if (parts.length === 3) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            return d >= cutoff;
          }
          return true;
        });
        return {
          patients,
          filteredPatients: patients.filter((p) => matchesFilter(p, state.filters)),
          totalRecords: patients.length,
        };
      });
    }
  },

  setFolderPath: (folderPath: string) => {
    set({ folderPath });
  },

  scanFolder: async (dirPath: string) => {
    set({ syncing: true, syncError: null, folderPath: dirPath });
    try {
      // Use Electron DICOM server if available, otherwise Vite dev server
      const isElectron = !!(window as any).electronAPI?.isElectron;
      const scanBase = isElectron ? 'http://localhost:3457' : '';
      const response = await fetch(`${scanBase}/api/dicom/scan-patients?dir=${encodeURIComponent(dirPath)}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Scan failed');
      }

      const scannedPatients: Patient[] = data.patients.map((p: any) => ({
        id: p.id || p.studyInstanceUID,
        patientId: p.patientId,
        patientName: p.patientName,
        age: p.age,
        sex: (p.sex === 'M' || p.sex === 'F' || p.sex === 'O') ? p.sex : '' as const,
        studyDate: p.studyDate,
        studyDescription: p.studyDescription,
        images: p.images,
        modality: p.modality,
        accessionNumber: p.accessionNumber,
        referringPhysician: p.referringPhysician,
        printed: false,
        studyInstanceUID: p.studyInstanceUID,
        filePaths: p.filePaths,
      }));

      // Full replace: discard all old patients (including stale database records
      // with no filePaths) and use only the freshly scanned results.
      const { filters } = get();

      set({
        patients: scannedPatients,
        filteredPatients: scannedPatients.filter((p) => matchesFilter(p, filters)),
        totalRecords: scannedPatients.length,
        syncing: false,
        selectedPatient: null,
      });
    } catch (err: any) {
      set({ syncing: false, syncError: err.message || 'Failed to scan folder' });
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

  importToManagedStorage: async (filePaths, destDir) => {
    const isElectron = !!(window as any).electronAPI?.isElectron;
    const importBase = isElectron ? 'http://localhost:3457' : '';
    const response = await fetch(`${importBase}/api/dicom/import-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePaths, destDir }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Import failed');
    return { imported: data.imported, errors: data.errors, managedDir: data.managedDir };
  },
}),
    {
      name: 'patient-store',
      partialize: (state) => ({
        patients: state.patients,
        folderPath: state.folderPath,
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
