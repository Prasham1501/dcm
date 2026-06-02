/**
 * cloudBackup — shared helpers for the cloud-backup feature.
 *
 *  Used by both the Cloud settings tab and the quick Backup / Browse Backup
 *  buttons on the Patient list, so the two paths can't drift apart.
 */
import { useReportStore } from '@/stores/reportStore';
import { usePatientStore } from '@/stores/patientStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { useCloudStore } from '@/stores/cloudStore';
import { listLoadedStudies } from '@/lib/loadedStudiesRegistry';

export type StudyPathEntry = { patient_name: string; patient_id: string; files: string[] };
export type CloudBundleEntry = { name: string; size: number; modified: string; path: string };

/** Collect DICOM file paths visible to this renderer (patient store +
 *  viewer stores + cross-window registry), deduplicated. */
export function collectStudyPaths(): StudyPathEntry[] {
  const out: StudyPathEntry[] = [];

  const patients = usePatientStore.getState().patients;
  for (const p of patients) {
    if (p.filePaths && p.filePaths.length > 0) {
      out.push({
        patient_name: p.patientName || 'Unknown',
        patient_id: p.patientId || p.id,
        files: p.filePaths,
      });
    }
  }

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

  for (const s of listLoadedStudies()) out.push(s);

  const seen = new Set<string>();
  return out.filter((s) => {
    const key = `${s.patient_id}|${s.files[0] || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type BackupRunResult = {
  ok: true;
  bundle_name: string;
  bytes: number;
  counts: Record<string, number>;
  synced_files?: string[];
  already_synced_count?: number;
};

export async function runBackup(): Promise<BackupRunResult> {
  const cfg = useCloudStore.getState();
  if (cfg.provider === 'none' || !cfg.accessToken.trim()) {
    throw new Error('Cloud backup not configured — open Settings → Cloud.');
  }
  cfg.setRunStatus('running');
  const templates = useReportStore.getState().templates;
  const studyPaths = collectStudyPaths();
  const patientIds = usePatientStore.getState().patients.map((p) => p.patientId || p.id);
  const alreadySynced = Object.keys(cfg.syncedFiles);

  const resp = await fetch('/api/cloud/backup.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: cfg.provider,
      access_token: cfg.accessToken,
      remote_folder: cfg.remoteFolder || '/dcm-backups',
      scopes: cfg.scopes,
      templates,
      study_paths: studyPaths,
      patient_ids: patientIds,
      already_synced: alreadySynced,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    cfg.setRunStatus('failed', data.error || `HTTP ${resp.status}`);
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  cfg.markSynced();
  if (Array.isArray(data.synced_files) && data.synced_files.length > 0) {
    cfg.recordSyncedFiles(data.synced_files);
  }
  return data as BackupRunResult;
}

export async function listBackups(): Promise<CloudBundleEntry[]> {
  const cfg = useCloudStore.getState();
  if (cfg.provider === 'none' || !cfg.accessToken.trim()) {
    throw new Error('Cloud backup not configured.');
  }
  const resp = await fetch('/api/cloud/list.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: cfg.provider,
      access_token: cfg.accessToken,
      remote_folder: cfg.remoteFolder || '/dcm-backups',
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return (data.entries || []) as CloudBundleEntry[];
}

export async function downloadBackup(path: string, name: string): Promise<void> {
  const cfg = useCloudStore.getState();
  const resp = await fetch('/api/cloud/download.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: cfg.provider,
      access_token: cfg.accessToken,
      path,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
