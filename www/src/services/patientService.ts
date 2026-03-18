import { api } from '@/services/api';
import type { Patient, PatientFilters } from '@/types/patient';

// Response types matching PHP API
interface PatientListResponse {
  success: boolean;
  data: ApiPatient[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  filters_applied: Record<string, string | number>;
}

interface ApiPatient {
  patient_id: string;
  patient_name: string;
  patient_sex: string;
  birth_date: string | null;
  study_count: number;
  last_study_date: string;
  orthanc_id: string;
  age: number | null;
  modalities: string | null;
  study_names: string | null;
}

interface PatientStudiesResponse {
  success: boolean;
  studies: Array<{
    orthanc_id: string;
    study_instance_uid: string;
    study_description: string;
    study_date: string;
    modality: string;
  }>;
}

// Convert API date formats
function formatDateForApi(dateStr: string, preset: string): { from: string; to: string } {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  switch (preset) {
    case 'today':
      return { from: formatDate(today), to: formatDate(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: formatDate(yesterday), to: formatDate(yesterday) };
    }
    case 'yesterdayAndToday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: formatDate(yesterday), to: formatDate(today) };
    }
    case 'last7days': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { from: formatDate(weekAgo), to: formatDate(today) };
    }
    default:
      return { from: '', to: '' };
  }
}

// Map API patient to our Patient interface
function mapApiPatient(apiPatient: ApiPatient): Patient {
  const studyDesc = apiPatient.study_names?.split('|')[0] || '';
  const age = apiPatient.age !== null ? `${apiPatient.age}Y` : '';

  // Format date from YYYY-MM-DD or YYYYMMDD to DD-MM-YYYY
  let formattedDate = '';
  if (apiPatient.last_study_date) {
    const d = apiPatient.last_study_date.replace(/-/g, '');
    if (d.length === 8) {
      formattedDate = `${d.slice(6, 8)}-${d.slice(4, 6)}-${d.slice(0, 4)}`;
    } else {
      // Try parsing as date string
      const date = new Date(apiPatient.last_study_date);
      if (!isNaN(date.getTime())) {
        formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
      }
    }
  }

  return {
    id: apiPatient.orthanc_id || apiPatient.patient_id,
    patientId: apiPatient.patient_id,
    patientName: apiPatient.patient_name || '',
    age,
    sex: (apiPatient.patient_sex?.charAt(0)?.toUpperCase() as 'M' | 'F' | 'O') || '',
    studyDate: formattedDate,
    studyDescription: studyDesc,
    images: apiPatient.study_count || 0,
    modality: apiPatient.modalities || 'US',
    accessionNumber: '',
    referringPhysician: '',
    printed: false,
    orthancId: apiPatient.orthanc_id,
  };
}

export const patientService = {
  /**
   * Fetch patient list from PHP API
   */
  async fetchPatients(
    filters: PatientFilters,
    page: number = 1,
    perPage: number = 50,
    sortBy: string = 'date'
  ): Promise<{
    patients: Patient[];
    pagination: PatientListResponse['pagination'];
  }> {
    // Build query parameters
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    params.set('sortBy', sortBy);

    if (filters.patientId) params.set('patientId', filters.patientId);
    if (filters.patientName) params.set('name', filters.patientName);
    if (filters.modality) params.set('modality', filters.modality);
    if (filters.studyDescription) params.set('studyName', filters.studyDescription);

    // Date range
    if (filters.dateRange && filters.dateRange !== 'all') {
      if (filters.dateRange === 'custom') {
        if (filters.fromDate) params.set('studyDateFrom', filters.fromDate);
        if (filters.toDate) params.set('studyDateTo', filters.toDate);
      } else {
        const { from, to } = formatDateForApi('', filters.dateRange);
        if (from) params.set('studyDateFrom', from);
        if (to) params.set('studyDateTo', to);
      }
    }

    const response = await api.raw<PatientListResponse>(
      `patient_list_api.php?${params.toString()}`
    );

    return {
      patients: response.data.map(mapApiPatient),
      pagination: response.pagination,
    };
  },

  /**
   * Get studies for a specific patient
   */
  async getPatientStudies(patientId: string) {
    const response = await api.raw<PatientStudiesResponse>(
      `patient_list_api.php?get_studies=1&patient_id=${encodeURIComponent(patientId)}`
    );
    return response.studies;
  },

  /**
   * Delete a patient
   */
  async deletePatient(patientId: string) {
    return api.post('patient/delete-patient.php', { patient_id: patientId });
  },

  /**
   * Edit patient info
   */
  async editPatient(patientId: string, updates: Record<string, string>) {
    return api.post('patient/edit-patient.php', { patient_id: patientId, ...updates });
  },

  /**
   * Delete studies older than N months
   */
  async deleteOldStudies(months: number) {
    return api.post('patient/delete-studies.php', { months_old: months });
  },

  /**
   * Backup selected patients/studies
   */
  async backupStudies(patientIds: string[]) {
    return api.post('patient/backup-studies.php', { patient_ids: patientIds });
  },

  /**
   * Upload DICOM study
   */
  async uploadStudy(formData: FormData) {
    return api.upload('patient/upload-study.php', formData);
  },
};
