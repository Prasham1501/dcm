import { api } from '@/services/api';

interface SettingsResponse {
  success: boolean;
  settings: {
    general: Array<{
      setting_key: string;
      setting_value: string | boolean;
      is_masked: boolean;
    }>;
  };
}

interface DicomNode {
  id: number;
  name: string;
  ae_title: string;
  host_name: string;
  port: number;
  is_default: boolean;
}

interface NodesResponse {
  success: boolean;
  nodes: DicomNode[];
}

interface PrinterInfo {
  name: string;
  driver: string;
  port: string;
  is_default: boolean;
  status: string;
}

export const settingsService = {
  /**
   * Get all system settings
   */
  async getSettings(): Promise<Record<string, string | boolean>> {
    const response = await api.raw<SettingsResponse>('settings/get-settings.php');
    const settingsMap: Record<string, string | boolean> = {};
    if (response.settings?.general) {
      for (const item of response.settings.general) {
        settingsMap[item.setting_key] = item.setting_value;
      }
    }
    return settingsMap;
  },

  /**
   * Update settings (key-value pairs)
   */
  async updateSettings(settings: Record<string, string | boolean>) {
    return api.post('settings/update-settings.php', { settings });
  },

  /**
   * Get DICOM nodes
   */
  async getNodes(): Promise<DicomNode[]> {
    const response = await api.raw<NodesResponse>('settings/nodes.php');
    return response.nodes || [];
  },

  /**
   * Add/update a DICOM node
   */
  async saveNode(node: Omit<DicomNode, 'id'> & { id?: number }) {
    return api.post('settings/nodes.php', node);
  },

  /**
   * Delete a DICOM node
   */
  async deleteNode(nodeId: number) {
    return api.del('settings/nodes.php', { id: nodeId });
  },

  /**
   * Detect available printers
   */
  async detectPrinters(): Promise<PrinterInfo[]> {
    const response = await api.raw('settings/detect-printers.php');
    return response.printers || [];
  },

  /**
   * Get print settings
   */
  async getPrintSettings() {
    return api.raw('settings/print-settings.php');
  },

  /**
   * Update print settings
   */
  async updatePrintSettings(settings: Record<string, any>) {
    return api.post('settings/print-settings.php', settings);
  },

  /**
   * Get hospital printers
   */
  async getHospitalPrinters() {
    return api.raw('settings/hospital-printers.php');
  },

  /**
   * Get clinic settings
   */
  async getClinicSettings() {
    return api.raw('settings/clinic-settings.php');
  },

  /**
   * Update clinic settings
   */
  async updateClinicSettings(settings: Record<string, any>) {
    return api.post('settings/clinic-settings.php', settings);
  },

  /**
   * Upload hospital logo
   */
  async uploadLogo(formData: FormData) {
    return api.upload('settings/upload-logo.php', formData);
  },

  /**
   * Check initial setup status
   */
  async checkSetup() {
    return api.raw('settings/check-setup.php');
  },

  /**
   * Update Orthanc PACS config
   */
  async updateOrthancConfig(config: { host: string; port: number; aet: string }) {
    return api.post('settings/update-orthanc-config.php', config);
  },
};

export type { DicomNode, PrinterInfo };
