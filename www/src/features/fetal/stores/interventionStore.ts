import { create } from 'zustand';
import { interventionsApi, type InterventionProcedure } from '@/features/fetal/api/interventionsApi';

interface State {
  examinationId: number | null;
  procedures:    InterventionProcedure[];
  counselling:   string;
  loading:       boolean;
  saving:        boolean;
  error:         string | null;

  loadForExamination: (id: number) => Promise<void>;
  addProcedure:     (p: Partial<InterventionProcedure> & { procedure_type: string }) => Promise<void>;
  updateProcedure:  (id: number, patch: Partial<InterventionProcedure>) => Promise<void>;
  removeProcedure:  (id: number) => Promise<void>;
  setCounselling:   (notes: string) => void;
  saveCounselling:  () => Promise<void>;
  clear: () => void;
}

export const useInterventionStore = create<State>((set, get) => ({
  examinationId: null,
  procedures:    [],
  counselling:   '',
  loading:       false,
  saving:        false,
  error:         null,

  loadForExamination: async (id) => {
    set({ loading: true, error: null, examinationId: id, procedures: [], counselling: '' });
    try {
      const d = await interventionsApi.load(id);
      set({ procedures: d.procedures, counselling: d.counselling, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  addProcedure: async (p) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set({ saving: true });
    try {
      await interventionsApi.create(examinationId, p);
      const d = await interventionsApi.load(examinationId);
      set({ procedures: d.procedures, saving: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  updateProcedure: async (id, patch) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set({ saving: true });
    try {
      await interventionsApi.update(id, patch);
      const d = await interventionsApi.load(examinationId);
      set({ procedures: d.procedures, saving: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  removeProcedure: async (id) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set({ saving: true });
    try {
      await interventionsApi.remove(id);
      set((s) => ({ procedures: s.procedures.filter((p) => p.id !== id), saving: false }));
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  setCounselling: (notes) => set({ counselling: notes }),

  saveCounselling: async () => {
    const { examinationId, counselling } = get();
    if (!examinationId) return;
    set({ saving: true });
    try {
      await interventionsApi.saveCounselling(examinationId, counselling);
      set({ saving: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
    }
  },

  clear: () => set({ examinationId: null, procedures: [], counselling: '', error: null }),
}));
