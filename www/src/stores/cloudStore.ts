/**
 * Cloud-backup configuration.
 *
 *  Stores the operator's choice of provider (Dropbox / Google Drive), the
 *  access token they pasted in, what gets backed up (reports, DICOM files,
 *  templates, branding), and the auto-sync schedule. Backup runs are
 *  orchestrated by the server endpoint at /api/cloud/backup.php; this
 *  store only holds the config + the last-run record.
 *
 *  Tokens never leave the user's browser localStorage — the server gets
 *  them per-request when the user clicks "Sync now" or when the
 *  client-side auto-sync timer fires.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CloudProvider = 'none' | 'dropbox' | 'google';

/** What to include in each backup bundle. */
export interface BackupScopes {
  reports:   boolean;
  dicom:     boolean;
  templates: boolean;
  branding:  boolean;
}

/** Auto-sync interval — picked from a fixed dropdown so the back-end can
 *  reason about it without parsing free text. */
export type SyncInterval = 'off' | 'hourly' | 'daily' | 'weekly';

export interface CloudConfig {
  provider:    CloudProvider;
  accessToken: string;
  /** Optional folder/path inside the provider where bundles are uploaded.
   *  Defaults to "/dcm-backups" so the user can find them quickly. */
  remoteFolder: string;
  scopes:      BackupScopes;
  syncInterval: SyncInterval;
  /** Epoch ms of the most recent successful sync (any run that returned ok). */
  lastSyncAt:  number | null;
  /** Last run's status — surfaced in the tab. */
  lastStatus:  'idle' | 'running' | 'ok' | 'failed';
  lastError:   string;
  /** Normalised file paths that have been successfully synced to the cloud.
   *  Key = forward-slash path, value = epoch ms when synced. Used for
   *  incremental backup — only files NOT in this map are uploaded. */
  syncedFiles: Record<string, number>;
  setProvider:    (p: CloudProvider) => void;
  setAccessToken: (t: string) => void;
  setRemoteFolder:(f: string) => void;
  setScope:       (k: keyof BackupScopes, v: boolean) => void;
  setSyncInterval:(i: SyncInterval) => void;
  setRunStatus:   (s: 'running' | 'ok' | 'failed', error?: string) => void;
  markSynced:     () => void;
  /** Record newly synced file paths after a successful backup. */
  recordSyncedFiles: (files: string[]) => void;
  /** Wipe the sync-tracking cache so the next run uploads everything. */
  clearSyncHistory: () => void;
}

const DEFAULT_SCOPES: BackupScopes = {
  reports:   true,
  dicom:     true,
  templates: true,
  branding:  false,
};

export const useCloudStore = create<CloudConfig>()(
  persist(
    (set) => ({
      provider:     'none',
      accessToken:  '',
      remoteFolder: '/dcm-backups',
      scopes:       { ...DEFAULT_SCOPES },
      syncInterval: 'off',
      lastSyncAt:   null,
      lastStatus:   'idle',
      lastError:    '',
      syncedFiles:  {},

      setProvider:     (provider) => set((s) => ({
        provider,
        // Clear sync history when switching providers — old tracking is
        // irrelevant for a different destination.
        syncedFiles: provider !== s.provider ? {} : s.syncedFiles,
      })),
      setAccessToken:  (accessToken) => set({ accessToken }),
      setRemoteFolder: (remoteFolder) => set({ remoteFolder }),
      setScope:        (key, value) => set((s) => ({ scopes: { ...s.scopes, [key]: value } })),
      setSyncInterval: (syncInterval) => set({ syncInterval }),
      setRunStatus:    (lastStatus, error) => set({ lastStatus, lastError: error ?? '' }),
      markSynced:      () => set({ lastSyncAt: Date.now(), lastStatus: 'ok', lastError: '' }),
      recordSyncedFiles: (files) => set((s) => {
        const now = Date.now();
        const next = { ...s.syncedFiles };
        for (const f of files) {
          const norm = f.replace(/\\/g, '/');
          if (norm) next[norm] = now;
        }
        return { syncedFiles: next };
      }),
      clearSyncHistory: () => set({ syncedFiles: {} }),
    }),
    {
      name: 'dcm-cloud-config',
      // Don't persist transient run-state fields across reloads.
      partialize: (s) => ({
        provider:     s.provider,
        accessToken:  s.accessToken,
        remoteFolder: s.remoteFolder,
        scopes:       s.scopes,
        syncInterval: s.syncInterval,
        lastSyncAt:   s.lastSyncAt,
        syncedFiles:  s.syncedFiles,
      }),
    },
  ),
);

/** Convert SyncInterval enum into milliseconds (0 = disabled). */
export function intervalMs(i: SyncInterval): number {
  switch (i) {
    case 'hourly': return 60 * 60 * 1000;
    case 'daily':  return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    default:       return 0;
  }
}
