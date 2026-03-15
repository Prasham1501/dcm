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
  focusMainWindow: () => Promise<{ success: boolean; error?: string }>;
  saveCredentials: (credentials: SavedCredentials) => Promise<{ success: boolean; error?: string }>;
  getCredentials: () => Promise<{ success: boolean; credentials?: SavedCredentials; error?: string }>;
  clearCredentials: () => Promise<{ success: boolean; error?: string }>;
  hasAutoLoginCredentials: () => Promise<{ success: boolean; hasCredentials: boolean }>;
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
