import { create } from 'zustand';
import { examinationsApi } from '@/features/fetal/api/examinationsApi';
import type {
  CreateExaminationInput,
  Examination,
  UpdateExaminationInput,
} from '@/features/fetal/types';

interface ExaminationState {
  examinations: Examination[];
  currentExaminationId: number | null;
  loading: boolean;
  error: string | null;

  loadForPatient: (patientId: string) => Promise<void>;
  setCurrent: (id: number | null) => void;
  createForPatient: (input: CreateExaminationInput) => Promise<Examination>;
  patchCurrent: (patch: UpdateExaminationInput) => Promise<void>;
  removeExamination: (id: number) => Promise<void>;
  clear: () => void;
}

export const useExaminationStore = create<ExaminationState>((set, get) => ({
  examinations: [],
  currentExaminationId: null,
  loading: false,
  error: null,

  loadForPatient: async (patientId: string) => {
    set({ loading: true, error: null });
    try {
      const list = await examinationsApi.listForPatient(patientId);
      const currentId = get().currentExaminationId;
      const stillValid = currentId && list.some((e) => e.id === currentId);
      set({
        examinations: list,
        currentExaminationId: stillValid ? currentId : (list[0]?.id ?? null),
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  setCurrent: (id) => set({ currentExaminationId: id }),

  createForPatient: async (input) => {
    set({ error: null });
    const created = await examinationsApi.create(input);
    set((s) => ({
      examinations: [created, ...s.examinations],
      currentExaminationId: created.id,
    }));
    return created;
  },

  patchCurrent: async (patch) => {
    const id = get().currentExaminationId;
    if (!id) return;
    const updated = await examinationsApi.update(id, patch);
    set((s) => ({
      examinations: s.examinations.map((e) => (e.id === id ? updated : e)),
    }));
  },

  removeExamination: async (id) => {
    await examinationsApi.remove(id);
    set((s) => {
      const remaining = s.examinations.filter((e) => e.id !== id);
      return {
        examinations: remaining,
        currentExaminationId:
          s.currentExaminationId === id ? (remaining[0]?.id ?? null) : s.currentExaminationId,
      };
    });
  },

  clear: () => set({ examinations: [], currentExaminationId: null, error: null }),
}));

/** Convenience selector: the current examination object (or null). */
export const useCurrentExamination = (): Examination | null => {
  const id = useExaminationStore((s) => s.currentExaminationId);
  const list = useExaminationStore((s) => s.examinations);
  return id ? list.find((e) => e.id === id) ?? null : null;
};
