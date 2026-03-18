import { api } from '@/services/api';

interface BackupInfo {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  patient_count: number;
  study_count: number;
  status: 'completed' | 'in_progress' | 'failed';
}

interface BackupStats {
  total_backups: number;
  total_size: number;
  last_backup: string | null;
  storage_used: string;
}

export const backupService = {
  /**
   * List all backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const response = await api.raw('backup/list-backups.php');
    return response.backups || [];
  },

  /**
   * Create a new backup
   */
  async createBackup(patientIds?: string[]) {
    return api.post('backup/create-backup.php', {
      patient_ids: patientIds,
    });
  },

  /**
   * Trigger immediate backup
   */
  async backupNow() {
    return api.post('backup/backup-now.php');
  },

  /**
   * Restore from backup
   */
  async restore(backupId: number) {
    return api.post('backup/restore.php', { backup_id: backupId });
  },

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: number) {
    return api.post('backup/delete.php', { backup_id: backupId });
  },

  /**
   * Get backup status
   */
  async getStatus() {
    return api.raw('backup/status.php');
  },

  /**
   * Get backup statistics
   */
  async getStats(): Promise<BackupStats> {
    const response = await api.raw('backup/get-backup-stats.php');
    return response.stats || response;
  },

  /**
   * Cleanup old backups
   */
  async cleanupOld(olderThanDays: number) {
    return api.post('backup/cleanup-old.php', { older_than_days: olderThanDays });
  },

  /**
   * Get backup schedule info
   */
  async getScheduleInfo() {
    return api.raw('backup/get-schedule-info.php');
  },

  /**
   * Update backup schedule
   */
  async updateSchedule(schedule: {
    enabled: boolean;
    interval_hours: number;
    time: string;
    keep_count: number;
  }) {
    return api.post('backup/update-schedule.php', schedule);
  },

  /**
   * Backup all accounts (super admin)
   */
  async backupAllAccounts() {
    return api.post('backup/backup-all-accounts.php');
  },
};

export type { BackupInfo, BackupStats };
