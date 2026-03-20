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
import { useThemeStore } from '@/stores/themeStore';
import { Sun, Moon } from 'lucide-react';

export function PatientListPage() {
  const loadPatients = usePatientStore((s) => s.loadPatients);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      {/* Header with brand */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-app-header-bg border-b-2 border-app-accent">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-app-accent tracking-wide">
            MediView Pro 1.0
          </span>
          <span className="text-xs text-app-text-secondary">
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
          <button className="text-app-text-secondary hover:text-app-text text-lg px-1">_</button>
          <button className="text-app-text-secondary hover:text-app-text text-lg px-1">[]</button>
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
      
      {/* Nested routes (e.g. Config modal) */}
      <Outlet />
    </div>
  );
}
