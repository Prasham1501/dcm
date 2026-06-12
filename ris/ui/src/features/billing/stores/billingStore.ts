import { create } from 'zustand';
import {
  apiTakePayment, apiGenerateReceipt, apiGetDaybook,
  type VisitBalance, type Receipt, type DayBook,
} from '../api/billingApi';

interface BillingState {
  daybook: DayBook | null;
  lastReceipt: Receipt | null;
  loading: boolean;
  error: string | null;
  takePayment: (
    visitId: number,
    amount: number,
    mode: string,
    reference?: string,
    isRefund?: boolean,
    details?: { payer_name?: string; payer_relation?: string; payer_mobile?: string; notes?: string },
  ) => Promise<VisitBalance | null>;
  generateReceipt: (visitId: number) => Promise<Receipt | null>;
  loadDaybook: (from?: string, to?: string) => Promise<void>;
}

export const useBillingStore = create<BillingState>()((set, get) => ({
  daybook: null,
  lastReceipt: null,
  loading: false,
  error: null,

  takePayment: async (visitId, amount, mode, reference, isRefund, details) => {
    set({ loading: true, error: null });
    try {
      const { visit } = await apiTakePayment({ visit_id: visitId, amount, mode, reference, is_refund: isRefund, ...details });
      set({ loading: false });
      return visit;
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Payment failed' });
      return null;
    }
  },

  generateReceipt: async (visitId) => {
    try {
      const receipt = await apiGenerateReceipt(visitId);
      set({ lastReceipt: receipt });
      return receipt;
    } catch (e: any) {
      set({ error: e?.message || 'Receipt failed' });
      return null;
    }
  },

  loadDaybook: async (from, to) => {
    const current = get().daybook;
    const sameRange = current && current.from === from && current.to === to;
    set({ loading: sameRange ? false : true, error: null });
    try {
      const daybook = await apiGetDaybook(from, to);
      set({ daybook, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to load day book' });
    }
  },
}));
