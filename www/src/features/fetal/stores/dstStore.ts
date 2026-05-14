/**
 * dstStore — per-examination selections of findings, syndromes, genes,
 * investigations. Drives the "Abnormal Structural Assessment" tab and is
 * also read by the Report Composer.
 *
 * Every mutating action calls the server immediately (no batch save) so
 * the data is always in sync. UI shows transient "saving" states via
 * `pendingOps`.
 */
import { create } from 'zustand';
import {
  dstApi, type DstBundle, type DstKind,
  type ExamFinding, type ExamSyndrome, type ExamGene, type ExamInvestigation,
} from '@/features/fetal/api/dstApi';
import { catalogsApi, type MatchedSyndrome } from '@/features/fetal/api/catalogsApi';

interface DstState {
  examinationId: number | null;
  findings:       ExamFinding[];
  syndromes:      ExamSyndrome[];
  genes:          ExamGene[];
  investigations: ExamInvestigation[];

  // Live match-scoring results (recomputed when findings change)
  matches: MatchedSyndrome[];
  matchLoading: boolean;

  loading: boolean;
  error: string | null;
  pendingOps: number;

  loadForExamination: (id: number) => Promise<void>;
  refreshMatches: () => Promise<void>;
  addFinding:        (id: number) => Promise<void>;
  addSyndrome:       (id: number, opts?: { num?: number; den?: number }) => Promise<void>;
  addGene:           (id: number) => Promise<void>;
  addInvestigation:  (id: number, category: 'basic' | 'specific') => Promise<void>;
  toggleInclude:     (kind: DstKind, id: number, include: boolean) => Promise<void>;
  removeItem:        (kind: DstKind, id: number) => Promise<void>;
  clear: () => void;
}

const empty: DstBundle = { findings: [], syndromes: [], genes: [], investigations: [] };

export const useDstStore = create<DstState>((set, get) => ({
  examinationId: null,
  ...empty,
  matches: [],
  matchLoading: false,
  loading: false,
  error: null,
  pendingOps: 0,

  loadForExamination: async (id) => {
    set({ loading: true, error: null, examinationId: id, ...empty, matches: [] });
    try {
      const data = await dstApi.load(id);
      set({ ...data, loading: false });
      void get().refreshMatches();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  refreshMatches: async () => {
    const findingIds = get().findings.map((f) => f.id);
    if (findingIds.length === 0) {
      set({ matches: [], matchLoading: false });
      return;
    }
    set({ matchLoading: true });
    try {
      const matches = await catalogsApi.matchSyndromes(findingIds);
      set({ matches, matchLoading: false });
    } catch (e) {
      console.warn('[dstStore] match scoring failed:', e);
      set({ matchLoading: false });
    }
  },

  addFinding: async (id) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.add(examinationId, 'finding', id);
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
      void get().refreshMatches();
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  addSyndrome: async (id, opts) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.add(examinationId, 'syndrome', id, {
        match_score_num: opts?.num,
        match_score_den: opts?.den,
      });
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  addGene: async (id) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.add(examinationId, 'gene', id);
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  addInvestigation: async (id, category) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.add(examinationId, 'investigation', id, { category, include_in_report: 1 });
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  toggleInclude: async (kind, id, include) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.toggleInclude(examinationId, kind, id, include);
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  removeItem: async (kind, id) => {
    const { examinationId } = get();
    if (!examinationId) return;
    set((s) => ({ pendingOps: s.pendingOps + 1, error: null }));
    try {
      await dstApi.remove(examinationId, kind, id);
      const data = await dstApi.load(examinationId);
      set((s) => ({ ...data, pendingOps: s.pendingOps - 1 }));
      if (kind === 'finding') void get().refreshMatches();
    } catch (e) {
      set((s) => ({ pendingOps: s.pendingOps - 1, error: (e as Error).message }));
      throw e;
    }
  },

  clear: () => set({
    examinationId: null, findings: [], syndromes: [], genes: [], investigations: [],
    matches: [], error: null,
  }),
}));
