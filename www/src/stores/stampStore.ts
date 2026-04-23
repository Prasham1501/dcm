/**
 * stampStore — Shared stamp definitions used by both the main Viewer and CR Viewer.
 * Stamps are persisted to localStorage so they survive across sessions.
 * This store only manages stamp *definitions* (presets), not placements.
 * Placements are managed by customAnnotationStore (main viewer) and crViewerStore (CR viewer).
 */
import { create } from 'zustand';

export interface StampDefinition {
  id: string;
  name: string;
  text: string;
  color: string;
  fontSize: number;
  createdAt: number;
}

const STORAGE_KEY = 'dicom-viewer-stamps';

// Default stamps that ship with the app
const DEFAULT_STAMPS: StampDefinition[] = [
  { id: 'default-verified', name: 'Verified', text: 'VERIFIED', color: '#00ff00', fontSize: 16, createdAt: 0 },
  { id: 'default-approved', name: 'Approved', text: 'APPROVED', color: '#00ff00', fontSize: 16, createdAt: 0 },
  { id: 'default-reviewed', name: 'Reviewed', text: 'REVIEWED', color: '#ffff00', fontSize: 16, createdAt: 0 },
  { id: 'default-reject', name: 'Reject', text: 'REJECT', color: '#ff0000', fontSize: 16, createdAt: 0 },
  { id: 'default-pending', name: 'Pending', text: 'PENDING', color: '#ff6600', fontSize: 16, createdAt: 0 },
  { id: 'default-urgent', name: 'Urgent', text: 'URGENT', color: '#ff0000', fontSize: 18, createdAt: 0 },
];

function loadStamps(): StampDefinition[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as StampDefinition[];
      return parsed.length > 0 ? parsed : DEFAULT_STAMPS;
    }
    return DEFAULT_STAMPS;
  } catch {
    return DEFAULT_STAMPS;
  }
}

function persistStamps(stamps: StampDefinition[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamps));
  } catch { /* ignore */ }
}

interface StampStoreState {
  stamps: StampDefinition[];
  selectedStampId: string | null;

  addStamp: (stamp: Omit<StampDefinition, 'id' | 'createdAt'>) => void;
  removeStamp: (id: string) => void;
  updateStamp: (id: string, updates: Partial<Omit<StampDefinition, 'id' | 'createdAt'>>) => void;
  selectStamp: (id: string | null) => void;
  getSelectedStamp: () => StampDefinition | null;
}

export const useStampStore = create<StampStoreState>((set, get) => ({
  stamps: loadStamps(),
  selectedStampId: null,

  addStamp: (stamp) => {
    const newStamp: StampDefinition = {
      ...stamp,
      id: `stamp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const stamps = [...get().stamps, newStamp];
    set({ stamps });
    persistStamps(stamps);
  },

  removeStamp: (id) => {
    const stamps = get().stamps.filter(s => s.id !== id);
    const selectedStampId = get().selectedStampId === id ? null : get().selectedStampId;
    set({ stamps, selectedStampId });
    persistStamps(stamps);
  },

  updateStamp: (id, updates) => {
    const stamps = get().stamps.map(s => s.id === id ? { ...s, ...updates } : s);
    set({ stamps });
    persistStamps(stamps);
  },

  selectStamp: (id) => set({ selectedStampId: id }),

  getSelectedStamp: () => {
    const { stamps, selectedStampId } = get();
    return stamps.find(s => s.id === selectedStampId) || null;
  },
}));
