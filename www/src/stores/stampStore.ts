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
  category?: string;
  createdAt: number;
}

const STORAGE_KEY = 'dicom-viewer-stamps';

// Built-in stamps shipped with the app. Keep this list minimal — radiologists
// requested L/R marker stamps for laterality only. Everything else is user-created.
const DEFAULT_STAMPS: StampDefinition[] = [
  { id: 'default-l', name: 'L', text: 'L', color: '#ffff00', fontSize: 28, category: 'Marker', createdAt: 0 },
  { id: 'default-r', name: 'R', text: 'R', color: '#ffff00', fontSize: 28, category: 'Marker', createdAt: 0 },
];

// IDs of stamps previously shipped that should be pruned on next load.
const LEGACY_DEFAULT_IDS = new Set([
  'default-verified', 'default-approved', 'default-reviewed',
  'default-reject', 'default-pending', 'default-urgent',
]);

function loadStamps(): StampDefinition[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as StampDefinition[];
      const pruned = parsed.filter(s => !LEGACY_DEFAULT_IDS.has(s.id));
      // Ensure L/R defaults exist (so users always have at least a laterality marker).
      const ids = new Set(pruned.map(s => s.id));
      const merged = [
        ...DEFAULT_STAMPS.filter(d => !ids.has(d.id)),
        ...pruned,
      ];
      if (merged.length !== parsed.length) persistStamps(merged);
      return merged.length > 0 ? merged : DEFAULT_STAMPS;
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
  getCategories: () => string[];
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

  getCategories: () => {
    const set = new Set<string>();
    for (const s of get().stamps) {
      const c = (s.category || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  },

  getSelectedStamp: () => {
    const { stamps, selectedStampId } = get();
    return stamps.find(s => s.id === selectedStampId) || null;
  },
}));
