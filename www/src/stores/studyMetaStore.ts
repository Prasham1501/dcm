import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StudyMetaStore {
  doctors: Record<string, string>;
  remarks: Record<string, string>;
  setDoctor: (studyId: string, doctor: string) => void;
  setRemarks: (studyId: string, remarks: string) => void;
}

export const useStudyMetaStore = create<StudyMetaStore>()(
  persist(
    (set) => ({
      doctors: {},
      remarks: {},

      setDoctor: (studyId: string, doctor: string) => {
        set((s) => ({
          doctors: { ...s.doctors, [studyId]: doctor },
        }));
      },

      setRemarks: (studyId: string, remarks: string) => {
        set((s) => ({
          remarks: { ...s.remarks, [studyId]: remarks },
        }));
      },
    }),
    {
      name: 'study-meta',
      partialize: (state) => ({
        doctors: state.doctors,
        remarks: state.remarks,
      }),
    }
  )
);
