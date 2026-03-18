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
  }) => Promise<void>;
}

export const usePrintStore = create<PrintStore>()(
  persist(
    (set, get) => ({
      printCountTotal: 500,
      printCountUsed: 0,
      printCountRemaining: 500,

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

      fetchPrintCount: async () => {
        if (!USE_API) return;
        try {
          const response = await printService.getCount('today');
          set({
            printCountUsed: response.counts.completed,
            printCountTotal: response.counts.completed + 500, // placeholder
            printCountRemaining: 500 - response.counts.completed,
          });
        } catch (err) {
          console.error('Failed to fetch print count:', err);
        }
      },

      logPrintToApi: async (data) => {
        if (!USE_API) {
          get().decrementPrintCount();
          return;
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
          get().decrementPrintCount();
          get().fetchPrintCount(); // refresh from server
        } catch (err) {
          console.error('Failed to log print:', err);
          // Still decrement locally on error
          get().decrementPrintCount();
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
