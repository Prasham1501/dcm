import { create } from 'zustand';

interface LicenseStatus {
  type: 'licensed' | 'trial';
  licenseKey?: string;
  plan?: string;
  expiresAt?: string;
  lastValidated?: string;
  activatedAt?: string;
  deviceId?: string;
  fingerprint?: string;
  machineName?: string;
  daysLeft?: number | null;
  expired?: boolean;
  remaining?: number;
  totalDays?: number;
}

interface LicenseState {
  status: LicenseStatus | null;
  loading: boolean;
  error: string | null;
  activating: boolean;

  fetchStatus: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
  deactivateLicense: () => Promise<void>;
}

const api = (window as any).electronAPI;

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  loading: true,
  error: null,
  activating: false,

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      if (api?.getLicenseStatus) {
        const status = await api.getLicenseStatus();
        set({ status, loading: false });
      } else {
        // Non-electron environment — assume licensed
        set({ status: { type: 'licensed', plan: 'dev' }, loading: false });
      }
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  refreshStatus: async () => {
    try {
      if (api?.getLicenseStatus) {
        const status = await api.getLicenseStatus();
        set({ status, error: null });
      } else {
        set({ status: { type: 'licensed', plan: 'dev' }, error: null });
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  activateLicense: async (key: string) => {
    set({ activating: true, error: null });
    try {
      if (api?.activateLicense) {
        const result = await api.activateLicense(key);
        if (result.success) {
          const status = await api.getLicenseStatus();
          set({ status, activating: false });
          return { success: true };
        }
        set({ error: result.error, activating: false });
        return { success: false, error: result.error };
      }
      return { success: false, error: 'Not running in Electron' };
    } catch (e: any) {
      set({ error: e.message, activating: false });
      return { success: false, error: e.message };
    }
  },

  deactivateLicense: async () => {
    try {
      if (api?.deactivateLicense) {
        await api.deactivateLicense();
        const status = await api.getLicenseStatus();
        set({ status });
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },
}));
