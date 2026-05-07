import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { PatientSearchBar } from '@/components/patient/PatientSearchBar';
import { PatientDateFilter } from '@/components/patient/PatientDateFilter';
import { PatientTable } from '@/components/patient/PatientTable';
import { ThumbnailStrip } from '@/components/patient/ThumbnailStrip';
import { PatientActionBar } from '@/components/patient/PatientActionBar';
import { FolderSyncBar } from '@/components/patient/FolderSyncBar';
import { PatientStatusBar } from '@/components/patient/PatientStatusBar';
import { useThemeStore } from '@/stores/themeStore';
import { useReportStore } from '@/stores/reportStore';
import { usePrintStore } from '@/stores/printStore';
import { useLicenseStore } from '@/stores/licenseStore';
import { ReportEditor } from '@/components/report/ReportEditor';
import { ReportRouterHost } from '@/features/report-router/ReportRouterHost';
import { useReportRouter } from '@/features/report-router/useReportRouter';
import { Sun, Moon } from 'lucide-react';

// Re-hydrate the report store from localStorage whenever the popup window
// saves a report (it writes to localStorage in its own JS context, which
// triggers the main window's 'storage' event).
function useReportStoreCrossWindowSync() {
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'report-store') {
        // Force Zustand to re-read from localStorage so the patient table
        // immediately shows updated report counts/indicators.
        try {
          useReportStore.persist.rehydrate();
        } catch { /* older Zustand versions may not expose rehydrate */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
}

export function PatientListPage() {
  useReportStoreCrossWindowSync();
  const navigate = useNavigate();
  const loadPatients = usePatientStore((s) => s.loadPatients);
  const selectedPatient = usePatientStore((s) => s.selectedPatient);
  const filteredPatients = usePatientStore((s) => s.filteredPatients);
  const _openReportEditor = useReportStore((s) => s.openReportEditor);
  void _openReportEditor;
  const reportRouter = useReportRouter();
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const printCountRemaining = usePrintStore((s) => s.printCountRemaining);
  const licenseStatus = useLicenseStore((s) => s.status);
  const printedCount = filteredPatients.filter((p) => p.printed).length;

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Auto-refresh when DICOM files are received via network
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.on) return;
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadPatients(), 2000);
    };
    // api.on returns a cleanup function (removeListener)
    const cleanup = api.on('dicom-file-received', handler);
    return () => {
      clearTimeout(debounceTimer);
      if (typeof cleanup === 'function') cleanup();
    };
  }, [loadPatients]);

  // F10 shortcut to open Config, F9 to open Default Printer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        navigate('/config');
      } else if (e.key === 'F9') {
        e.preventDefault();
        usePrintStore.getState().setShowPrinterModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header with brand + stats */}
      <div className="flex items-center justify-between px-2 2xl:px-5 py-1 2xl:py-2 bg-app-header-bg border-b-2 border-app-accent flex-wrap gap-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-base 2xl:text-xl font-bold text-app-accent tracking-wide whitespace-nowrap">
            Accurate
          </span>
          <span className="text-[10px] 2xl:text-xs text-app-text-secondary whitespace-nowrap">
            {licenseStatus?.type === 'licensed'
              ? `| License ${licenseStatus.licenseKey ? licenseStatus.licenseKey.split('-').pop() : '—'} | ${licenseStatus.daysLeft != null ? `${licenseStatus.daysLeft} days left` : '—'}`
              : licenseStatus?.type === 'trial'
                ? `| Trial: ${licenseStatus.remaining} day${licenseStatus.remaining !== 1 ? 's' : ''} left`
                : '| No License'}
          </span>
          <span className="text-[10px] 2xl:text-xs text-app-text-secondary whitespace-nowrap">
            | Prints Left: {printCountRemaining}
          </span>
          <span className="text-[10px] 2xl:text-xs text-app-text-secondary whitespace-nowrap">
            | Records: {filteredPatients.length}
          </span>
          <span className="text-[10px] 2xl:text-xs text-app-text-secondary whitespace-nowrap">
            | Printed: {printedCount}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className="p-1 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {mode === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          <button className="text-app-text-secondary hover:text-app-text text-sm px-0.5">_</button>
          <button
            onClick={() => {
              const p = selectedPatient;
              if (!p) { alert('Select a patient first'); return; }
              reportRouter.createReport(p);
            }}
            className="text-app-text-secondary hover:text-app-text text-sm px-0.5"
            title={selectedPatient ? `Report for ${selectedPatient.patientName}` : 'Select a patient first'}
          >
            []
          </button>
          <button className="text-app-accent hover:text-red-700 text-sm font-bold px-0.5">x</button>
        </div>
      </div>

      {/* Folder sync bar */}
      <FolderSyncBar />

      {/* Search filters */}
      <PatientSearchBar />

      {/* Date filters */}
      <PatientDateFilter />

      {/* Patient table - takes remaining space */}
      <PatientTable />

      {/* Thumbnail preview strip */}
      <ThumbnailStrip />

      {/* Action buttons bar */}
      <PatientActionBar />

      {/* Status bar */}
      <PatientStatusBar />
      
      {/* Report Editor modal */}
      <ReportEditor />

      {/* Report-type picker modal (auto-detects fetal vs radiology, etc.) */}
      <ReportRouterHost />

      {/* Nested routes (e.g. Config modal) */}
      <Outlet />
    </div>
  );
}
