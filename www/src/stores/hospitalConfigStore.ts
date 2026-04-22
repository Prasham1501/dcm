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
      hospitalName: 'City Diagnostic Center',
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

/** Helper: render a print slot to HTML string */
export function renderPrintSlot(
  slot: PrintSlotContent,
  config: HospitalConfig,
  isCustomText?: string
): string {
  switch (slot) {
    case 'logo':
      return config.logoDataUrl
        ? `<img src="${config.logoDataUrl}" style="max-height:40px;max-width:120px;object-fit:contain" />`
        : '';
    case 'name':
      return `<div style="font-weight:600">${config.hospitalName}</div>`;
    case 'address':
      return `<div>${getFormattedAddress(config)}</div>${config.phone ? `<div>${config.phone}</div>` : ''}`;
    case 'custom':
      return `<div>${isCustomText || ''}</div>`;
    case 'none':
    default:
      return '';
  }
}
