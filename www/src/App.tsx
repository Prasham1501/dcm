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
import { FetalExaminationWorkspace } from '@/features/fetal/routes/FetalExaminationWorkspace';
import { ToastContainer } from '@/components/shared/Toast';
import { LicenseGate } from '@/components/shared/LicenseGate';
import { UpdateModal } from '@/components/UpdateModal';
import { LicenseQuotaModal } from '@/components/LicenseQuotaModal';

export default function App() {
  const { mode } = useThemeStore();
  const { printCountRemaining, fetchPrintCount } = usePrintStore();
  const alertShown = useRef(false);

  // Apply theme class to html element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    if (mode === 'dark') {
      root.classList.add('dark');
    }
  }, [mode]);

  // App-wide wallet sync — every page (Patient list, Viewer, CR Viewer,
  // Dual Viewer, Print management, Report editor) reads printCountRemaining
  // from this store, so a single polling loop here keeps every visible
  // counter in lock-step with the website wallet.
  useEffect(() => {
    fetchPrintCount(); // initial pull
    const onFocus = () => fetchPrintCount();
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(fetchPrintCount, 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [fetchPrintCount]);

  // One-time startup alert when print count is low (waits for the first
  // wallet sync so we don't fire it on the placeholder 0).
  useEffect(() => {
    if (alertShown.current) return;
    if (printCountRemaining === 0) return; // not yet synced
    if (printCountRemaining < 50) {
      alertShown.current = true;
      setTimeout(() => {
        alert(
          `⚠️ Low Print Count Warning\n\nYou have only ${printCountRemaining} print${printCountRemaining === 1 ? '' : 's'} remaining.\n\nPlease recharge your print count to continue printing.`
        );
      }, 1500);
    }
  }, [printCountRemaining]);

  return (
    <>
    <ToastContainer />
    <UpdateModal />
    <LicenseQuotaModal />
    <LicenseGate>
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
      <Route path="/fetal/patient/:patientId" element={<FetalExaminationWorkspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LicenseGate>
    </>
  );
}
