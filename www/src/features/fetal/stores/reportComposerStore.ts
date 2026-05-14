/**
 * reportComposerStore — UI-only state for the Report tab.
 * Tracks which sections the user has toggled on/off, plus the free-text
 * "Report Content" and "Recommendations" rich-text bodies.
 *
 * Persisted to localStorage per examination so the toggles survive a
 * refresh.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReportSectionKey =
  | 'header'           // practice branding (always on)
  | 'patient'          // demographics
  | 'dating'           // LMP / GA / EDD
  | 'obstetric'        // pregnancy & obstetric history
  | 'maternal'         // maternal assessment
  | 'family'           // family history
  | 'biometry'         // fetal biometry table
  | 'structural'       // structural assessment summary
  | 'risk'             // risk assessment results
  | 'findings'         // findings / syndromes / genes / investigations
  | 'intervention'     // procedures + counselling notes
  | 'content'          // template-driven rich text
  | 'recommendations'  // recommendations rich text
  | 'charts';          // growth charts (selected per parameter)

interface State {
  examinationId: number | null;
  /** Per-section inclusion. Missing key = included by default. */
  sectionInclude: Record<ReportSectionKey, boolean>;
  /** Growth chart parameters the user has explicitly added to the report. */
  selectedChartParams: string[];
  /** Free-text bodies (rich text not yet — string for now). */
  contentBody: string;
  recommendationsBody: string;

  setExamination: (id: number | null) => void;
  toggleSection: (key: ReportSectionKey, on: boolean) => void;
  toggleChartParam: (param: string) => void;
  setContent: (s: string) => void;
  setRecommendations: (s: string) => void;
  reset: () => void;
}

const DEFAULT_SECTIONS: Record<ReportSectionKey, boolean> = {
  header: true, patient: true, dating: true, obstetric: true, maternal: true,
  family: true, biometry: true, structural: true, risk: true, findings: true,
  intervention: true, content: true, recommendations: true, charts: true,
};

export const useReportComposerStore = create<State>()(
  persist(
    (set, get) => ({
      examinationId: null,
      sectionInclude: { ...DEFAULT_SECTIONS },
      selectedChartParams: [],
      contentBody: '',
      recommendationsBody: '',

      setExamination: (id) => {
        if (get().examinationId === id) return;
        set({
          examinationId: id,
          sectionInclude: { ...DEFAULT_SECTIONS },
          selectedChartParams: [],
          contentBody: '',
          recommendationsBody: '',
        });
      },
      toggleSection: (key, on) =>
        set((s) => ({ sectionInclude: { ...s.sectionInclude, [key]: on } })),
      toggleChartParam: (param) =>
        set((s) => ({
          selectedChartParams: s.selectedChartParams.includes(param)
            ? s.selectedChartParams.filter((p) => p !== param)
            : [...s.selectedChartParams, param],
        })),
      setContent: (s) => set({ contentBody: s }),
      setRecommendations: (s) => set({ recommendationsBody: s }),
      reset: () => set({
        sectionInclude: { ...DEFAULT_SECTIONS },
        selectedChartParams: [],
        contentBody: '',
        recommendationsBody: '',
      }),
    }),
    {
      name: 'fetal-report-composer',
      // Persist per examination so switching exams clears the UI state.
      partialize: (s) => ({
        examinationId: s.examinationId,
        sectionInclude: s.sectionInclude,
        selectedChartParams: s.selectedChartParams,
        contentBody: s.contentBody,
        recommendationsBody: s.recommendationsBody,
      }),
    },
  ),
);
