/**
 * brandingHtml.js — Plain-JS port of DCM's buildBrandHeaderHtml() and buildFooterHtml().
 * Pure functions: (config) => htmlString.  No DOM, no React.
 *
 * Verbatim logic from dcm/www/src/stores/hospitalConfigStore.ts lines 432–506.
 */

/** SVG icons for print header (inline, no external deps) */
const HEADER_ICONS = {
  scanner: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M4 21h16"/><path d="M12 16v5"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  email: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFormattedAddress(cfg) {
  const parts = [cfg.address1, cfg.address2, cfg.address3].filter(Boolean);
  const cityLine = [cfg.city, cfg.state, cfg.pincode].filter(Boolean).join(', ');
  if (cityLine) parts.push(cityLine);
  return parts.join(', ');
}

function renderPrintSlot(slot, cfg, customText, isFooter) {
  const fontSize = isFooter ? cfg.footerFontSize : 10;
  const fontColor = isFooter ? cfg.footerFontColor : '#000';
  const baseStyle = `font-size:${fontSize}px;color:${fontColor}`;
  switch (slot) {
    case 'logo':
      return cfg.logoDataUrl
        ? `<img src="${cfg.logoDataUrl}" style="max-height:40px;max-width:120px;object-fit:contain" />`
        : '';
    case 'name':
      return `<div style="font-weight:600;${baseStyle}">${escapeHtml(cfg.hospitalName)}</div>`;
    case 'address':
      return `<span style="${baseStyle}">${escapeHtml(getFormattedAddress(cfg))}</span>`;
    case 'custom':
      return `<div style="${baseStyle}">${escapeHtml(customText || '')}</div>`;
    case 'none':
    default:
      return '';
  }
}

/**
 * Build the branded header HTML — verbatim port of DCM's buildBrandHeaderHtml().
 */
function buildBrandHeaderHtml(cfg) {
  if (!cfg || !cfg.hospitalName) return '';

  const services = (cfg.servicesList || '').split('|').filter(Boolean);
  const servicesHtml = services.map(s => `<span>${escapeHtml(s.trim())}</span>`).join('<span style="margin:0 4px;color:#999">|</span>');
  const address = getFormattedAddress(cfg).toUpperCase();

  const logoSize = cfg.headerLogoSize || 60;
  const logoRadius = cfg.headerLogoShape === 'square' ? '6px' : '50%';
  const logoHtml = (cfg.headerShowLogo !== false && cfg.logoDataUrl)
    ? `<img src="${cfg.logoDataUrl}" style="width:${logoSize}px;height:${logoSize}px;border-radius:${logoRadius};object-fit:cover;border:1px solid #ddd" />`
    : '';

  const contactParts = [];
  if (cfg.phone) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.phone}<span>${escapeHtml(cfg.phone)}</span></span>`);
  if (cfg.email) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.email}<span>${escapeHtml(cfg.email)}</span></span>`);
  if (cfg.website) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.globe}<span>${escapeHtml(cfg.website)}</span></span>`);
  const contactFs = cfg.headerContactFontSize || 9;
  const contactCol = cfg.headerContactColor || '#333';
  const contactAlign = cfg.headerContactAlign || 'left';
  const contactJustify = contactAlign === 'left' ? 'flex-start' : contactAlign === 'right' ? 'flex-end' : 'center';
  const contactHtml = (cfg.headerShowContact !== false && contactParts.length > 0)
    ? `<div style="display:flex;align-items:center;justify-content:${contactJustify};gap:10px;font-size:${contactFs}px;color:${contactCol};flex-wrap:wrap;margin-top:2px">${contactParts.join('')}</div>`
    : '';

  const bgCol = cfg.headerBgColor || '#ffffff';
  const borderCol = cfg.headerBorderBottomColor || '#2563eb';
  const nameFs = cfg.headerNameFontSize || 18;
  const nameCol = cfg.headerNameColor || '#1e3a5f';
  const secCol = cfg.headerSecondaryNameColor || '#2563eb';
  const nameAlign = cfg.headerNameAlign || 'left';
  const svcFs = cfg.headerServicesFontSize || 10;
  const svcCol = cfg.headerServicesColor || '#1a1a1a';
  const svcAlign = cfg.headerServicesAlign || 'left';
  const svcJustify = svcAlign === 'left' ? 'flex-start' : svcAlign === 'right' ? 'flex-end' : 'center';
  const addrFs = cfg.headerAddressFontSize || 8;
  const addrCol = cfg.headerAddressColor || '#2563eb';
  const addrAlign = cfg.headerAddressAlign || 'left';
  const logoPos = cfg.headerLogoPosition || 'left';

  const logoBoxWidth = Math.max(74, logoSize + 20);
  const logoDivHtml = logoHtml ? `<div style="flex:0 0 ${logoBoxWidth}px;display:flex;justify-content:center;align-items:center">${logoHtml}</div>` : '';
  const logoSpacerHtml = logoHtml ? `<div style="flex:0 0 ${logoBoxWidth}px"></div>` : '';

  const namePart = cfg.headerShowName !== false
    ? `<div style="margin-bottom:2px;text-align:${nameAlign}"><span style="font-size:${nameFs}px;font-weight:800;color:${nameCol}">${escapeHtml(cfg.hospitalName)}</span>${cfg.brandNameSecondary ? `<span style="font-size:${nameFs}px;font-weight:400;color:${secCol};margin-left:5px">${escapeHtml(cfg.brandNameSecondary)}</span>` : ''}</div>`
    : '';
  const svcPart = (cfg.headerShowServices !== false && services.length > 0)
    ? `<div style="display:flex;align-items:center;justify-content:${svcJustify};gap:3px;font-size:${svcFs}px;font-weight:600;color:${svcCol};flex-wrap:wrap;margin-bottom:2px">${HEADER_ICONS.scanner}<span style="margin-right:2px"></span>${servicesHtml}</div>`
    : '';
  const addrPart = (cfg.headerShowAddress !== false && address)
    ? `<div style="font-size:${addrFs}px;color:${addrCol};text-transform:uppercase;letter-spacing:0.5px;text-align:${addrAlign}">${escapeHtml(address)}</div>`
    : '';

  const textDivHtml = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:stretch;line-height:1.25;min-width:0">
      ${namePart}${svcPart}${addrPart}${contactHtml}
    </div>`;

  let innerHtml;
  if (logoPos === 'right') innerHtml = `${logoSpacerHtml}${textDivHtml}${logoDivHtml}`;
  else if (logoPos === 'center') innerHtml = `<div style="flex:1"></div>${logoDivHtml}<div style="flex:1">${namePart}${svcPart}${addrPart}${contactHtml}</div>`;
  else innerHtml = `${logoDivHtml}${textDivHtml}${logoSpacerHtml}`;

  return `<div style="display:flex;align-items:center;padding:7px 12px;border-bottom:2px solid ${borderCol};background:${bgCol};font-family:Arial,Helvetica,sans-serif;gap:8px">
    ${innerHtml}
  </div>`;
}

/**
 * Build the branded footer HTML — verbatim port of DCM's buildFooterHtml().
 */
function buildFooterHtml(cfg) {
  if (!cfg) return '';
  const fl = cfg.footerLayout || { left: 'none', center: 'none', right: 'none' };
  const l = renderPrintSlot(fl.left, cfg, cfg.customFooterLeft, true);
  const c = renderPrintSlot(fl.center, cfg, cfg.customFooterCenter, true);
  const r = renderPrintSlot(fl.right, cfg, cfg.customFooterRight, true);
  const bgCol = cfg.footerBgColor || '#ffffff';
  const borderCol = cfg.footerBorderTopColor || '#cccccc';
  const fontSize = cfg.footerFontSize || 8;
  const fontColor = cfg.footerFontColor || '#666666';
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 12px;border-top:1px solid ${borderCol};background:${bgCol};font-size:${fontSize}px;color:${fontColor};white-space:nowrap;overflow:hidden"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l}</div><div style="text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c}</div><div style="text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r}</div></div>`;
}

/**
 * Estimate branded header height in mm for page layout calculations.
 * Uses logo size and content presence to approximate.
 */
function estimateHeaderHeightMm(cfg) {
  if (!cfg || !cfg.hospitalName) return 0;
  const logoMm = (cfg.headerShowLogo !== false && cfg.logoDataUrl)
    ? (cfg.headerLogoSize || 60) / 3.78   // px → mm at 96 dpi
    : 0;
  // Text stack: name (~6mm) + services (~4mm) + address (~3mm) + contact (~3mm) + padding (~4mm)
  let textMm = 4; // padding
  if (cfg.headerShowName !== false) textMm += Math.max(5, (cfg.headerNameFontSize || 18) / 3);
  if (cfg.headerShowServices !== false && cfg.servicesList) textMm += 4;
  if (cfg.headerShowAddress !== false) textMm += 3;
  if (cfg.headerShowContact !== false && (cfg.phone || cfg.email || cfg.website)) textMm += 3;
  return Math.max(logoMm + 4, textMm);
}

module.exports = { buildBrandHeaderHtml, buildFooterHtml, estimateHeaderHeightMm, getFormattedAddress, escapeHtml };
