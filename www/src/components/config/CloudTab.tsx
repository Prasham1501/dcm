/**
 * CloudTab — sits next to License in the Config modal.
 *
 *  Lets the operator:
 *    • Pick Dropbox or Google Drive as the backup destination.
 *    • Paste an access token (with help links to obtain one).
 *    • Choose what's backed up (reports, DICOM, templates, branding).
 *    • Pick an auto-sync interval (off / hourly / daily / weekly).
 *    • Trigger a manual "Sync now" run, and see the last-run status.
 *    • Browse what's in cloud and download missing-locally items.
 *
 *  Server-side orchestration lives in /api/cloud/backup.php.
 *  Per-patient folders are zipped into a single bundle named after the
 *  timeline (YYYY-MM-DD_HHMM) and uploaded via the provider's REST API.
 */
import { useState } from 'react';
import {
  Cloud, UploadCloud, DownloadCloud, ExternalLink, KeyRound,
  CheckCircle2, AlertCircle, Loader2, FolderTree, RefreshCw,
} from 'lucide-react';
import { useCloudStore, type CloudProvider, type SyncInterval } from '@/stores/cloudStore';
import { useReportStore } from '@/stores/reportStore';
import { useViewerStore } from '@/stores/viewerStore';
import { useCRViewerStore } from '@/stores/crViewerStore';
import { useDualViewerStore } from '@/stores/dualViewerStore';
import { useUIStore } from '@/stores/uiStore';
import { listLoadedStudies, listLoadedStudyFolders, clearLoadedStudiesRegistry } from '@/lib/loadedStudiesRegistry';

/** Snapshot study folders for the cloud backup. We pull from BOTH the
 *  in-memory Zustand stores (current window) AND the localStorage-backed
 *  cross-window registry (other Electron BrowserWindows). The registry is
 *  what lets the Cloud tab — opened from a different window than the
 *  viewer — actually see what's loaded. */
function collectStudyPaths(): Array<{ patient_name: string; patient_id: string; files: string[] }> {
  const out: Array<{ patient_name: string; patient_id: string; files: string[] }> = [];

  // 1) Current window's stores (covers the common case where viewer + Config
  //    share a window).
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

  // 2) Cross-window registry (covers Electron multi-window setups where
  //    the viewer is in a different BrowserWindow than this Config window).
  for (const s of listLoadedStudies()) out.push(s);

  // Dedupe by patient_id + first file (same study can be open in multiple
  // places) so the zip doesn't contain copies.
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = `${s.patient_id}|${s.files[0] || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Expose a quick way to clear the cross-window registry from the UI.
export { clearLoadedStudiesRegistry };

const PROVIDER_OPTIONS: { id: CloudProvider; label: string; help: string }[] = [
  { id: 'none',    label: 'Not configured', help: '' },
  { id: 'dropbox', label: 'Dropbox',        help: 'https://www.dropbox.com/developers/apps' },
  { id: 'google',  label: 'Google Drive',   help: 'https://console.cloud.google.com/apis/credentials' },
];

const INTERVAL_OPTIONS: { id: SyncInterval; label: string }[] = [
  { id: 'off',    label: 'Manual only' },
  { id: 'hourly', label: 'Every hour' },
  { id: 'daily',  label: 'Once a day' },
  { id: 'weekly', label: 'Once a week' },
];

export function CloudTab() {
  const cfg = useCloudStore();
  const addToast = useUIStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [cloudList, setCloudList] = useState<Array<{ name: string; size: number; modified: string; path: string }> | null>(null);
  const [listingBusy, setListingBusy] = useState(false);

  const canSync = cfg.provider !== 'none' && cfg.accessToken.trim().length > 0;

  const callBackup = async () => {
    if (!canSync) {
      addToast('Pick a provider and paste an access token first.', 'error', 3000);
      return;
    }
    setBusy(true);
    cfg.setRunStatus('running');
    // Templates live in the browser's localStorage; the server can't see
    // them directly, so we ship them along in the request body.

    const templates    = useReportStore.getState().templates;
    const studyPaths   = collectStudyPaths();
    const studyFolders = listLoadedStudyFolders();
    // Incremental: send paths already backed up so the server skips them.
    const alreadySynced = Object.keys(cfg.syncedFiles);
    try {
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
          study_folders: studyFolders,
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
      const c = data.counts || {};
      const total = (c.reports ?? 0) + (c.dicom ?? 0) + (c.studies ?? 0) + (c.templates ?? 0) + (c.branding ?? 0);
      const bytes = data.bytes ?? 0;
      const sizeStr = bytes >= 1024 * 1024
        ? (bytes / 1024 / 1024).toFixed(2) + ' MB'
        : (bytes / 1024).toFixed(1) + ' KB';
      const dicomTotal = (c.studies ?? 0) + (c.dicom ?? 0);
      const skippedCount = data.already_synced_count ?? 0;
      const skippedNote = skippedCount > 0 ? ` · ${skippedCount} already synced` : '';
      addToast(
        `Backup uploaded: ${data.bundle_name} (${sizeStr} · ${total} new items: ${dicomTotal} dicom, ${c.reports ?? 0} reports, ${c.templates ?? 0} templates${skippedNote})`,
        'success', 6000,
      );
      if (total === 0) {
        addToast(
          'Bundle was empty — open a study in the viewer first, or enable more scopes.',
          'error', 6000,
        );
      }
    } catch (e: any) {
      cfg.setRunStatus('failed', e?.message || 'Unknown error');
      addToast(`Backup failed: ${e?.message || 'Unknown error'}`, 'error', 5000);
    } finally {
      setBusy(false);
    }
  };

  const refreshCloudList = async () => {
    if (!canSync) return;
    setListingBusy(true);
    try {
      const resp = await fetch('/api/cloud/list.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider:     cfg.provider,
          access_token: cfg.accessToken,
          remote_folder: cfg.remoteFolder || '/dcm-backups',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setCloudList(data.entries || []);
    } catch (e: any) {
      addToast(`Could not list cloud files: ${e?.message || 'Unknown error'}`, 'error', 4000);
    } finally {
      setListingBusy(false);
    }
  };

  const downloadFromCloud = async (path: string, name: string) => {
    try {
      const resp = await fetch('/api/cloud/download.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider:     cfg.provider,
          access_token: cfg.accessToken,
          path,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast(`Download failed: ${e?.message || 'Unknown error'}`, 'error', 4000);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      {/* ── Provider ─────────────────────────────────────────── */}
      <Section title="Cloud provider" icon={<Cloud className="w-4 h-4" />}>
        <Row label="Destination">
          <select
            value={cfg.provider}
            onChange={(e) => cfg.setProvider(e.target.value as CloudProvider)}
            className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
          >
            {PROVIDER_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Row>

        {cfg.provider !== 'none' && (
          <>
            <Row label="Access token">
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-app-text-secondary shrink-0" />
                <input
                  type="password"
                  value={cfg.accessToken}
                  onChange={(e) => cfg.setAccessToken(e.target.value)}
                  placeholder="Paste your provider access token"
                  className="flex-1 h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded font-mono"
                />
              </div>
            </Row>
            <Row label="Remote folder">
              <input
                type="text"
                value={cfg.remoteFolder}
                onChange={(e) => cfg.setRemoteFolder(e.target.value)}
                placeholder="/dcm-backups"
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
              />
            </Row>
            <SetupGuide provider={cfg.provider} />
            </>
        )}
      </Section>

      {/* ── Scopes ───────────────────────────────────────────── */}
      <Section title="What to back up" icon={<FolderTree className="w-4 h-4" />}>
        <CheckboxRow checked={cfg.scopes.reports}   onChange={(v) => cfg.setScope('reports',   v)} label="Patient reports"      sub="HTML reports saved from the editor (one folder per patient)" />
        <CheckboxRow checked={cfg.scopes.dicom}     onChange={(v) => cfg.setScope('dicom',     v)} label="DICOM files"          sub="Original DICOM files received by the receiver / imported manually" />
        <CheckboxRow checked={cfg.scopes.templates} onChange={(v) => cfg.setScope('templates', v)} label="Report templates"     sub="Reusable report templates you've saved" />
        <CheckboxRow checked={cfg.scopes.branding}  onChange={(v) => cfg.setScope('branding',  v)} label="Branding + settings" sub="Hospital header / footer / logo configuration" />
      </Section>

      {/* ── Schedule ─────────────────────────────────────────── */}
      <Section title="Auto-sync schedule" icon={<RefreshCw className="w-4 h-4" />}>
        <Row label="Frequency">
          <select
            value={cfg.syncInterval}
            onChange={(e) => cfg.setSyncInterval(e.target.value as SyncInterval)}
            className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </Row>
        <p className="text-[11px] text-app-text-secondary">
          Incremental sync — only new / unsynced files are uploaded each run.
          Already-backed-up files are skipped automatically.
        </p>
        {Object.keys(cfg.syncedFiles).length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-app-text-secondary">
              {Object.keys(cfg.syncedFiles).length} file{Object.keys(cfg.syncedFiles).length === 1 ? '' : 's'} tracked as synced
            </span>
            <button
              type="button"
              onClick={() => {
                cfg.clearSyncHistory();
                addToast('Sync history cleared — next run will upload everything.', 'success', 3000);
              }}
              className="text-[11px] text-red-500 hover:underline"
            >
              Reset sync history
            </button>
          </div>
        )}
      </Section>

      {/* ── Run + status ─────────────────────────────────────── */}
      <Section title="Manual run" icon={<UploadCloud className="w-4 h-4" />}>
        <div className="flex items-center gap-2">
          <button
            disabled={!canSync || busy}
            onClick={callBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-app-accent text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            Sync now
          </button>
          <StatusBadge status={cfg.lastStatus} />
          {cfg.lastSyncAt && (
            <span className="text-[11px] text-app-text-secondary">
              Last sync: {new Date(cfg.lastSyncAt).toLocaleString()}
            </span>
          )}
        </div>
        {cfg.lastStatus === 'failed' && cfg.lastError && (
          <div className="rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-500 mt-2">
            {cfg.lastError}
          </div>
        )}
      </Section>

      {/* ── Restore from cloud ───────────────────────────────── */}
      <RestoreSection
        canSync={canSync}
        listingBusy={listingBusy}
        cloudList={cloudList}
        remoteFolder={cfg.remoteFolder}
        onRefresh={refreshCloudList}
        onDownload={downloadFromCloud}
      />
    </div>
  );
}

/* ── Restore from cloud — date-filterable bundle browser ──────
   Bundle names are `dcm-backup_YYYY-MM-DD_HHMM.zip`; we parse the
   date out of the filename (falling back to the `modified`
   timestamp) so the operator can filter by date range, search by
   name, and see bundles grouped by day. */

interface CloudEntry { name: string; size: number; modified: string; path: string; }

function parseBundleDate(entry: CloudEntry): Date | null {
  // Filename: dcm-backup_YYYY-MM-DD_HHMM.zip
  const m = entry.name.match(/^dcm-backup_(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})/);
  if (m) {
    const iso = `${m[1]}T${m[2]}:${m[3]}:00`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  // Fall back to cloud-reported modified timestamp.
  if (entry.modified) {
    const d = new Date(entry.modified);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function dateKey(d: Date | null): string {
  if (!d) return 'Unknown date';
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function RestoreSection({
  canSync, listingBusy, cloudList, remoteFolder, onRefresh, onDownload,
}: {
  canSync: boolean;
  listingBusy: boolean;
  cloudList: CloudEntry[] | null;
  remoteFolder: string;
  onRefresh: () => void;
  onDownload: (path: string, name: string) => void;
}) {
  const [from,  setFrom]  = useState('');
  const [to,    setTo]    = useState('');
  const [query, setQuery] = useState('');

  // Decorate entries with parsed dates once.
  const decorated = (cloudList ?? []).map((e) => ({ entry: e, date: parseBundleDate(e) }));

  const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const toTs   = to   ? new Date(`${to}T23:59:59`).getTime()   :  Infinity;
  const q      = query.trim().toLowerCase();

  const filtered = decorated
    .filter(({ entry, date }) => {
      const ts = date?.getTime() ?? NaN;
      if (from && (isNaN(ts) || ts < fromTs)) return false;
      if (to   && (isNaN(ts) || ts > toTs))   return false;
      if (q && !entry.name.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  // Group by day for the visual structure.
  const groups = new Map<string, typeof filtered>();
  for (const row of filtered) {
    const key = dateKey(row.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const totalSize = filtered.reduce((sum, r) => sum + r.entry.size, 0);
  const sizeStr = totalSize >= 1024 * 1024
    ? `${(totalSize / 1024 / 1024).toFixed(1)} MB`
    : `${(totalSize / 1024).toFixed(0)} KB`;

  return (
    <Section title="Restore from cloud" icon={<DownloadCloud className="w-4 h-4" />}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          disabled={!canSync || listingBusy}
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-app-border bg-app-bg text-app-text hover:bg-app-hover disabled:opacity-40"
        >
          {listingBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {cloudList ? 'Refresh' : 'Load cloud backups'}
        </button>
        <span className="text-[11px] text-app-text-secondary">
          {cloudList
            ? `${filtered.length} of ${cloudList.length} bundle${cloudList.length === 1 ? '' : 's'} in ${remoteFolder} · ${sizeStr}`
            : 'Not loaded yet'}
        </span>
      </div>

      {/* Filter bar — only meaningful after we've loaded something */}
      {cloudList && cloudList.length > 0 && (
        <div className="mt-3 rounded border border-app-border bg-app-header-bg/40 p-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-app-text-secondary mb-0.5">From date</span>
              <input
                type="date" value={from} max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-app-text-secondary mb-0.5">To date</span>
              <input
                type="date" value={to} min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-app-text-secondary mb-0.5">Search name</span>
              <input
                type="text" value={query} placeholder="patient / keyword"
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-7 px-2 text-xs border border-app-border bg-app-bg text-app-text rounded"
              />
            </label>
          </div>
          {/* Quick presets — one click for common ranges */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-app-text-secondary">Quick:</span>
            <Preset onClick={() => { setFrom(todayIso()); setTo(todayIso()); }}            label="Today" />
            <Preset onClick={() => { setFrom(todayIso(-7));  setTo(todayIso()); }}         label="Last 7 days" />
            <Preset onClick={() => { setFrom(todayIso(-30)); setTo(todayIso()); }}         label="Last 30 days" />
            <Preset onClick={() => { setFrom(todayIso(-90)); setTo(todayIso()); }}         label="Last 90 days" />
            <Preset onClick={() => { setFrom(''); setTo(''); setQuery(''); }}              label="Clear" />
          </div>
        </div>
      )}

      {/* Grouped result list */}
      {cloudList && cloudList.length > 0 ? (
        filtered.length === 0 ? (
          <div className="mt-3 rounded border border-dashed border-app-border p-4 text-center text-xs text-app-text-secondary">
            No bundles match the current filter.
          </div>
        ) : (
          <div className="mt-3 max-h-96 overflow-y-auto rounded border border-app-border divide-y divide-app-border">
            {[...groups.entries()].map(([day, rows]) => {
              const daySize = rows.reduce((s, r) => s + r.entry.size, 0);
              const daySizeStr = daySize >= 1024 * 1024
                ? `${(daySize / 1024 / 1024).toFixed(1)} MB`
                : `${(daySize / 1024).toFixed(0)} KB`;
              return (
                <div key={day}>
                  <div className="sticky top-0 bg-app-header-bg px-3 py-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-app-text-secondary">
                    <span>{day}</span>
                    <span className="font-mono font-normal">{rows.length} · {daySizeStr}</span>
                  </div>
                  <ul>
                    {rows.map(({ entry, date }) => (
                      <li key={entry.path} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-app-hover/40">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-app-text truncate">{entry.name}</div>
                          <div className="text-[10px] text-app-text-secondary">
                            {date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : entry.modified || '—'}
                            {' · '}
                            {entry.size >= 1024 * 1024
                              ? `${(entry.size / 1024 / 1024).toFixed(2)} MB`
                              : `${(entry.size / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                        <button
                          onClick={() => onDownload(entry.path, entry.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-app-accent text-app-accent bg-app-bg hover:bg-app-accent hover:text-white transition-colors flex-shrink-0"
                        >
                          <DownloadCloud className="w-3 h-3" /> Download
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </Section>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-2 py-0.5 rounded-full border border-app-border bg-app-bg text-app-text hover:bg-app-accent hover:text-white hover:border-app-accent transition-colors font-semibold"
    >
      {label}
    </button>
  );
}

/* ── Helpers ───────────────────────────────────────────────── */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded border border-app-border p-3 space-y-2 bg-app-bg">
      <header className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-app-text-secondary">
        {icon}{title}
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[140px_1fr] items-center gap-2">
      <span className="text-xs text-app-text-secondary">{label}</span>
      <div>{children}</div>
    </label>
  );
}

function CheckboxRow({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-app-accent cursor-pointer"
      />
      <div>
        <div className="text-xs text-app-text">{label}</div>
        {sub && <div className="text-[10px] text-app-text-secondary">{sub}</div>}
      </div>
    </label>
  );
}

function StatusBadge({ status }: { status: 'idle' | 'running' | 'ok' | 'failed' }) {
  if (status === 'running') return <span className="inline-flex items-center gap-1 text-[11px] text-amber-500"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</span>;
  if (status === 'ok')      return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 className="w-3 h-3" /> Last run succeeded</span>;
  if (status === 'failed')  return <span className="inline-flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="w-3 h-3" /> Last run failed</span>;
  return <span className="text-[11px] text-app-text-secondary">Idle</span>;
}

/* ── Step-by-step setup guide ──────────────────────────────────
   Each provider's console has a lot of unrelated panels — the user
   shouldn't have to figure out which clicks matter. We show a tight
   numbered checklist with copy-button shortcuts for the values they
   need to paste back. Collapsible so it doesn't dominate the tab. */

const DROPBOX_STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'Open the Dropbox App Console',
    body: (
      <>
        Go to{' '}
        <a className="text-app-accent underline" href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer">
          dropbox.com/developers/apps
        </a>{' '}
        and click <b>Create app</b>.
      </>
    ),
  },
  {
    title: 'Choose API + access type',
    body: (
      <ul className="list-disc pl-4 space-y-0.5">
        <li>Choose <b>Scoped access</b>.</li>
        <li>Type of access: <b>App folder</b> (recommended — sandboxes our files) or <b>Full Dropbox</b>.</li>
        <li>Give it any name (e.g. <code>OneClickz Backup</code>) → <b>Create app</b>.</li>
      </ul>
    ),
  },
  {
    title: 'Open the Permissions tab',
    body: (
      <>
        On the app's settings page, click the <b>Permissions</b> tab and tick:
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li><code>files.content.write</code></li>
          <li><code>files.content.read</code></li>
          <li><code>files.metadata.read</code></li>
        </ul>
        Then click <b>Submit</b> at the bottom of that tab.
        <div className="mt-1 text-amber-600 text-[11px]">
          ⚠️ Important: set permissions BEFORE generating the token — the token only carries permissions that existed when it was issued.
        </div>
      </>
    ),
  },
  {
    title: 'Generate an access token',
    body: (
      <>
        Switch to the <b>Settings</b> tab → scroll to <b>OAuth 2 → Generated access token</b> →
        change <b>Access token expiration</b> to <b>No expiration</b> (or "Short-lived" for testing) →
        click <b>Generate</b>.
      </>
    ),
  },
  {
    title: 'Paste it into the token field above',
    body: (
      <>
        Copy the token (it looks like <code className="break-all">sl.B…long-string…</code>) and paste it into the
        Access token field above. Your <b>Remote folder</b> can stay as the default <code>/dcm-backups</code>;
        Dropbox will create it on first upload.
      </>
    ),
  },
];

const GOOGLE_STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: '1. Create a Google Cloud project',
    body: (
      <>
        Go to{' '}
        <a className="text-app-accent underline" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
          console.cloud.google.com → New Project
        </a>.
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>Project name: <b>MediView Backup</b> (or any name you like).</li>
          <li>Organization: leave as <b>No organization</b> (for personal accounts).</li>
          <li>Click <b>Create</b> and wait a few seconds for it to be ready.</li>
          <li>Make sure the new project is selected in the top-left dropdown.</li>
        </ul>
      </>
    ),
  },
  {
    title: '2. Enable the Google Drive API',
    body: (
      <>
        Open{' '}
        <a className="text-app-accent underline" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer">
          APIs &amp; Services → Library → Google Drive API
        </a>{' '}
        and click <b>Enable</b>.
        <div className="mt-1 text-[11px] text-app-text-secondary">
          If the button says "Manage" instead of "Enable", it's already on — skip to the next step.
        </div>
      </>
    ),
  },
  {
    title: '3. Configure the OAuth consent screen',
    body: (
      <>
        Go to{' '}
        <a className="text-app-accent underline" href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer">
          APIs &amp; Services → OAuth consent screen
        </a>.
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>User type: select <b>External</b> → click <b>Create</b>.</li>
          <li>App name: <b>MediView Backup</b>.</li>
          <li>User support email: select <b>your Gmail address</b>.</li>
          <li>Developer contact: enter <b>your email</b> again → click <b>Save and Continue</b>.</li>
        </ul>
      </>
    ),
  },
  {
    title: '4. Add the Drive scope',
    body: (
      <>
        On the <b>Scopes</b> step (you'll land here after saving the consent screen):
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>Click <b>Add or Remove Scopes</b>.</li>
          <li>In the filter box type <code>drive.file</code>.</li>
          <li>Tick <code>https://www.googleapis.com/auth/drive.file</code> → click <b>Update</b>.</li>
          <li>Click <b>Save and Continue</b>.</li>
        </ul>
      </>
    ),
  },
  {
    title: '5. Add yourself as a test user',
    body: (
      <>
        On the <b>Test users</b> step:
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>Click <b>Add Users</b>.</li>
          <li>Enter <b>your own Gmail address</b> (the one that owns Google Drive).</li>
          <li>Click <b>Add</b> → <b>Save and Continue</b> → <b>Back to Dashboard</b>.</li>
        </ul>
        <div className="mt-1 text-amber-600 text-[11px]">
          ⚠️ Without adding yourself as a test user, the OAuth flow will refuse to sign you in.
        </div>
      </>
    ),
  },
  {
    title: '6. Create OAuth Client ID credentials',
    body: (
      <>
        Go to{' '}
        <a className="text-app-accent underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
          APIs &amp; Services → Credentials
        </a>.
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>Click <b>+ Create Credentials</b> → <b>OAuth client ID</b>.</li>
          <li>Application type: <b>Web application</b>.</li>
          <li>Name: <b>MediView Backup Client</b> (any name).</li>
          <li>Under <b>Authorized redirect URIs</b>, click <b>Add URI</b> and enter:<br />
            <code className="break-all select-all">https://developers.google.com/oauthplayground</code>
          </li>
          <li>Click <b>Create</b>.</li>
          <li>A popup shows your <b>Client ID</b> and <b>Client secret</b> — <b>copy both</b> and keep them handy.</li>
        </ul>
      </>
    ),
  },
  {
    title: '7. Get an access token via OAuth Playground',
    body: (
      <>
        Open the{' '}
        <a className="text-app-accent underline" href="https://developers.google.com/oauthplayground/" target="_blank" rel="noreferrer">
          Google OAuth Playground
        </a>:
        <ul className="list-disc pl-4 space-y-0.5 mt-1">
          <li>Click the <b>⚙ gear icon</b> (top-right) → tick <b>Use your own OAuth credentials</b>.</li>
          <li>Paste your <b>Client ID</b> and <b>Client secret</b> from step 6.</li>
          <li><b>Step 1</b> (left panel): scroll to <b>Drive API v3</b>, expand it and tick <code>https://www.googleapis.com/auth/drive.file</code>.</li>
          <li>Click <b>Authorize APIs</b> → sign in with the Gmail you added as a test user → click <b>Continue</b> (even if Google warns "unverified app") → <b>Allow</b>.</li>
          <li><b>Step 2</b>: click <b>Exchange authorization code for tokens</b>.</li>
          <li>Copy the <b>Access token</b> (starts with <code>ya29.…</code>).</li>
        </ul>
      </>
    ),
  },
  {
    title: '8. Paste the access token above',
    body: (
      <>
        Paste the <b>Access token</b> into the token field above. Set <b>Remote folder</b> to any name (default <code>/dcm-backups</code>).
        <div className="mt-1 text-amber-600 text-[11px]">
          ⚠️ Google access tokens expire after ~1 hour. For longer use, go back to OAuth Playground Step 2 and click
          <b> Refresh access token</b> to get a new one. For fully unattended auto-sync, Dropbox (no-expiry tokens) is recommended.
        </div>
      </>
    ),
  },
];

function SetupGuide({ provider }: { provider: CloudProvider }) {
  const [open, setOpen] = useState(true);
  if (provider === 'none') return null;
  const steps = provider === 'dropbox' ? DROPBOX_STEPS : GOOGLE_STEPS;
  const title = provider === 'dropbox' ? 'How to generate a Dropbox access token' : 'How to generate a Google Drive access token';

  return (
    <div className="rounded border border-app-accent/40 bg-app-accent/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-accent"
      >
        <span>{open ? '▾' : '▸'}  {title}</span>
        <ExternalLink className="w-3 h-3" />
      </button>
      {open && (
        <ol className="px-4 pb-3 pt-1 space-y-2 text-[11px] leading-relaxed text-app-text">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-app-accent text-white font-bold text-[10px]">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="font-semibold text-app-text">{s.title}</div>
                <div className="text-app-text-secondary mt-0.5">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
