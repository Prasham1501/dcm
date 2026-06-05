import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from '@/stores/themeStore';
import { usePrintStore } from '@/stores/printStore';
import { useAuthStore } from '@/stores/authStore';
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
import { useCloudStore, intervalMs } from '@/stores/cloudStore';
import { useReportStore } from '@/stores/reportStore';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { listLoadedStudies } from '@/lib/loadedStudiesRegistry';

/** Collect DICOM file paths for cloud backup.
 *  Combines patientStore (local patients) + viewer stores (open studies)
 *  + cross-window registry. No recursive folder scanning. */
function collectStudyPathsForBackup(): Array<{ patient_name: string; patient_id: string; files: string[] }> {
  const out: Array<{ patient_name: string; patient_id: string; files: string[] }> = [];

  // 1) Patient store — locally-created / folder-scanned patients
  const patients = usePatientStore.getState().patients;
  for (const p of patients) {
    if (p.filePaths && p.filePaths.length > 0) {
      out.push({ patient_name: p.patientName || 'Unknown', patient_id: p.patientId || p.id, files: p.filePaths });
    }
  }

  // 2) Currently-open viewer stores (covers Orthanc patients open in viewer)
  const v = useViewerStore.getState();
  const vFiles = (v.images ?? [])
    .map((img: any) => {
      const m = String(img.imageUrl ?? '').match(/[?&]path=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    })
    .filter(Boolean);
  if (vFiles.length) out.push({ patient_name: v.patientName || 'viewer', patient_id: v.patientId || '', files: vFiles });

  const c = useCRViewerStore.getState();
  const cFiles = (c.images ?? []).map((img: any) => img.filePath).filter(Boolean);
  if (cFiles.length) out.push({ patient_name: c.patientName || 'cr', patient_id: c.patientId || '', files: cFiles });

  const d = useDualViewerStore.getState();
  for (const panelId of ['left', 'right'] as const) {
    const p = d.panels[panelId];
    const files = (p?.images ?? []).map((img: any) => img.filePath).filter(Boolean);
    if (files.length) out.push({ patient_name: p.patientName || `dual-${panelId}`, patient_id: p.patientId || '', files });
  }

  // 3) Cross-window registry
  for (const s of listLoadedStudies()) out.push(s);

  // Dedupe
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = `${s.patient_id}|${s.files[0] || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function App() {
  const { mode } = useThemeStore();
  const { printCountRemaining, quotaEnabled: printQuotaEnabled, fetchPrintCount } = usePrintStore();
  const alertShown = useRef(false);

  // Establish a PHP session on startup. The desktop viewer has no login screen,
  // so checkSession() falls back to the opt-in desktop auto-login — this is what
  // lets session-gated PHP endpoints (reports, PCPNDT Form F, etc.) work.
  useEffect(() => {
    useAuthStore.getState().checkSession();
  }, []);

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

  // ── Cloud auto-sync ────────────────────────────────────────
  // Walks the cloud config every minute and fires a backup whenever the
  // user-configured interval (hourly / daily / weekly) has elapsed since
  // the last successful sync. The actual upload is delegated to
  // /api/cloud/backup.php; this hook just decides when to call it.
  useEffect(() => {
    const tick = async () => {
      const cfg = useCloudStore.getState();
      if (cfg.provider === 'none' || !cfg.accessToken) return;
      const step = intervalMs(cfg.syncInterval);
      if (step === 0) return; // user picked "Manual only"
      const last = cfg.lastSyncAt ?? 0;
      if (Date.now() - last < step) return;
      if (cfg.lastStatus === 'running') return;
      cfg.setRunStatus('running');
      try {
        const templates    = useReportStore.getState().templates;
        const studyPaths   = collectStudyPathsForBackup();
        const patientIds   = usePatientStore.getState().patients.map((p) => p.patientId || p.id);
        // Incremental: send paths already backed up so the server skips them.
        const alreadySynced = Object.keys(cfg.syncedFiles);
        const resp = await fetch('/api/cloud/backup.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider:     cfg.provider,
            access_token: cfg.accessToken,
            remote_folder: cfg.remoteFolder || '/dcm-backups',
            scopes:       cfg.scopes,
            templates,
            study_paths:   studyPaths,
            patient_ids:   patientIds,
            already_synced: alreadySynced,
          }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        cfg.markSynced();
        // Track newly synced files so future runs skip them.
        if (Array.isArray(data.synced_files) && data.synced_files.length > 0) {
          cfg.recordSyncedFiles(data.synced_files);
        }
      } catch (e: any) {
        cfg.setRunStatus('failed', e?.message || 'Auto-sync failed');
      }
    };
    // Check on mount, then every minute.
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // One-time startup alert when print count is low (waits for the first
  // wallet sync so we don't fire it on the placeholder 0).
  useEffect(() => {
    if (alertShown.current) return;
    if (!printQuotaEnabled) return;       // unlimited prints — no alert needed
    if (printCountRemaining === 0) return; // not yet synced
    if (printCountRemaining < 50) {
      alertShown.current = true;
      setTimeout(() => {
        alert(
          `⚠️ Low Print Count Warning\n\nYou have only ${printCountRemaining} print${printCountRemaining === 1 ? '' : 's'} remaining.\n\nPlease recharge your print count to continue printing.`
        );
      }, 1500);
    }
  }, [printCountRemaining, printQuotaEnabled]);

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
