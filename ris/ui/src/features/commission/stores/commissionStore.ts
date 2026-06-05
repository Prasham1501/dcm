import { create } from 'zustand';
import {
  apiCommissionReport, apiCommissionStatement, apiCreatePayout, apiPayPayout,
  apiGetCommissionEnabled, apiSetCommissionEnabled,
  type CommissionReportRow, type Statement, type Payout,
} from '../api/commissionApi';

interface CommissionState {
  report: CommissionReportRow[];
  statement: Statement | null;
  payouts: Payout[];
  enabled: boolean;
  loading: boolean;
  error: string | null;
  loadReport: (from?: string, to?: string) => Promise<void>;
  loadStatement: (doctorId: number, period?: string) => Promise<void>;
  createPayout: (doctorId: number, from: string, to: string) => Promise<Payout | null>;
  payPayout: (payoutId: number) => Promise<boolean>;
  loadEnabled: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export const useCommissionStore = create<CommissionState>()((set) => ({
  report: [],
  statement: null,
  payouts: [],
  enabled: true,
  loading: false,
  error: null,

  loadReport: async (from, to) => {
    set({ loading: true, error: null });
    try {
      const { rows } = await apiCommissionReport(from, to);
      set({ report: rows, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to load commission report' });
    }
  },

  loadStatement: async (doctorId, period) => {
    try {
      const statement = await apiCommissionStatement(doctorId, period);
      set({ statement });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load statement' });
    }
  },

  createPayout: async (doctorId, from, to) => {
    try {
      return await apiCreatePayout(doctorId, from, to);
    } catch (e: any) {
      set({ error: e?.message || 'Failed to create payout' });
      return null;
    }
  },

  payPayout: async (payoutId) => {
    try {
      await apiPayPayout(payoutId);
      return true;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to mark payout paid' });
      return false;
    }
  },

  loadEnabled: async () => {
    try { set({ enabled: await apiGetCommissionEnabled() }); } catch { /* keep current */ }
  },

  setEnabled: async (enabled) => {
    try { set({ enabled: await apiSetCommissionEnabled(enabled) }); }
    catch (e: any) { set({ error: e?.message || 'Failed to update setting' }); }
  },
}));
