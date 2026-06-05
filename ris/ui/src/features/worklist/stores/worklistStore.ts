import { create } from 'zustand';
import {
  apiDoctorList, apiCollectionList, apiTransition, apiRunMatch,
  type MatchResult,
  type WorklistOrder,
} from '../api/worklistApi';

interface WorklistState {
  orders: WorklistOrder[];
  collection: WorklistOrder[];
  loading: boolean;
  error: string | null;
  lastMatch: MatchResult | null;
  load: (status?: string, modality?: string, silent?: boolean) => Promise<void>;
  loadCollection: () => Promise<void>;
  claim: (orderId: number) => Promise<boolean>;
  report: (orderId: number, reportId?: number) => Promise<boolean>;
  deliver: (orderId: number) => Promise<boolean>;
  runMatch: (silent?: boolean) => Promise<MatchResult | null>;
}

export const useWorklistStore = create<WorklistState>()((set) => ({
  orders: [],
  collection: [],
  loading: false,
  error: null,
  lastMatch: null,

  load: async (status, modality, silent = false) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const orders = await apiDoctorList(status, modality);
      set({ orders, loading: false });
    } catch (e: any) {
      set({ loading: false, ...(silent ? {} : { error: e?.message || 'Failed to load worklist' }) });
    }
  },

  loadCollection: async () => {
    try {
      const collection = await apiCollectionList();
      set({ collection });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load collection list' });
    }
  },

  claim: async (orderId) => transition(set, orderId, 'claim'),
  report: async (orderId, reportId) => transition(set, orderId, 'report', reportId),
  deliver: async (orderId) => transition(set, orderId, 'deliver'),

  runMatch: async (silent = false) => {
    try {
      const result = await apiRunMatch();
      set({ lastMatch: result });
      return result;
    } catch (e: any) {
      if (!silent) set({ error: e?.message || 'Match failed' });
      return null;
    }
  },
}));

async function transition(
  set: (partial: Partial<WorklistState>) => void,
  orderId: number,
  action: 'claim' | 'report' | 'deliver',
  reportId?: number,
): Promise<boolean> {
  set({ error: null });
  try {
    await apiTransition(orderId, action, reportId);
    return true;
  } catch (e: any) {
    set({ error: e?.message || `${action} failed` });
    return false;
  }
}
