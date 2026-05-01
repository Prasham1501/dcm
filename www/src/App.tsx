import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { usePrintStore } from '@/stores/printStore';
import { PatientListPage } from '@/pages/PatientListPage';
import { ViewerPage } from '@/pages/ViewerPage';
import { CRViewerPage } from '@/pages/CRViewerPage';
import { DualViewerPage } from '@/pages/DualViewerPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { StudiesPage } from '@/pages/StudiesPage';
import { PrintManagementPage } from '@/pages/PrintManagementPage';
import { ReportEditorPage } from '@/pages/ReportEditorPage';
import { ToastContainer } from '@/components/shared/Toast';

export default function App() {
  const { mode } = useThemeStore();
  const { printCountRemaining } = usePrintStore();
  const alertShown = useRef(false);

  // Apply theme class to html element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (mode === 'dark') {
      root.classList.add('dark');
    }
  }, [mode]);

  // One-time startup alert when print count is low
  useEffect(() => {
    if (!alertShown.current && printCountRemaining < 50) {
      alertShown.current = true;
      setTimeout(() => {
        alert(
          `⚠️ Low Print Count Warning\n\nYou have only ${printCountRemaining} print${printCountRemaining === 1 ? '' : 's'} remaining.\n\nPlease recharge your print count to continue printing.`
        );
      }, 1500); // slight delay so UI loads first
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/" element={<PatientListPage />}>
        <Route path="config" element={<ConfigPage />} />
      </Route>
      <Route path="/patients" element={<PatientListPage />}>
        <Route path="config" element={<ConfigPage />} />
      </Route>
      <Route path="/viewer" element={<ViewerPage />} />
      <Route path="/cr-viewer" element={<CRViewerPage />} />
      <Route path="/dual-viewer" element={<DualViewerPage />} />
      <Route path="/studies" element={<StudiesPage />} />
      <Route path="/print" element={<PrintManagementPage />} />
      <Route path="/report-editor" element={<ReportEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
