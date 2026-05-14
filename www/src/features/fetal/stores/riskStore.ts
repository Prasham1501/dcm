import { create } from 'zustand';
import { riskApi, type CalculatorId, type RiskResultRow } from '@/features/fetal/api/riskApi';

interface RiskState {
  examinationId: number | null;
  rows: Record<CalculatorId, RiskResultRow | null>;
  loading: boolean;
  saving: boolean;
  error: string | null;

  loadForExamination: (id: number) => Promise<void>;
  save: <I, R>(calc: CalculatorId, inputs: I, results: R, include?: boolean) => Promise<void>;
  toggleInclude: (calc: CalculatorId, include: boolean) => Promise<void>;
  remove: (calc: CalculatorId) => Promise<void>;
  clear: () => void;
}

const emptyRows: RiskState['rows'] = { aneuploidy: null, preeclampsia: null, preterm: null };

export const useRiskStore = create<RiskState>((set, get) => ({
  examinationId: null,
  rows: { ...emptyRows },
  loading: false,
  saving: false,
  error: null,

  loadForExamination: async (id) => {
    set({ loading: true, error: null, examinationId: id, rows: { ...emptyRows } });
    try {
      const rows = await riskApi.loadAll(id);
      const map = { ...emptyRows };
      for (const r of rows) map[r.calculator] = r;
      set({ rows: map, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  save: async (calc, inputs, results, include = true) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set({ saving: true, error: null });
    try {
      await riskApi.save(examinationId, calc, inputs, results, include);
      const rows = await riskApi.loadAll(examinationId);
      const map = { ...emptyRows };
      for (const r of rows) map[r.calculator] = r;
      set({ rows: map, saving: false });
    } catch (e) {
      set({ saving: false, error: (e as Error).message });
      throw e;
    }
  },

  toggleInclude: async (calc, include) => {
    const { examinationId, rows } = get();
    if (!examinationId) return;
    const row = rows[calc];
    if (!row) return;
    await riskApi.save(examinationId, calc, row.inputs ?? {}, row.results ?? {}, include);
    set((s) => ({
      rows: { ...s.rows, [calc]: { ...row, include_in_report: include ? 1 : 0 } },
    }));
  },

  remove: async (calc) => {
    const { examinationId } = get();
    if (!examinationId) return;
    await riskApi.remove(examinationId, calc);
    set((s) => ({ rows: { ...s.rows, [calc]: null } }));
  },

  clear: () => set({ examinationId: null, rows: { ...emptyRows }, error: null }),
}));
