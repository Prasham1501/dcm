import { api } from '@/services/api';

interface SyncConfig {
  enabled: boolean;
  auto_enabled: boolean;
  interval_minutes: number;
  last_sync: string | null;
  orthanc_url: string;
}

interface SyncStatus {
  success: boolean;
  status: 'idle' | 'syncing' | 'error';
  last_sync: string | null;
  studies_synced: number;
  patients_synced: number;
  errors: string[];
}

interface ImportStatus {
  success: boolean;
  status: 'idle' | 'importing' | 'completed' | 'error';
  progress: number;
  total: number;
  imported: number;
  errors: string[];
}

export const syncService = {
  /**
   * Get sync configuration
   */
  async getConfig(): Promise<SyncConfig> {
    const response = await api.raw('sync/get-config.php');
    return response.config || response;
  },

  /**
   * Configure sync settings
   */
  async configure(config: Partial<SyncConfig>) {
    return api.post('sync/configure-sync.php', config);
  },

  /**
   * Trigger manual sync with Orthanc
   */
  async syncNow() {
    return api.post('sync/sync-now.php');
  },

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    return api.raw('sync/status.php');
  },

  /**
   * Enable/disable sync
   */
  async enableSync() {
    return api.post('sync/enable-sync.php');
  },

  async disableSync() {
    return api.post('sync/disable-sync.php');
  },

  /**
   * Enable/disable auto sync
   */
  async enableAuto() {
    return api.post('sync/enable-auto.php');
  },

  async disableAuto() {
    return api.post('sync/disable-auto.php');
  },

  /**
   * Import studies from directory
   */
  async startImport(directory: string) {
    return api.post('sync/start-import.php', { directory });
  },

  /**
   * Get import progress
   */
  async getImportStatus(): Promise<ImportStatus> {
    return api.raw('sync/import-status.php');
  },

  /**
   * Cancel running import
   */
  async cancelImport() {
    return api.post('sync/cancel-import.php');
  },

  /**
   * Scan directory for DICOM files
   */
  async scanDirectory(path: string) {
    return api.post('sync/scan-directory.php', { path });
  },

  /**
   * Scan for new files in configured directories
   */
  async scanNewFiles() {
    return api.post('sync/scan-new-files.php');
  },

  /**
   * Get import history
   */
  async getImportHistory() {
    return api.raw('sync/get-import-history.php');
  },

  /**
   * Sync Orthanc studies to local cache
   */
  async syncOrthancToCache() {
    return api.raw('sync_orthanc_api.php');
  },
};

export type { SyncConfig, SyncStatus, ImportStatus };
