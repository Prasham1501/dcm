import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { settingsService } from '@/services/settingsService';

export type PrintSlotContent = 'logo' | 'name' | 'address' | 'custom' | 'none';

export interface PrinterConfig {
  name: string;
  displayName: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
}

interface HeaderFooterLayout {
  left: PrintSlotContent;
  center: PrintSlotContent;
  right: PrintSlotContent;
}

/** Mapping from store field names to backend setting keys */
const FIELD_TO_BACKEND_KEY: Record<string, string> = {
  hospitalName: 'hospital_name',
  brandNameSecondary: 'brand_name_secondary',
  servicesList: 'services_list',
  address1: 'hospital_address1',
  address2: 'hospital_address2',
  address3: 'hospital_address3',
  city: 'hospital_city',
  state: 'hospital_state',
  pincode: 'hospital_pincode',
  phone: 'hospital_phone',
  email: 'hospital_email',
  website: 'hospital_website',
  registration: 'hospital_registration',
  timezone: 'hospital_timezone',
  logoDataUrl: 'hospital_logo',
  showLogoInHeader: 'show_logo_in_header',
  showLogoInFooter: 'show_logo_in_footer',
  customHeaderText: 'custom_header_text',
  customFooterText: 'custom_footer_text',
};

/** Reverse mapping: backend key -> store field */
const BACKEND_KEY_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_TO_BACKEND_KEY).map(([k, v]) => [v, k])
);

interface HospitalConfig {
  // Hospital info
  hospitalName: string;
  brandNameSecondary: string;
  servicesList: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  registration: string;
  timezone: string;

  // Logo (base64 data URL)
  logoDataUrl: string;

  // Print display options
  showLogoInHeader: boolean;
  showLogoInFooter: boolean;

  // Header/Footer layout
  headerLayout: HeaderFooterLayout;
  footerLayout: HeaderFooterLayout;
  enableFooter: boolean;
  customHeaderText: string;   // legacy shared field
  customFooterText: string;   // legacy shared field
  // Per-slot custom texts
  customHeaderLeft: string;
  customHeaderCenter: string;
  customHeaderRight: string;
  customFooterLeft: string;
  customFooterCenter: string;
  customFooterRight: string;

  viewportBorderColor: string; // for printing

  // Print settings
  headerFontSize: number;
  headerFontColor: string;
  footerFontSize: number;
  footerFontColor: string;
  printBlackBg: boolean;
  printBorderEnabled: boolean;
  printBorderColor: string;
  printCountWarningAt: number;
  popupOnImageReceived: boolean;
  exportFolderNameMode: 'patientName' | 'idNameGenderAge';
  modalityUS: boolean;
  metadataPrintRefBy: boolean;
  metadataPrintStudyName: boolean;
  metadataPrintAccessNo: boolean;
  metadataPrintPatientId: boolean;
  metadataPrintAge: boolean;
  metadataPrintSex: boolean;
  metadataPrintModality: boolean;

  // Header customization
  headerBgColor: string;
  headerBorderBottomColor: string;
  headerShowLogo: boolean;
  headerLogoSize: number;
  headerLogoPosition: 'left' | 'center' | 'right';
  headerLogoShape: 'circle' | 'square';
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
  headerContactFontSize: number;
  headerContactColor: string;
  headerContactAlign: 'left' | 'center' | 'right';

  // Footer customization
  footerBgColor: string;
  footerBorderTopColor: string;

  // Patient metadata display in print
  metadataPrintPatientName: boolean;
  gapBetweenImages: number;
  sixSpotsSpacing: 'equalSpace' | 'compact';
  logoLeftEnabled: boolean;
  logoLeftHeight: number;
  logoRightPath: string;
  bannerLandscapePath: string;
  marginTop: number;
  marginLeft: number;
  marginRight: number;
  marginImageTop: number;
  marginImageBottom: number;

  // Configured printers
  printers: PrinterConfig[];

  // Sync state
  syncing: boolean;
  lastSyncError: string | null;

  // Actions
  updateField: (key: string, value: any) => void;
  setLogo: (dataUrl: string) => void;
  removeLogo: () => void;
  updateHeaderLayout: (slot: keyof HeaderFooterLayout, value: PrintSlotContent) => void;
  updateFooterLayout: (slot: keyof HeaderFooterLayout, value: PrintSlotContent) => void;
  addPrinter: (printer: PrinterConfig) => void;
  removePrinter: (name: string) => void;
  setDefaultPrinter: (name: string) => void;
  togglePrinterActive: (name: string) => void;
  loadFromServer: () => Promise<void>;
  saveToServer: () => Promise<void>;
}

/** Debounce timer for auto-saving to backend */
let _saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveToServer() {
  if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(() => {
    useHospitalConfigStore.getState().saveToServer();
  }, 500);
}

export const useHospitalConfigStore = create<HospitalConfig>()(
  persist(
    (set, get) => ({
      hospitalName: 'City Diagnostic',
      brandNameSecondary: '',
      servicesList: 'Ultrasound|X-Ray|CT Scan|MRI|Pathology',
      address1: '123 Medical Complex, MG Road',
      address2: 'Near City Hospital',
      address3: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '+91 22 1234 5678',
      email: 'info@citydiagnostic.com',
      website: '',
      registration: '',
      timezone: 'Asia/Kolkata',

      logoDataUrl: '',

      showLogoInHeader: true,
      showLogoInFooter: false,

      headerLayout: { left: 'logo', center: 'name', right: 'address' },
      footerLayout: { left: 'custom', center: 'none', right: 'custom' },
      enableFooter: false,
      customHeaderText: '',
      customFooterText: 'Printed by: ADMIN',
      customHeaderLeft: '',
      customHeaderCenter: '',
      customHeaderRight: '',
      customFooterLeft: '',
      customFooterCenter: 'Printed by: ADMIN',
      customFooterRight: '',

      viewportBorderColor: '#333333',

      // Print settings
      headerFontSize: 10,
      headerFontColor: '#000000',
      footerFontSize: 8,
      footerFontColor: '#999999',
      printBlackBg: false,
      printBorderEnabled: true,
      printBorderColor: '#333333',
      printCountWarningAt: 50,
      popupOnImageReceived: false,
      exportFolderNameMode: 'patientName' as const,
      modalityUS: false,
      metadataPrintRefBy: true,
      metadataPrintStudyName: true,
      metadataPrintAccessNo: true,
      metadataPrintPatientId: true,
      metadataPrintAge: true,
      metadataPrintSex: true,
      metadataPrintModality: true,

      // Header customization
      headerBgColor: '#ffffff',
      headerBorderBottomColor: '#2563eb',
      headerShowLogo: true,
      headerLogoSize: 60,
      headerLogoPosition: 'left' as const,
      headerLogoShape: 'circle' as const,
      headerShowName: true,
      headerNameFontSize: 18,
      headerNameColor: '#1e3a5f',
      headerNameAlign: 'left' as const,
      headerSecondaryNameColor: '#2563eb',
      headerShowServices: true,
      headerServicesFontSize: 10,
      headerServicesColor: '#1a1a1a',
      headerServicesAlign: 'left' as const,
      headerShowAddress: true,
      headerAddressFontSize: 8,
      headerAddressColor: '#2563eb',
      headerAddressAlign: 'left' as const,
      headerShowContact: true,
      headerContactFontSize: 9,
      headerContactColor: '#333333',
      headerContactAlign: 'left' as const,

      // Footer customization
      footerBgColor: '#ffffff',
      footerBorderTopColor: '#cccccc',

      metadataPrintPatientName: true,
      gapBetweenImages: 60,
      sixSpotsSpacing: 'equalSpace' as const,
      logoLeftEnabled: false,
      logoLeftHeight: 0.5,
      logoRightPath: '',
      bannerLandscapePath: '',
      marginTop: 140,
      marginLeft: 140,
      marginRight: 140,
      marginImageTop: 140,
      marginImageBottom: 140,

      printers: [
        { name: 'HP LaserJet Pro M404dn', displayName: 'HP LaserJet Pro', type: 'Laser', isDefault: true, isActive: true },
        { name: 'Sony UP-D898MD', displayName: 'Sony Medical Printer', type: 'DICOM Thermal', isDefault: false, isActive: true },
        { name: 'Microsoft Print to PDF', displayName: 'Print to PDF', type: 'Virtual', isDefault: false, isActive: true },
      ],

      syncing: false,
      lastSyncError: null,

      updateField: (key, value) => {
        set((s) => ({ ...s, [key]: value }));
        // If this field maps to a backend key, debounce-save
        if (key in FIELD_TO_BACKEND_KEY) {
          debouncedSaveToServer();
        }
      },

      setLogo: (dataUrl) => {
        set({ logoDataUrl: dataUrl });
        debouncedSaveToServer();
      },
      removeLogo: () => {
        set({ logoDataUrl: '' });
        debouncedSaveToServer();
      },

      updateHeaderLayout: (slot, value) =>
        set((s) => ({ headerLayout: { ...s.headerLayout, [slot]: value } })),

      updateFooterLayout: (slot, value) =>
        set((s) => ({ footerLayout: { ...s.footerLayout, [slot]: value } })),

      addPrinter: (printer) =>
        set((s) => ({ printers: [...s.printers, printer] })),

      removePrinter: (name) =>
        set((s) => ({ printers: s.printers.filter((p) => p.name !== name) })),

      setDefaultPrinter: (name) =>
        set((s) => ({
          printers: s.printers.map((p) => ({ ...p, isDefault: p.name === name })),
        })),

      togglePrinterActive: (name) =>
        set((s) => ({
          printers: s.printers.map((p) =>
            p.name === name ? { ...p, isActive: !p.isActive } : p
          ),
        })),

      loadFromServer: async () => {
        set({ syncing: true, lastSyncError: null });
        try {
          const settings = await settingsService.getSettings();
          const patch: Record<string, any> = {};
          for (const [backendKey, value] of Object.entries(settings)) {
            const storeField = BACKEND_KEY_TO_FIELD[backendKey];
            if (storeField) {
              // Convert string booleans
              if (storeField === 'showLogoInHeader' || storeField === 'showLogoInFooter') {
                patch[storeField] = value === true || value === 'true' || value === '1';
              } else {
                patch[storeField] = value;
              }
            }
          }
          set({ ...patch, syncing: false });
        } catch (err: any) {
          console.error('[hospitalConfigStore] loadFromServer failed:', err);
          set({ syncing: false, lastSyncError: err?.message || 'Failed to load settings from server' });
        }
      },

      saveToServer: async () => {
        const state = get();
        set({ syncing: true, lastSyncError: null });
        try {
          const payload: Record<string, string | boolean> = {};
          for (const [storeField, backendKey] of Object.entries(FIELD_TO_BACKEND_KEY)) {
            const value = (state as any)[storeField];
            payload[backendKey] = value;
          }
          await settingsService.updateSettings(payload);
          set({ syncing: false });
        } catch (err: any) {
          console.error('[hospitalConfigStore] saveToServer failed:', err);
          set({ syncing: false, lastSyncError: err?.message || 'Failed to save settings to server' });
        }
      },
    }),
    {
      name: 'hospital-config',
      partialize: (state) => {
        const {
          updateField, setLogo, removeLogo, updateHeaderLayout, updateFooterLayout,
          addPrinter, removePrinter, setDefaultPrinter, togglePrinterActive,
          loadFromServer, saveToServer,
          syncing, lastSyncError,
          ...rest
        } = state;
        return rest;
      },
    }
  )
);

/** Helper: get formatted address string */
export function getFormattedAddress(config: HospitalConfig): string {
  const parts = [config.address1, config.address2, config.address3].filter(Boolean);
  const cityLine = [config.city, config.state, config.pincode].filter(Boolean).join(', ');
  if (cityLine) parts.push(cityLine);
  return parts.join(', ');
}

/** Helper: render a print slot to HTML string (used for footer) */
export function renderPrintSlot(
  slot: PrintSlotContent,
  config: HospitalConfig,
  isCustomText?: string,
  isFooter?: boolean
): string {
  const fontSize = isFooter ? config.footerFontSize : config.headerFontSize;
  const fontColor = isFooter ? config.footerFontColor : config.headerFontColor;
  const baseStyle = `font-size:${fontSize}px;color:${fontColor}`;
  switch (slot) {
    case 'logo':
      return config.logoDataUrl
        ? `<img src="${config.logoDataUrl}" style="max-height:40px;max-width:120px;object-fit:contain" />`
        : '';
    case 'name':
      return `<div style="font-weight:600;${baseStyle}">${config.hospitalName}</div>`;
    case 'address':
      return `<div style="${baseStyle}">${getFormattedAddress(config)}</div>${config.phone ? `<div style="${baseStyle}">${config.phone}</div>` : ''}`;
    case 'custom':
      return `<div style="${baseStyle}">${isCustomText || ''}</div>`;
    case 'none':
    default:
      return '';
  }
}

/** SVG icons for print header (inline, no external deps) */
const HEADER_ICONS = {
  scanner: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M4 21h16"/><path d="M12 16v5"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  email: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  globe: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
};

/** Build the new brand header HTML for print output */
export function buildBrandHeaderHtml(config: HospitalConfig): string {
  const services = (config.servicesList || '').split('|').filter(Boolean);
  const servicesHtml = services.map(s => `<span>${s.trim()}</span>`).join('<span style="margin:0 4px;color:#999">|</span>');
  const address = getFormattedAddress(config).toUpperCase();

  const logoSize = config.headerLogoSize || 60;
  const logoRadius = config.headerLogoShape === 'square' ? '6px' : '50%';
  const logoHtml = (config.headerShowLogo !== false && config.logoDataUrl)
    ? `<img src="${config.logoDataUrl}" style="width:${logoSize}px;height:${logoSize}px;border-radius:${logoRadius};object-fit:cover;border:1px solid #ddd" />`
    : '';

  const contactParts: string[] = [];
  if (config.phone) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.phone}<span>${config.phone}</span></span>`);
  if (config.email) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.email}<span>${config.email}</span></span>`);
  if (config.website) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.globe}<span>${config.website}</span></span>`);
  const contactFs = config.headerContactFontSize || 9;
  const contactCol = config.headerContactColor || '#333';
  const contactAlign = config.headerContactAlign || 'left';
  const contactJustify = contactAlign === 'left' ? 'flex-start' : contactAlign === 'right' ? 'flex-end' : 'center';
  const contactHtml = (config.headerShowContact !== false && contactParts.length > 0)
    ? `<div style="display:flex;align-items:center;justify-content:${contactJustify};gap:10px;font-size:${contactFs}px;color:${contactCol};flex-wrap:wrap;margin-top:2px">${contactParts.join('')}</div>`
    : '';

  const bgCol = config.headerBgColor || '#ffffff';
  const borderCol = config.headerBorderBottomColor || '#2563eb';
  const nameFs = config.headerNameFontSize || 18;
  const nameCol = config.headerNameColor || '#1e3a5f';
  const secCol = config.headerSecondaryNameColor || '#2563eb';
  const nameAlign = config.headerNameAlign || 'left';
  const svcFs = config.headerServicesFontSize || 10;
  const svcCol = config.headerServicesColor || '#1a1a1a';
  const svcAlign = config.headerServicesAlign || 'left';
  const svcJustify = svcAlign === 'left' ? 'flex-start' : svcAlign === 'right' ? 'flex-end' : 'center';
  const addrFs = config.headerAddressFontSize || 8;
  const addrCol = config.headerAddressColor || '#2563eb';
  const addrAlign = config.headerAddressAlign || 'left';
  const logoPos = config.headerLogoPosition || 'left';

  const logoDivHtml = logoHtml ? `<div style="flex:0 0 auto;display:flex;justify-content:center;align-items:center">${logoHtml}</div>` : '';

  const namePart = config.headerShowName !== false
    ? `<div style="margin-bottom:2px;text-align:${nameAlign}"><span style="font-size:${nameFs}px;font-weight:800;color:${nameCol}">${config.hospitalName}</span>${config.brandNameSecondary ? `<span style="font-size:${nameFs}px;font-weight:400;color:${secCol};margin-left:5px">${config.brandNameSecondary}</span>` : ''}</div>`
    : '';
  const svcPart = (config.headerShowServices !== false && services.length > 0)
    ? `<div style="display:flex;align-items:center;justify-content:${svcJustify};gap:3px;font-size:${svcFs}px;font-weight:600;color:${svcCol};flex-wrap:wrap;margin-bottom:2px">${HEADER_ICONS.scanner}<span style="margin-right:2px"></span>${servicesHtml}</div>`
    : '';
  const addrPart = (config.headerShowAddress !== false && address)
    ? `<div style="font-size:${addrFs}px;color:${addrCol};text-transform:uppercase;letter-spacing:0.5px;text-align:${addrAlign}">${address}</div>`
    : '';

  const textDivHtml = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:stretch;line-height:1.3">
      ${namePart}${svcPart}${addrPart}${contactHtml}
    </div>`;

  let innerHtml: string;
  if (logoPos === 'right') innerHtml = `${textDivHtml}${logoDivHtml}`;
  else if (logoPos === 'center') innerHtml = `<div style="flex:1"></div>${logoDivHtml}<div style="flex:1">${namePart}${svcPart}${addrPart}${contactHtml}</div>`;
  else innerHtml = `${logoDivHtml}${textDivHtml}`;

  return `<div style="display:flex;align-items:center;padding:6px 12px;border-bottom:2px solid ${borderCol};background:${bgCol};font-family:Arial,Helvetica,sans-serif;gap:10px">
    ${innerHtml}
  </div>`;
}

/** Build customized footer HTML for print output */
export function buildFooterHtml(config: HospitalConfig): string {
  const l = renderPrintSlot(config.footerLayout.left, config, config.customFooterLeft, true);
  const c = renderPrintSlot(config.footerLayout.center, config, config.customFooterCenter, true);
  const r = renderPrintSlot(config.footerLayout.right, config, config.customFooterRight, true);
  const bgCol = config.footerBgColor || '#ffffff';
  const borderCol = config.footerBorderTopColor || '#cccccc';
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 15px;border-top:1px solid ${borderCol};background:${bgCol};font-size:8px;color:#666"><div>${l}</div><div style="text-align:center">${c}</div><div style="text-align:right">${r}</div></div>`;
}
