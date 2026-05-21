export type PaperSize = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
/** Where a footer field appears (or 'none' to hide). */
export type FooterSlotPos = 'none' | 'left' | 'center' | 'right';
/** Legacy single-item slot type. Migrations expand it to an array. */
export type PrintSlotContent =
  | 'logo' | 'name' | 'services' | 'address' | 'phone' | 'email' | 'website' | 'custom' | 'none';

export interface FooterSlotItem {
  type: PrintSlotContent;
  /** Only used when type === 'custom'. */
  customText?: string;
}

export interface HeaderFooterLayout {
  /** Each slot can stack multiple items (rendered top-to-bottom). */
  left: FooterSlotItem[];
  center: FooterSlotItem[];
  right: FooterSlotItem[];
}

export interface HospitalBranding {
  // Hospital identity
  hospitalName: string;
  brandNameSecondary: string;
  servicesList: string;

  // Address & contact
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;

  // Logo (base64 data URL)
  logoDataUrl: string;

  // Header section
  headerShowLogo: boolean;
  headerLogoSize: number;
  headerLogoPosition: 'left' | 'center' | 'right';
  /** @deprecated kept for backward-compat; UI no longer exposes shape. */
  headerLogoShape?: 'circle' | 'square';
  headerShowName: boolean;
  headerNameFontSize: number;
  headerNameColor: string;
  headerNameAlign: 'left' | 'center' | 'right';
  headerSecondaryNameColor: string;
  headerShowServices: boolean;
  headerServicesFontSize: number;
  headerServicesColor: string;
  headerServicesAlign: 'left' | 'center' | 'right';
  headerShowAddress: boolean;
  headerAddressFontSize: number;
  headerAddressColor: string;
  headerAddressAlign: 'left' | 'center' | 'right';
  headerShowContact: boolean;
  /** Per-field header visibility — lets the user hide e.g. Website from the
   *  header while still showing it in the footer via the slot picker. When
   *  undefined, the legacy `headerShowContact` master flag applies to all. */
  headerShowPhone?:   boolean;
  headerShowEmail?:   boolean;
  headerShowWebsite?: boolean;
  headerContactFontSize: number;
  headerContactColor: string;
  headerContactAlign: 'left' | 'center' | 'right';
  headerBgColor: string;
  headerBorderBottomColor: string;

  // Footer
  enableFooter: boolean;
  /** Per-field footer placement — single source of truth for the new UI.
   *  Each field is either 'none' or pinned to a footer column. When a slot
   *  has multiple fields they stack in canonical order (logo, name,
   *  services, address, phone, email, website, custom). */
  footerSlotName?:     FooterSlotPos;
  footerSlotServices?: FooterSlotPos;
  footerSlotAddress?:  FooterSlotPos;
  footerSlotPhone?:    FooterSlotPos;
  footerSlotEmail?:    FooterSlotPos;
  footerSlotWebsite?:  FooterSlotPos;
  footerSlotLogo?:     FooterSlotPos;
  /** Custom strings — show in their respective slots when non-empty. */
  customFooterLeft?:   string;
  customFooterCenter?: string;
  customFooterRight?:  string;
  /** Legacy free-form layout. Kept so old saved configs still render
   *  until they're re-saved through the new UI. */
  footerLayout: HeaderFooterLayout;
  footerFontSize: number;
  footerFontColor: string;
  footerBgColor: string;
  footerBorderTopColor: string;

  // Print page settings
  printBlackBg: boolean;
  printBorderEnabled: boolean;
  printBorderColor: string;
  gapBetweenImages: number;
  marginTop: number;
  marginLeft: number;
  marginRight: number;

  // Patient metadata on print
  metadataPrintPatientName: boolean;
  metadataPrintPatientId: boolean;
  metadataPrintAge: boolean;
  metadataPrintSex: boolean;
  metadataPrintModality: boolean;
  metadataPrintStudyName: boolean;
  metadataPrintAccessNo: boolean;
  metadataPrintRefBy: boolean;
}

export interface PrinterSlot {
  id: string;
  name: string;
  enabled: boolean;
  aeTitle: string;
  /** Local NIC IP to bind the SCP listener to. Defaults to 0.0.0.0. */
  bindHost: string;
  port: number;
  windowsPrinterName: string;
  paperSize: PaperSize;
  layoutId: string;
  studyDebounceSeconds: number;
  copies: number;
  /** Print-quota system (sell-by-print model). */
  quotaEnabled: boolean;
  quotaRemaining: number;
  quotaTotal: number;
}

export interface SlotHistoryEvent {
  ts: number;
  kind: 'printed' | 'failed' | 'received' | 'echo';
  remoteAddress?: string;
  remotePort?: number;
  slotName?: string;
  printer?: string;
  paperSize?: string;
  aeTitle?: string;
  port?: number;
  pages?: number;
  layoutId?: string;
  patientName?: string;
  patientId?: string;
  modality?: string;
  studyUid?: string;
  callingAE?: string;
  error?: string;
}

export interface BridgeConfig {
  version: number;
  slots: PrinterSlot[];
  startupBehavior: 'tray' | 'window';
  logRetentionDays: number;
  branding: HospitalBranding;
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
  getLocalIps: () => Promise<{ iface: string; address: string }[]>;
  getLogTail: (n?: number) => Promise<string[]>;
  getSlotHistory: (q: { slotId: string; fromTs: number; toTs: number; limit?: number }) => Promise<SlotHistoryEvent[]>;
  setSlotQuota: (q: { slotId: string; quotaEnabled?: boolean; quotaRemaining?: number; quotaTotal?: number }) => Promise<{ ok: boolean; slot?: PrinterSlot }>;
  onConfigChanged: (cb: (cfg: BridgeConfig) => void) => () => void;
  onOpenQuotaSettings: (cb: () => void) => () => void;
  onLogLine: (cb: (line: LogLine) => void) => () => void;
  onSlotEvent: (cb: (evt: SlotEvent) => void) => () => void;
  hideToTray: () => Promise<void>;
  quitApp: () => Promise<void>;

  // Branding
  saveBranding: (branding: Partial<HospitalBranding>) => Promise<HospitalBranding>;
  pickAndEncodeLogo: () => Promise<string | null>;
}

declare global {
  interface Window {
    bridgeAPI: BridgeAPI;
  }
}
