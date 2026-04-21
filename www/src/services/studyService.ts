import { api } from '@/services/api';

// Response types matching PHP APIs
interface StudyListResponse {
  success: boolean;
  patient: {
    patient_id: string;
    patient_name: string;
    patient_sex: string;
    patient_birth_date: string;
    study_count: number;
    last_study_date: string;
    orthanc_id: string;
  };
  studies: ApiStudy[];
  count: number;
}

interface ApiStudy {
  orthanc_id: string;
  study_instance_uid: string;
  study_description: string;
  study_date: string;
  study_time: string;
  modality: string;
  patient_id: string;
  series_count?: number;
  instance_count?: number;
  study_name?: string;
  remarks_count: number;
  latest_remark: string | null;
}

interface SeriesResponse {
  success: boolean;
  data: ApiSeries[];
  count: number;
}

interface ApiSeries {
  series_uid: string;
  series_description: string;
  series_number: number;
  modality: string;
  instance_count: number;
  orthanc_id: string;
}

interface InstanceResponse {
  success: boolean;
  data: ApiInstance[];
  count: number;
}

interface ApiInstance {
  instance_uid: string;
  instance_number: number;
  orthanc_id: string;
  rows?: number;
  columns?: number;
}

export const studyService = {
  /**
   * Get all studies for a patient
   */
  async getStudies(patientId: string): Promise<StudyListResponse> {
    return api.raw<StudyListResponse>(
      `study_list_api.php?patient_id=${encodeURIComponent(patientId)}`
    );
  },

  /**
   * Get series for a study
   */
  async getSeries(studyUID: string): Promise<SeriesResponse> {
    return api.raw<SeriesResponse>(
      `dicomweb/series.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Get instances for a series
   */
  async getInstances(studyUID: string, seriesUID: string): Promise<InstanceResponse> {
    return api.raw<InstanceResponse>(
      `dicomweb/instances.php?studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}`
    );
  },

  /**
   * Get study metadata
   */
  async getStudyMetadata(studyUID: string) {
    return api.raw(
      `dicomweb/study-metadata.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Get DICOM instance image file URL (for Cornerstone.js)
   */
  getInstanceImageUrl(studyUID: string, seriesUID: string, instanceUID: string): string {
    return `/api/dicomweb/instance-file.php?studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}&instanceUID=${encodeURIComponent(instanceUID)}`;
  },

  /**
   * Get instance image as blob (for thumbnail rendering)
   */
  async getInstanceBlob(studyUID: string, seriesUID: string, instanceUID: string): Promise<Blob> {
    return api.blob(
      `dicomweb/instance-file.php?studyUID=${encodeURIComponent(studyUID)}&seriesUID=${encodeURIComponent(seriesUID)}&instanceUID=${encodeURIComponent(instanceUID)}`
    );
  },

  /**
   * Mark study as read/opened
   */
  async markRead(studyUID: string) {
    return api.post('studies/mark-read.php', { study_uid: studyUID });
  },

  /**
   * Merge multiple studies into one
   */
  async mergeStudies(studyUIDs: string[], targetStudyUID: string) {
    return api.post('studies/merge-studies.php', {
      study_uids: studyUIDs,
      target_study_uid: targetStudyUID,
    });
  },

  /**
   * Export study images
   */
  async exportImages(studyUID: string, format: 'jpeg' | 'png' | 'dicom' = 'jpeg') {
    return api.raw(
      `studies/export-images.php?studyUID=${encodeURIComponent(studyUID)}&format=${format}`
    );
  },

  /**
   * Get/set study remarks
   */
  async getRemarks(studyUID: string) {
    return api.raw(`studies/remarks.php?study_uid=${encodeURIComponent(studyUID)}`);
  },

  async addRemark(studyUID: string, remark: string) {
    return api.post('studies/remarks.php', { study_uid: studyUID, remark });
  },

  /**
   * Update referring physician
   */
  async updateReferredBy(studyUID: string, referredBy: string) {
    return api.post('studies/update-referred-by.php', {
      study_uid: studyUID,
      referred_by: referredBy,
    });
  },

  /**
   * Get/create prescriptions
   */
  async getPrescription(studyUID: string) {
    return api.raw(`prescriptions/get.php?study_uid=${encodeURIComponent(studyUID)}`);
  },

  async createPrescription(data: {
    study_uid: string;
    patient_id: string;
    patient_name: string;
    prescription_text: string;
    doctor_name: string;
  }) {
    return api.post('prescriptions/create.php', data);
  },

  async deletePrescription(id: number) {
    return api.post('prescriptions/delete.php', { id });
  },
};
