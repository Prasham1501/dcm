/// <reference types="vite/client" />

interface ElectronAPI {
  isElectron: boolean;
  isDesktop: boolean;
  platform: string;
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };
  getSystemPrinters: () => Promise<{ success: boolean; printers: SystemPrinter[]; error?: string }>;
  printToPrinter: (options: PrintOptions) => Promise<{ success: boolean; error?: string }>;
  printCurrentToPrinter: (options: PrintOptions) => Promise<{ success: boolean; error?: string }>;
  printReportDialog: (options: Record<string, unknown>) => Promise<{ success: boolean; error?: string; pdfPath?: string }>;
  focusMainWindow: () => Promise<{ success: boolean; error?: string }>;
  saveCredentials: (credentials: SavedCredentials) => Promise<{ success: boolean; error?: string }>;
  getCredentials: () => Promise<{ success: boolean; credentials?: SavedCredentials; error?: string }>;
  clearCredentials: () => Promise<{ success: boolean; error?: string }>;
  hasAutoLoginCredentials: () => Promise<{ success: boolean; hasCredentials: boolean }>;
  dicomAccessToken?: string;
  showOpenDialog: (options: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[]; error?: string }>;
  readFileBuffer: (filePath: string) => Promise<ArrayBuffer>;
  listImageFiles: (folderPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
  listDicomFiles: (folderPath: string) => Promise<{ success: boolean; files: string[]; error?: string }>;
  markPatientPrinted: (payload: { patientId?: string; patientName?: string }) => Promise<{ success: boolean; error?: string }>;
  getNetworkDicomPath: () => Promise<any>;
  setNetworkDicomPath: (newPath: string) => Promise<any>;
  restartNetworkReceiver: () => Promise<any>;
  getReceivedDicomFiles: () => Promise<any>;
  openFolder: (folderPath: string) => Promise<any>;
  openVolumeViewer: (params: Record<string, unknown>) => Promise<any>;
  openVolumeInBrowser: (payload: Record<string, unknown>) => Promise<any>;
  extractDicomMetadata: (payload: { filePaths: string[] }) => Promise<any>;
  extractDicomAllReadings: (payload: { filePaths: string[] }) => Promise<any>;
  extractDicomText: (payload: { filePaths: string[] }) => Promise<any>;
  ocrDicomBatch: (payload: { filePaths: string[] }) => Promise<Array<{ text: string; success: boolean }>>;
  ocrDicomFile: (payload: { filePath: string }) => Promise<any>;
  ocrImageBase64: (payload: { base64: string; langPath?: string }) => Promise<any>;
  onOpenQuotaSettings: (cb: () => void) => () => void;
  onUpdateInfo: (cb: (info: any) => void) => () => void;
  onViewerReloadLaunch: (cb: () => void) => () => void;
  onCRViewerReloadLaunch: (cb: () => void) => () => void;
  onVolumeViewerReloadLaunch: (cb: () => void) => () => void;
  onDicomFileReceived: (cb: (data: any) => void) => () => void;
  onPatientPrinted: (cb: (data: { patientId: string; patientName: string }) => void) => () => void;
}

interface SystemPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
  options: Record<string, unknown>;
}

interface PrintOptions {
  printerName?: string;
  htmlContent?: string;
  printSettings?: {
    paperSize?: string;
    orientation?: string;
    colorMode?: string;
    copies?: number;
    margins?: string;
  };
}

interface SavedCredentials {
  username: string;
  token: string;
  userId: number;
}

interface Window {
  electronAPI?: ElectronAPI;
}
