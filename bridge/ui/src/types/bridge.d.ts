export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';

export interface PrinterSlot {
  id: string;
  name: string;
  enabled: boolean;
  aeTitle: string;
  port: number;
  windowsPrinterName: string;
  paperSize: PaperSize;
  layoutId: string;
  studyDebounceSeconds: number;
  copies: number;
}

export interface BridgeConfig {
  version: 1;
  slots: PrinterSlot[];
  startupBehavior: 'tray' | 'window';
  logRetentionDays: number;
}

export interface SystemPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface SlotStatus {
  slotId: string;
  aeTitle: string;
  port: number;
  listening: boolean;
}

export interface LogLine {
  ts: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface SlotEvent {
  type: 'file' | 'printed' | 'failed' | 'slot-error';
  payload: any;
  ts: number;
}

export interface BridgeAPI {
  isElectron: boolean;
  platform: string;
  getConfig: () => Promise<BridgeConfig>;
  setStartupBehavior: (mode: 'tray' | 'window') => Promise<BridgeConfig>;
  upsertSlot: (slot: PrinterSlot) => Promise<{ ok: boolean; errors?: string[]; config?: BridgeConfig }>;
  removeSlot: (slotId: string) => Promise<{ ok: boolean; config: BridgeConfig }>;
  newSlot: () => Promise<PrinterSlot>;
  applyConfig: () => Promise<{ ok: boolean }>;
  getSystemPrinters: () => Promise<{ success: boolean; printers: SystemPrinter[]; error?: string }>;
  getSlotStatus: () => Promise<SlotStatus[]>;
  getStartupStatus: () => Promise<{ openAtLogin: boolean }>;
  getLogTail: (n?: number) => Promise<string[]>;
  onLogLine: (cb: (line: LogLine) => void) => () => void;
  onSlotEvent: (cb: (evt: SlotEvent) => void) => () => void;
  hideToTray: () => Promise<void>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    bridgeAPI: BridgeAPI;
  }
}
