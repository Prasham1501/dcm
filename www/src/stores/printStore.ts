import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { printService } from '@/services/printService';

const USE_API = import.meta.env.VITE_USE_API === 'true';

interface PrintJob {
  id: string;
  patientName: string;
  studyDate: string;
  layout: string;
  copies: number;
  paperSize: string;
  timestamp: string;
  status: 'queued' | 'printing' | 'completed' | 'failed';
}

interface PrintSettings {
  defaultPrinter: string;
  paperSize: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  quality: 'draft' | 'normal' | 'high';
  copies: number;
  borderEnabled: boolean;
  headerEnabled: boolean;
  footerEnabled: boolean;
  logoEnabled: boolean;
  patientInfoEnabled: boolean;
}

interface PrintStore {
  // Print counter
  printCountTotal: number;
  printCountUsed: number;
  printCountRemaining: number;
  /** True when the active license has sell-by-print mode enabled (or no
   *  license is activated and we're on the local install trial). When
   *  false, prints are unlimited and the count UI should be hidden — the
   *  number in `printCountRemaining` is meaningless in that state. */
  quotaEnabled: boolean;

  // Print settings
  settings: PrintSettings;

  // Print jobs history
  printJobs: PrintJob[];

  // Modals
  showPrinterModal: boolean;
  showPrintPreview: boolean;

  // Actions
  setShowPrinterModal: (show: boolean) => void;
  setShowPrintPreview: (show: boolean) => void;
  updateSettings: (updates: Partial<PrintSettings>) => void;
  addPrintJob: (job: Omit<PrintJob, 'id' | 'timestamp' | 'status'>) => void;
  decrementPrintCount: () => void;
  fetchPrintCount: () => Promise<void>;
  logPrintToApi: (data: {
    studyUid?: string;
    patientId?: string;
    patientName?: string;
    layoutType?: string;
    /** Number of credits to debit (default 1). One per page × copy. */
    credits?: number;
  }) => Promise<{ ok: boolean; balance: number; reason?: string }>;
}

// Bridge to the Electron main process — talks to mehrgrewal.com wallet.
// Lazily resolved so the store works in plain browser previews too.
const walletBridge = () => (typeof window !== 'undefined' ? (window as any).electronAPI : null);

export const usePrintStore = create<PrintStore>()(
  persist(
    (set, get) => ({
      // Counts default to 0 until the first wallet sync resolves — never
      // ship a hard-coded 500 again, that's what caused the desktop "481"
      // vs dashboard "200" mismatch.
      printCountTotal: 0,
      printCountUsed: 0,
      printCountRemaining: 0,
      quotaEnabled: false,

      settings: {
        defaultPrinter: 'HP LaserJet Pro M404dn',
        paperSize: 'A4',
        orientation: 'portrait',
        quality: 'high',
        copies: 1,
        borderEnabled: true,
        headerEnabled: true,
        footerEnabled: true,
        logoEnabled: true,
        patientInfoEnabled: true,
      },

      printJobs: [
        {
          id: 'PJ-001',
          patientName: 'ALSAMIN MOMEEN',
          studyDate: '23-03-2022',
          layout: '5 Spots (2T+3B)',
          copies: 1,
          paperSize: 'A4',
          timestamp: '2026-03-15 10:30:00',
          status: 'completed',
        },
        {
          id: 'PJ-002',
          patientName: 'MRS. PRIYA SHARMA',
          studyDate: '10-03-2026',
          layout: '4 Spots (2x2)',
          copies: 2,
          paperSize: 'A4',
          timestamp: '2026-03-15 11:15:00',
          status: 'completed',
        },
        {
          id: 'PJ-003',
          patientName: 'MR. VIJAY NAIR',
          studyDate: '15-03-2026',
          layout: '6 Spots (2x3)',
          copies: 1,
          paperSize: 'A4',
          timestamp: '2026-03-16 09:00:00',
          status: 'queued',
        },
      ],

      showPrinterModal: false,
      showPrintPreview: false,

      setShowPrinterModal: (show) => set({ showPrinterModal: show }),
      setShowPrintPreview: (show) => set({ showPrintPreview: show }),

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      addPrintJob: (job) =>
        set((state) => ({
          printJobs: [
            {
              ...job,
              id: `PJ-${Date.now()}`,
              timestamp: new Date().toISOString(),
              status: 'queued',
            },
            ...state.printJobs,
          ],
        })),

      decrementPrintCount: () =>
        set((state) => ({
          printCountUsed: state.printCountUsed + 1,
          printCountRemaining: Math.max(0, state.printCountRemaining - 1),
        })),

      /**
       * Pull the live print balance from the website wallet (the same
       * number the user sees on mehrgrewal.com/dashboard). When the
       * Electron bridge isn't available (browser preview) we fall back
       * to the optional legacy printService for backwards-compat.
       */
      fetchPrintCount: async () => {
        const api = walletBridge();
        if (api) {
          // Prefer the central license-quota counter (the sell-by-print
          // model used by bridge + viewer headers and the website's
          // /license/quota endpoint). Trial keys are auto-seeded with 100
          // prints, so this surfaces them immediately. Fall back to the
          // legacy wallet balance only when no license has quota mode on.
          try {
            const q = api.getLicenseQuota ? await api.getLicenseQuota() : null;
            if (q) {
              // Reflect quota-enabled state so the UI can hide the count
              // entirely when the operator has turned sell-by-print off.
              const remaining = q.remaining | 0;
              set((state) => ({
                quotaEnabled: !!q.enabled,
                printCountRemaining: remaining,
                printCountTotal: state.printCountUsed + remaining,
              }));
              if (q.enabled) return;
              // quota mode is off — let the wallet branch run as a
              // secondary signal for the legacy credit display.
            }
          } catch (err) {
            console.warn('[printStore] license quota fetch failed, trying wallet:', err);
          }

          if (api.getWalletBalance) {
            try {
              const res = await api.getWalletBalance('print');
              if (res?.ok) {
                set((state) => ({
                  printCountRemaining: res.balance | 0,
                  // Keep the running "used" counter coherent: total = used + remaining.
                  printCountTotal: state.printCountUsed + (res.balance | 0),
                }));
                return;
              }
              // Wallet unreachable / no license — show 0 so the user can't
              // be misled into thinking they have credits they don't.
              set({ printCountRemaining: 0 });
              return;
            } catch (err) {
              console.error('[printStore] wallet balance failed:', err);
              set({ printCountRemaining: 0 });
              return;
            }
          }
        }

        // Legacy fallback (browser preview only)
        if (!USE_API) return;
        try {
          const response = await printService.getCount('today');
          set((state) => ({
            printCountUsed: response.counts.completed,
            printCountTotal: state.printCountTotal,
            printCountRemaining: Math.max(0, state.printCountTotal - response.counts.completed),
          }));
        } catch (err) {
          console.error('Failed to fetch print count:', err);
        }
      },

      /**
       * Called after a successful local print. Debits the website wallet
       * atomically (so the dashboard sees the same number immediately),
       * then refreshes from the server to stay in sync.
       */
      logPrintToApi: async (data) => {
        const credits = Math.max(1, (data.credits ?? 1) | 0);
        const api = walletBridge();

        // When the active license has sell-by-print mode enabled (or we're
        // on the local install trial) the display reads from the license
        // quota, NOT the legacy wallet — so the decrement must also hit
        // license quota. Otherwise the user sees "500 prints left" in the
        // header but "balance 0 < required 1" when they try to print.
        if (get().quotaEnabled && api?.decrementLicenseQuota) {
          try {
            const res = await api.decrementLicenseQuota(credits);
            if (res?.ok) {
              const newBal = (res.remaining ?? 0) | 0;
              set((state) => ({
                printCountUsed:      state.printCountUsed + credits,
                printCountRemaining: newBal,
                printCountTotal:     state.printCountUsed + credits + newBal,
              }));
              return { ok: true, balance: newBal };
            }
            console.warn('[printStore] license-quota decrement failed:', res?.reason);
            return { ok: false, balance: (res?.remaining ?? 0) | 0, reason: res?.reason };
          } catch (err) {
            console.error('[printStore] license-quota decrement errored:', err);
            return { ok: false, balance: 0, reason: 'bridge_error' };
          }
        }

        // Quota mode off — fall back to the legacy wallet credit system.
        if (api?.spendWalletCredits) {
          try {
            const res = await api.spendWalletCredits(credits, 'print',
              `Patient ${data.patientName || data.patientId || '—'} · ${data.layoutType || 'image'}`);
            if (res?.ok) {
              const newBal = res.balance | 0;
              set((state) => ({
                printCountUsed:      state.printCountUsed + credits,
                printCountRemaining: newBal,
                printCountTotal:     state.printCountUsed + credits + newBal,
              }));
              return { ok: true, balance: newBal };
            }
            // Spend failed — do NOT touch the local counter. Caller must
            // decide whether to fire the actual print; the print previews
            // call this BEFORE printing precisely so 0 credits = no paper.
            console.warn('[printStore] wallet spend failed:', res?.reason);
            return { ok: false, balance: res?.balance | 0, reason: res?.reason };
          } catch (err) {
            console.error('[printStore] wallet spend errored:', err);
            return { ok: false, balance: 0, reason: 'bridge_error' };
          }
        }

        // Legacy fallback (browser preview only)
        if (!USE_API) {
          for (let i = 0; i < credits; i++) get().decrementPrintCount();
          return { ok: true, balance: get().printCountRemaining };
        }
        try {
          const { settings } = get();
          await printService.logPrint({
            study_uid: data.studyUid,
            patient_id: data.patientId,
            patient_name: data.patientName,
            paper_size: settings.paperSize,
            orientation: settings.orientation,
            copies: settings.copies,
            quality: settings.quality,
            printer_name: settings.defaultPrinter,
            layout_type: data.layoutType,
            print_type: 'image',
            include_patient_info: settings.patientInfoEnabled,
          });
          for (let i = 0; i < credits; i++) get().decrementPrintCount();
          get().fetchPrintCount();
          return { ok: true, balance: get().printCountRemaining };
        } catch (err) {
          console.error('Failed to log print:', err);
          for (let i = 0; i < credits; i++) get().decrementPrintCount();
          return { ok: true, balance: get().printCountRemaining };
        }
      },
    }),
    {
      name: 'dicom-print-store',
      partialize: (state) => ({
        printCountTotal: state.printCountTotal,
        printCountUsed: state.printCountUsed,
        printCountRemaining: state.printCountRemaining,
        settings: state.settings,
        printJobs: state.printJobs,
      }),
    }
  )
);
