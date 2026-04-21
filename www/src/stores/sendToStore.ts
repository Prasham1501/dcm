import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SendDestination {
  id: string;
  name: string;
  host: string;
  port: number;
  aeTitle: string;
  protocol: 'dicom' | 'http';
}

interface SendToState {
  destinations: SendDestination[];
  addDestination: (dest: Omit<SendDestination, 'id'>) => void;
  removeDestination: (id: string) => void;
  updateDestination: (id: string, updates: Partial<SendDestination>) => void;
}

export const useSendToStore = create<SendToState>()(
  persist(
    (set) => ({
      destinations: [],

      addDestination: (dest) =>
        set((state) => ({
          destinations: [
            ...state.destinations,
            { ...dest, id: `dest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
          ],
        })),

      removeDestination: (id) =>
        set((state) => ({
          destinations: state.destinations.filter((d) => d.id !== id),
        })),

      updateDestination: (id, updates) =>
        set((state) => ({
          destinations: state.destinations.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),
    }),
    { name: 'dicom-send-destinations' }
  )
);
