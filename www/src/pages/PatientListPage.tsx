import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePatientStore } from '@/stores/patientStore';
import { PatientSearchBar } from '@/components/patient/PatientSearchBar';
import { PatientDateFilter } from '@/components/patient/PatientDateFilter';
import { PatientToolbar } from '@/components/patient/PatientToolbar';
import { PatientTable } from '@/components/patient/PatientTable';
import { ThumbnailStrip } from '@/components/patient/ThumbnailStrip';
import { PatientActionBar } from '@/components/patient/PatientActionBar';
import { FolderSyncBar } from '@/components/patient/FolderSyncBar';
import { PatientStatusBar } from '@/components/patient/PatientStatusBar';
import { useThemeStore, DARK_THEME_COLORS } from '@/stores/themeStore';
import { useReportStore } from '@/stores/reportStore';

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
import { ReportEditor } from '@/components/report/ReportEditor';
import { Sun, Moon, Palette } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function PatientListPage() {
  useReportStoreCrossWindowSync();
  const navigate = useNavigate();
  const loadPatients = usePatientStore((s) => s.loadPatients);
  const selectedPatient = usePatientStore((s) => s.selectedPatient);
  const openReportEditor = useReportStore((s) => s.openReportEditor);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const darkColorId = useThemeStore((s) => s.darkColorId);
  const setDarkColor = useThemeStore((s) => s.setDarkColor);
  const [showColorPicker, setShowColorPicker] = useState(false);

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

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header with brand */}
      <div className="flex items-center justify-between px-3 2xl:px-5 py-1.5 2xl:py-2.5 bg-app-header-bg border-b-2 border-app-accent">
        <div className="flex items-center gap-2">
          <span className="text-lg 2xl:text-2xl font-bold text-app-accent tracking-wide">
            MediView Pro
          </span>
          <span className="text-xs 2xl:text-sm text-app-text-secondary">
            | License TV5PPH4T | License period left : 224 days.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
            title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {mode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          {mode === 'dark' && (
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1.5 rounded hover:bg-app-hover transition-colors text-app-text-secondary"
                title="Choose dark theme color"
              >
                <Palette className="w-4 h-4" />
              </button>
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-app-surface border border-app-border rounded-lg shadow-xl p-3 min-w-[220px]">
                    <div className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider mb-2">Theme Color</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DARK_THEME_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => { setDarkColor(color.id); setShowColorPicker(false); }}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                            darkColorId === color.id
                              ? 'ring-2 ring-offset-1 ring-offset-transparent'
                              : 'hover:bg-app-hover'
                          }`}
                          style={darkColorId === color.id ? { outline: `2px solid ${color.accent}` } : undefined}
                        >
                          <div
                            className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0"
                            style={{ backgroundColor: color.accent }}
                          />
                          <span className="text-app-text truncate">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <button className="text-app-text-secondary hover:text-app-text text-lg px-1">_</button>
          <button
            onClick={async () => {
              const p = selectedPatient;
              if (!p) { alert('Select a patient first'); return; }
              if (!p.filePaths || p.filePaths.length === 0) { alert('No images to view'); return; }

              // Store launch data for both viewer and report editor
              localStorage.setItem('viewer-launch', JSON.stringify({
                patientName: p.patientName, patientId: p.patientId,
                studyDate: p.studyDate, filePaths: p.filePaths, timestamp: Date.now(),
              }));
              localStorage.setItem('report-launch', JSON.stringify({
                patientName: p.patientName, patientId: p.patientId || p.id,
                studyDate: p.studyDate, timestamp: Date.now(),
              }));

              const api = (window as any).electronAPI;
              if (api?.openViewerWithReport) {
                try {
                  await api.openViewerWithReport({
                    isPortrait: false, imageCount: p.filePaths.length, cols: 2, rows: 2,
                  });
                  return;
                } catch (e) { console.warn('Failed to open dual windows:', e); }
              }
              // Fallback: open report modal + navigate to viewer
              openReportEditor(p.id, p.patientName);
            }}
            className="text-app-text-secondary hover:text-app-text text-lg px-1"
            title={selectedPatient ? `Report for ${selectedPatient.patientName}` : 'Select a patient first'}
          >
            []
          </button>
          <button className="text-app-accent hover:text-red-700 text-lg font-bold px-1">x</button>
        </div>
      </div>

      {/* Folder sync bar */}
      <FolderSyncBar />

      {/* Search filters */}
      <PatientSearchBar />

      {/* Date filters */}
      <PatientDateFilter />

      {/* Toolbar row */}
      <PatientToolbar />

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

      {/* Nested routes (e.g. Config modal) */}
      <Outlet />
    </div>
  );
}
