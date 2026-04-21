import { api } from '@/services/api';

// Types matching PHP API response
interface ApiReport {
  id: number;
  study_uid: string;
  patient_id: string;
  patient_name: string;
  template_name: string;
  title: string;
  indication: string;
  technique: string;
  findings: string;
  impression: string;
  status: 'draft' | 'final' | 'amended';
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  created_by_id: number;
  created_by_name: string;
  created_by_username: string;
  reporting_physician_id: number | null;
  reporting_physician_name: string | null;
  reporting_physician_username: string | null;
}

interface ReportsByStudyResponse {
  success: boolean;
  data: {
    study_uid: string;
    count: number;
    reports: ApiReport[];
  };
  message: string;
}

interface CreateReportData {
  study_uid: string;
  patient_id: string;
  patient_name: string;
  template_name: string;
  title: string;
  indication?: string;
  technique?: string;
  findings: string;
  impression: string;
  reporting_physician_id?: number;
  status?: 'draft' | 'final';
}

interface UpdateReportData {
  id: number;
  title?: string;
  indication?: string;
  technique?: string;
  findings?: string;
  impression?: string;
  reporting_physician_id?: number;
  status?: 'draft' | 'final' | 'amended';
}

export const reportService = {
  /**
   * Get all reports for a study
   */
  async getByStudy(studyUID: string): Promise<ApiReport[]> {
    const response = await api.raw<ReportsByStudyResponse>(
      `reports/by-study.php?studyUID=${encodeURIComponent(studyUID)}`
    );
    return response.data?.reports || [];
  },

  /**
   * Get a single report by ID
   */
  async getById(reportId: number): Promise<ApiReport> {
    const response = await api.raw(
      `reports/by-id.php?id=${reportId}`
    );
    return response.data?.report || response.report;
  },

  /**
   * Create a new report
   */
  async create(data: CreateReportData) {
    return api.post('reports/create.php', data);
  },

  /**
   * Update an existing report
   */
  async update(data: UpdateReportData) {
    return api.post('reports/update.php', data);
  },

  /**
   * Delete a report
   */
  async deleteReport(reportId: number) {
    return api.post('reports/delete.php', { id: reportId });
  },

  /**
   * Update report status (draft -> final, etc.)
   */
  async updateStatus(reportId: number, status: 'draft' | 'final' | 'amended') {
    return api.post('reports/update-status.php', { id: reportId, status });
  },

  /**
   * Get report versions/history
   */
  async getVersions(reportId: number) {
    return api.raw(`reports/versions.php?id=${reportId}`);
  },

  /**
   * Generate an obstetric report from measurements
   */
  async generateObstetricReport(studyUID: string) {
    return api.raw(
      `reports/generate-obstetric-report.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Generate X-ray chest report
   */
  async generateXrayChestReport(studyUID: string) {
    return api.raw(
      `reports/generate-xray-chest-report.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Get hospital config for reports (header, footer, logo)
   */
  async getHospitalConfig() {
    return api.raw('reports/hospital-config.php');
  },
};
