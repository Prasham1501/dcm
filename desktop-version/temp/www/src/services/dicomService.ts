import { api } from '@/services/api';

interface DicomActivity {
  success: boolean;
  activities: Array<{
    id: number;
    action: string;
    study_uid: string;
    patient_name: string;
    timestamp: string;
    details: string;
  }>;
}

interface MeasurementData {
  study_uid: string;
  series_uid: string;
  instance_uid: string;
  measurement_type: string;
  tool_name: string;
  value: number;
  unit: string;
  data_json: string;
}

export const dicomService = {
  /**
   * Get DICOM activity log
   */
  async getActivity(): Promise<DicomActivity> {
    return api.raw('dicom/activity.php');
  },

  /**
   * Echo (ping) a DICOM node to test connectivity
   */
  async echoNode(nodeId: number) {
    return api.post('dicom/echo-node.php', { node_id: nodeId });
  },

  /**
   * Send study to a DICOM node
   */
  async sendToNode(studyUID: string, nodeId: number) {
    return api.post('dicom/send-to-node.php', {
      study_uid: studyUID,
      node_id: nodeId,
    });
  },

  /**
   * Send test image to verify connectivity
   */
  async sendTestImage(nodeId: number) {
    return api.post('dicom/send-test-image.php', { node_id: nodeId });
  },

  /**
   * Extract measurements from DICOM structured reports
   */
  async extractMeasurements(studyUID: string) {
    return api.raw(
      `dicom/extract-measurements.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Get measurements for a series
   */
  async getMeasurementsBySeries(seriesUID: string) {
    return api.raw(
      `measurements/by-series.php?seriesUID=${encodeURIComponent(seriesUID)}`
    );
  },

  /**
   * Save a measurement annotation
   */
  async createMeasurement(data: MeasurementData) {
    return api.post('measurements/create.php', data);
  },

  /**
   * Delete a measurement
   */
  async deleteMeasurement(id: number) {
    return api.post('measurements/delete.php', { id });
  },

  /**
   * Load study fast (optimized endpoint)
   */
  async loadStudyFast(studyUID: string) {
    return api.raw(
      `load_study_fast.php?studyUID=${encodeURIComponent(studyUID)}`
    );
  },

  /**
   * Get DICOM from Orthanc by orthanc ID
   */
  async getFromOrthanc(orthancId: string) {
    return api.raw(
      `get_dicom_from_orthanc.php?id=${encodeURIComponent(orthancId)}`
    );
  },

  /**
   * Get study notes
   */
  async getNotes(studyUID: string) {
    return api.raw(`notes/by-study.php?study_uid=${encodeURIComponent(studyUID)}`);
  },

  /**
   * Create a note
   */
  async createNote(studyUID: string, content: string) {
    return api.post('notes/create.php', { study_uid: studyUID, content });
  },

  /**
   * Update a note
   */
  async updateNote(noteId: number, content: string) {
    return api.post('notes/update.php', { id: noteId, content });
  },

  /**
   * Delete a note
   */
  async deleteNote(noteId: number) {
    return api.post('notes/delete.php', { id: noteId });
  },
};

export type { MeasurementData };
