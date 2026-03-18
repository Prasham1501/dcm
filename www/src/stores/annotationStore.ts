/**
 * annotationStore - Persists cornerstone-tools annotations per study.
 * Keyed by studyUID (or a hash of filePaths when no studyUID is available).
 * Uses Zustand persist to survive page reloads.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnnotationData {
  /** Serialized cornerstone-tools globalImageIdSpecificToolState */
  toolState: Record<string, any>;
  savedAt: string;
}

interface AnnotationState {
  /** annotations[studyKey] = AnnotationData */
  annotations: Record<string, AnnotationData>;

  /** Save annotations for a study */
  saveAnnotations: (studyKey: string, toolState: Record<string, any>) => void;

  /** Get annotations for a study */
  getAnnotations: (studyKey: string) => AnnotationData | null;

  /** Delete annotations for a study */
  deleteAnnotations: (studyKey: string) => void;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      annotations: {},

      saveAnnotations: (studyKey, toolState) => {
        set((state) => ({
          annotations: {
            ...state.annotations,
            [studyKey]: {
              toolState,
              savedAt: new Date().toISOString(),
            },
          },
        }));
      },

      getAnnotations: (studyKey) => {
        return get().annotations[studyKey] ?? null;
      },

      deleteAnnotations: (studyKey) => {
        set((state) => {
          const next = { ...state.annotations };
          delete next[studyKey];
          return { annotations: next };
        });
      },
    }),
    {
      name: 'dicom-annotations',
    }
  )
);

/**
 * Derive a stable study key from studyUID or filePaths.
 * Used as the key in annotationStore.
 */
export function getStudyKey(studyUID: string, filePaths?: string[]): string {
  if (studyUID) return studyUID;
  if (filePaths && filePaths.length > 0) {
    // Simple hash of sorted paths
    const sorted = [...filePaths].sort().join('|');
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
      hash = (hash * 31 + sorted.charCodeAt(i)) >>> 0;
    }
    return `local-${hash}`;
  }
  return 'default';
}
