import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Report } from '@/types/study';

export interface ReportTemplate {
  id: string;
  name: string;
  findings: string;
  impression: string;
  recommendation: string;
  content?: string; // Rich HTML content for full-page editor templates
  createdAt: number;
}

export interface SavedReport {
  id: string;
  patientId: string;
  patientName: string;
  studyDate: string;
  content: string; // HTML
  title: string;
  doctor: string;
  status: 'draft' | 'final';
  createdAt: number;
  updatedAt: number;
}

interface ReportStore {
  reports: Record<string, Report>;
  templates: ReportTemplate[];
  savedReports: SavedReport[];
  showReportEditor: boolean;
  editingPatientId: string | null;
  editingPatientName: string;
  getReport: (studyId: string) => Report | undefined;
  saveReport: (studyId: string, data: Omit<Report, 'id' | 'studyId'>) => void;
  deleteReport: (studyId: string) => void;
  printReport: (studyId: string) => void;
  openReportEditor: (patientId: string, patientName: string) => void;
  closeReportEditor: () => void;
  addTemplate: (template: Omit<ReportTemplate, 'id' | 'createdAt'>) => void;
  removeTemplate: (id: string) => void;
  saveFullReport: (report: Omit<SavedReport, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  getReportsForPatient: (patientId: string) => SavedReport[];
  addRichTemplate: (template: { name: string; content: string }) => void;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set, get) => ({
      reports: {},
      templates: [],
      savedReports: [],
      showReportEditor: false,
      editingPatientId: null,
      editingPatientName: '',

      getReport: (studyId: string) => {
        return get().reports[studyId];
      },

      saveReport: (studyId: string, data: Omit<Report, 'id' | 'studyId'>) => {
        const existing = get().reports[studyId];
        const report: Report = {
          id: existing?.id || `rpt-${studyId}-${Date.now()}`,
          studyId,
          ...data,
        };
        set((s) => ({
          reports: { ...s.reports, [studyId]: report },
        }));
      },

      deleteReport: (studyId: string) => {
        set((s) => {
          const { [studyId]: _, ...rest } = s.reports;
          return { reports: rest };
        });
      },

      printReport: (studyId: string) => {
        const report = get().reports[studyId];
        if (!report) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Report - ${report.title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
              h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; }
              h2 { font-size: 14px; color: #555; margin-top: 20px; }
              .meta { font-size: 12px; color: #666; margin: 8px 0; }
              .content { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
              .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
              .status-final { background: #16a34a; color: white; }
              .status-draft { background: #eab308; color: black; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <h1>${report.title}</h1>
            <div class="meta">
              Date: ${report.date} | Doctor: ${report.doctor} |
              <span class="status status-${report.status}">${report.status.toUpperCase()}</span>
            </div>
            <h2>FINDINGS</h2>
            <div class="content">${report.findings}</div>
            <h2>IMPRESSION</h2>
            <div class="content">${report.impression}</div>
            <h2>RECOMMENDATION</h2>
            <div class="content">${report.recommendation}</div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      },
      openReportEditor: (patientId, patientName) => {
        set({ showReportEditor: true, editingPatientId: patientId, editingPatientName: patientName });
      },

      closeReportEditor: () => {
        set({ showReportEditor: false, editingPatientId: null, editingPatientName: '' });
      },

      addTemplate: (template) => {
        const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          templates: [...s.templates, { ...template, id, createdAt: Date.now() }],
        }));
      },

      removeTemplate: (id) => {
        set((s) => ({
          templates: s.templates.filter(t => t.id !== id),
        }));
      },

      saveFullReport: (report) => {
        const now = Date.now();
        const id = report.id || `rpt-full-${now}-${Math.random().toString(36).slice(2, 6)}`;
        const existing = get().savedReports.find(r => r.id === id);
        const savedReport: SavedReport = {
          ...report,
          id,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        set((s) => ({
          savedReports: [
            ...s.savedReports.filter(r => r.id !== id),
            savedReport,
          ],
        }));
      },

      getReportsForPatient: (patientId) => {
        return get().savedReports.filter(r => r.patientId === patientId);
      },

      addRichTemplate: (template) => {
        const id = `tpl-rich-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({
          templates: [...s.templates, {
            id,
            name: template.name,
            findings: '',
            impression: '',
            recommendation: '',
            content: template.content,
            createdAt: Date.now(),
          }],
        }));
      },
    }),
    {
      name: 'report-store',
      partialize: (state) => ({
        reports: state.reports,
        templates: state.templates,
        savedReports: state.savedReports,
      }),
    }
  )
);
