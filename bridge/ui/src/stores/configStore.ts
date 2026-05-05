import { create } from 'zustand';
import type { BridgeConfig, PrinterSlot, SlotStatus, SystemPrinter, HospitalBranding } from '@/types/bridge';

interface ConfigState {
  config: BridgeConfig | null;
  slotStatus: SlotStatus[];
  systemPrinters: SystemPrinter[];
  loading: boolean;

  load: () => Promise<void>;
  refreshSlotStatus: () => Promise<void>;
  loadSystemPrinters: () => Promise<void>;
  newSlot: () => Promise<PrinterSlot>;
  upsertSlot: (slot: PrinterSlot) => Promise<{ ok: boolean; errors?: string[] }>;
  removeSlot: (slotId: string) => Promise<void>;
  saveBranding: (branding: Partial<HospitalBranding>) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  slotStatus: [],
  systemPrinters: [],
  loading: false,

  async load() {
    set({ loading: true });
    try {
      const config = await window.bridgeAPI.getConfig();
      const slotStatus = await window.bridgeAPI.getSlotStatus();
      set({ config, slotStatus, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async refreshSlotStatus() {
    try {
      const slotStatus = await window.bridgeAPI.getSlotStatus();
      set({ slotStatus });
    } catch { /* ignore */ }
  },

  async loadSystemPrinters() {
    try {
      const r = await window.bridgeAPI.getSystemPrinters();
      if (r.success) set({ systemPrinters: r.printers });
    } catch { /* ignore */ }
  },

  async newSlot() {
    return await window.bridgeAPI.newSlot();
  },

  async upsertSlot(slot) {
    const result = await window.bridgeAPI.upsertSlot(slot);
    if (result.ok && result.config) {
      set({ config: result.config });
      await get().refreshSlotStatus();
    }
    return { ok: result.ok, errors: result.errors };
  },

  async removeSlot(slotId) {
    const result = await window.bridgeAPI.removeSlot(slotId);
    if (result.ok && result.config) {
      set({ config: result.config });
      await get().refreshSlotStatus();
    }
  },

  async saveBranding(branding) {
    const saved = await window.bridgeAPI.saveBranding(branding);
    const config = get().config;
    if (config) {
      set({ config: { ...config, branding: saved } });
    }
  },
}));
