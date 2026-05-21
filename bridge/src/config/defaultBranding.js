/**
 * Default branding config — mirrors DCM's HospitalConfig defaults.
 * Shared shape so a user can copy branding JSON between DCM and Bridge.
 */

const DEFAULT_BRANDING = {
  // Hospital identity
  hospitalName: '',
  brandNameSecondary: '',
  servicesList: '',

  // Address & contact
  address1: '',
  address2: '',
  address3: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  website: '',

  // Logo (base64 data URL)
  logoDataUrl: '',

  // Header section
  headerShowLogo: true,
  headerLogoSize: 52,
  headerLogoPosition: 'left',   // 'left' | 'center' | 'right'
  headerLogoShape: 'circle',    // 'circle' | 'square'
  headerShowName: true,
  headerNameFontSize: 22,
  headerNameColor: '#4f8fe8',
  headerNameAlign: 'center',
  headerSecondaryNameColor: '#c7d2fe',
  headerShowServices: true,
  headerServicesFontSize: 10,
  headerServicesColor: '#f8fafc',
  headerServicesAlign: 'center',
  headerShowAddress: true,
  headerAddressFontSize: 8,
  headerAddressColor: '#93c5fd',
  headerAddressAlign: 'center',
  headerShowContact: true,
  // Per-field header visibility (default = on; user can untick to push a
  // field to the footer only).
  headerShowPhone:   true,
  headerShowEmail:   true,
  headerShowWebsite: true,
  headerContactFontSize: 8,
  headerContactColor: '#d1d5db',
  headerContactAlign: 'center',
  headerBgColor: '#8c2c2c',
  headerBorderBottomColor: '#6d81ab',

  // Footer — per-field placement matrix is the source of truth. Each row
  // says which slot (none / left / center / right) the field appears in.
  // The renderer collects per-slot fields in canonical order so users can
  // tick boxes without thinking about ordering.
  enableFooter: true,
  footerSlotName:     'left',
  footerSlotServices: 'none',
  footerSlotAddress:  'center',
  footerSlotPhone:    'right',
  footerSlotEmail:    'none',
  footerSlotWebsite:  'right',
  footerSlotLogo:     'none',
  customFooterLeft:   '',
  customFooterCenter: '',
  customFooterRight:  '',
  // Legacy free-form layout. Kept so old saved configs still render
  // until they're re-saved through the new UI.
  footerLayout: {
    left:   [{ type: 'name' }],
    center: [{ type: 'address' }],
    right:  [{ type: 'phone' }, { type: 'website' }],
  },
  footerFontSize: 8,
  footerFontColor: '#fdf7f7',
  footerBgColor: '#d01111',
  footerBorderTopColor: '#c62a2a',

  // Print page settings
  printBlackBg: true,
  printBorderEnabled: true,
  printBorderColor: '#333333',
  gapBetweenImages: 1,
  marginTop: 5,
  marginLeft: 5,
  marginRight: 5,

  // Patient metadata on print
  metadataPrintPatientName: true,
  metadataPrintPatientId: true,
  metadataPrintAge: true,
  metadataPrintSex: true,
  metadataPrintModality: true,
  metadataPrintStudyName: true,
  metadataPrintAccessNo: true,
  metadataPrintRefBy: true,
};

module.exports = { DEFAULT_BRANDING };
