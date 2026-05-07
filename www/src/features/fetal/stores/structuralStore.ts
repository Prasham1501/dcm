import { create } from 'zustand';
import { structuralApi, type StructuralRow } from '@/features/fetal/api/structuralApi';
import type { StructuralStatus } from '@/features/fetal/lib/anatomySchema';

type Key = `${string}::${string}`;
const k = (system: string, anatomyKey: string): Key => `${system}::${anatomyKey}`;

interface StructuralState {
  examinationId: number | null;
  rows: Record<Key, StructuralRow>;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;

  loadForExamination: (id: number) => Promise<void>;
  setStatus: (system: string, anatomyKey: string, status: StructuralStatus) => void;
  setComments: (system: string, anatomyKey: string, comments: string) => void;
  markAllNormal: (system: string, anatomyKeys: string[]) => void;
  markAllSelect:  (system: string, anatomyKeys: string[]) => void;
  save: () => Promise<void>;
  clear: () => void;
}

const emptyRow = (system: string, anatomyKey: string): StructuralRow => ({
  system, anatomyKey, status: 'select', comments: null,
});

export const useStructuralStore = create<StructuralState>((set, get) => ({
  examinationId: null,
  rows: {},
  loading: false,
  saving: false,
  dirty: false,
  error: null,

  loadForExamination: async (id) => {
    set({ loading: true, error: null, examinationId: id, rows: {}, dirty: false });
    try {
      const list = await structuralApi.load(id);
      const rows: Record<Key, StructuralRow> = {};
      for (const r of list) rows[k(r.system, r.anatomyKey)] = r;
      set({ rows, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  setStatus: (system, anatomyKey, status) => {
    const key = k(system, anatomyKey);
    set((s) => ({
      rows: { ...s.rows, [key]: { ...(s.rows[key] ?? emptyRow(system, anatomyKey)), status } },
      dirty: true,
    }));
  },

  setComments: (system, anatomyKey, comments) => {
    const key = k(system, anatomyKey);
    set((s) => ({
      rows: { ...s.rows, [key]: { ...(s.rows[key] ?? emptyRow(system, anatomyKey)), comments: comments || null } },
      dirty: true,
    }));
  },

  markAllNormal: (system, anatomyKeys) => {
    set((s) => {
      const rows = { ...s.rows };
      for (const key of anatomyKeys) {
        const k2 = k(system, key);
        rows[k2] = { ...(rows[k2] ?? emptyRow(system, key)), status: 'normal' };
      }
      return { rows, dirty: true };
    });
  },

  markAllSelect: (system, anatomyKeys) => {
    set((s) => {
      const rows = { ...s.rows };
      for (const key of anatomyKeys) {
        const k2 = k(system, key);
        rows[k2] = { ...(rows[k2] ?? emptyRow(system, key)), status: 'select' };
      }
      return { rows, dirty: true };
    });
  },

  save: async () => {
    const { examinationId, rows } = get();
    if (!examinationId) return;
    set({ saving: true, error: null });
    try {
      await structuralApi.save(examinationId, Object.values(rows));
      set({ saving: false, dirty: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  clear: () => set({ examinationId: null, rows: {}, dirty: false, error: null }),
}));

/** Helper: get the row for a specific anatomy item, or a default. */
export function getRow(
  rows: Record<string, StructuralRow>,
  system: string,
  anatomyKey: string,
): StructuralRow {
  return rows[`${system}::${anatomyKey}`] ?? {
    system, anatomyKey, status: 'select', comments: null,
  };
}
