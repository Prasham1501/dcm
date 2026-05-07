/**
 * Lightweight global state for the report-router picker modal.
 * Used so the picker can render anywhere (e.g. mounted once in PatientListPage)
 * but be opened from anywhere (context menu, action bar, viewer toolbar).
 */
import { create } from 'zustand';
import type { Patient } from '@/types/patient';
import type { ScoredDetection } from './detector';

export type RouterMode = 'create' | 'open';

interface RouterState {
  open: boolean;
  mode: RouterMode;
  patient: Patient | null;
  candidates: ScoredDetection[];
  preselectedId?: string;
  existingCounts: Record<string, number>;

  show: (input: {
    mode: RouterMode;
    patient: Patient;
    candidates: ScoredDetection[];
    preselectedId?: string;
    existingCounts?: Record<string, number>;
  }) => void;
  close: () => void;
}

export const useReportRouterStore = create<RouterState>((set) => ({
  open: false,
  mode: 'create',
  patient: null,
  candidates: [],
  preselectedId: undefined,
  existingCounts: {},

  show: ({ mode, patient, candidates, preselectedId, existingCounts }) =>
    set({
      open: true,
      mode,
      patient,
      candidates,
      preselectedId,
      existingCounts: existingCounts ?? {},
    }),

  close: () => set({ open: false, patient: null, candidates: [], preselectedId: undefined }),
}));
