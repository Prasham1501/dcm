import { api } from '@/services/api';

interface PrintCountResponse {
  success: boolean;
  period: string;
  timestamp: number;
  counts: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    images: number;
    reports: number;
    pcpndt: number;
    pages: number;
    cost: number;
    print_jobs: number;
  };
  last_print_time: string | null;
  last_print_id: number;
  new_since?: number;
  breakdown?: Record<string, { count: number; pages: number }>;
}

interface PrintLogData {
  study_uid?: string;
  patient_id?: string;
  patient_name?: string;
  paper_size?: string;
  orientation?: string;
  copies?: number;
  pages_per_copy?: number;
  total_pages?: number;
  color_mode?: string;
  quality?: string;
  printer_name?: string;
  printer_type?: string;
  layout_type?: string;
  print_type?: 'image' | 'report';
  include_patient_info?: boolean;
  include_annotations?: boolean;
  include_measurements?: boolean;
  status?: string;
  billable?: boolean;
}

interface PrintLogResponse {
  success: boolean;
  print_log_id: number;
  print_job_id: string;
  cost: number;
}

interface PrintStatsResponse {
  success: boolean;
  stats: {
    today: number;
    week: number;
    month: number;
    total: number;
    by_printer: Record<string, number>;
    by_type: Record<string, number>;
  };
}

export const printService = {
  /**
   * Get print count for badge display
   */
  async getCount(period: 'today' | 'week' | 'month' | 'all' = 'today'): Promise<PrintCountResponse> {
    return api.raw<PrintCountResponse>(`print/count.php?period=${period}`);
  },

  /**
   * Get print count since a timestamp (for real-time updates)
   */
  async getCountSince(since: number): Promise<PrintCountResponse> {
    return api.raw<PrintCountResponse>(`print/count.php?since=${since}`);
  },

  /**
   * Log a new print job
   */
  async logPrint(data: PrintLogData): Promise<PrintLogResponse> {
    return api.raw<PrintLogResponse>('print/log.php', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  },

  /**
   * Update print job status
   */
  async updatePrintStatus(
    printJobId: string,
    status: 'printing' | 'completed' | 'failed' | 'cancelled',
    errorMessage?: string
  ) {
    return api.put('print/log.php', {
      print_job_id: printJobId,
      status,
      error_message: errorMessage,
    });
  },

  /**
   * Get print stats
   */
  async getStats(): Promise<PrintStatsResponse> {
    return api.raw<PrintStatsResponse>('print/stats.php');
  },

  /**
   * Sync offline print jobs
   */
  async syncOffline(jobs: PrintLogData[]) {
    return api.post('print/sync.php', { jobs });
  },
};

export type { PrintCountResponse, PrintLogData, PrintLogResponse };
