/**
 * Lightweight global state for the report-router picker modal.
 * Used so the picker can render anywhere (e.g. mounted once in PatientListPage)
 * but be opened from anywhere (context menu, action bar, viewer toolbar).
 */
import { create } from 'zustand';
import type { Patient } from '@/types/patient';
import type { ScoredDetection } from './detector';

export type RouterMode = 'create' | 'open';
/** Two-step picker:
 *    'type'     — pick Fetal / General Radiology / …
 *    'template' — pick a saved template (or "Blank report") within the chosen type
 *  'open' mode jumps straight to the type picker and never enters template step. */
export type RouterStep = 'type' | 'template';

interface RouterState {
  open: boolean;
  mode: RouterMode;
  step: RouterStep;
  selectedTypeId: string | null;
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
  goToTemplateStep: (typeId: string) => void;
  backToTypeStep: () => void;
  close: () => void;
}

export const useReportRouterStore = create<RouterState>((set) => ({
  open: false,
  mode: 'create',
  step: 'type',
  selectedTypeId: null,
  patient: null,
  candidates: [],
  preselectedId: undefined,
  existingCounts: {},

  show: ({ mode, patient, candidates, preselectedId, existingCounts }) =>
    set({
      open: true,
      mode,
      step: 'type',
      selectedTypeId: null,
      patient,
      candidates,
      preselectedId,
      existingCounts: existingCounts ?? {},
    }),

  goToTemplateStep: (typeId) => set({ step: 'template', selectedTypeId: typeId }),
  backToTypeStep:   ()       => set({ step: 'type',     selectedTypeId: null }),

  close: () => set({ open: false, step: 'type', selectedTypeId: null, patient: null, candidates: [], preselectedId: undefined }),
}));
