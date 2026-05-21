/**
 * brandingHtml.ts — TS twin of bridge/src/render/brandingHtml.js for live preview.
 * Pure functions: (config) => htmlString.  No React.
 */

import type { HospitalBranding } from '@/types/bridge';

const HEADER_ICONS = {
  scanner: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><path d="M4 21h16"/><path d="M12 16v5"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  email: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  globe: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
};

function esc(s: string | undefined): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFormattedAddress(cfg: HospitalBranding): string {
  const parts = [cfg.address1, cfg.address2, cfg.address3].filter(Boolean);
  const cityLine = [cfg.city, cfg.state, cfg.pincode].filter(Boolean).join(', ');
  if (cityLine) parts.push(cityLine);
  return parts.join(', ');
}

/**
 * Render one footer item. The footer supports the full set of hospital fields
 * (name, services, address, phone, email, website, logo, custom) — each slot
 * picker can stack any number of these on top of each other.
 */
function renderFooterItem(item: { type: string; customText?: string }, cfg: HospitalBranding): string {
  const fs = cfg.footerFontSize || 8;
  const fc = cfg.footerFontColor || '#666';
  const base = `font-size:${fs}px;color:${fc};line-height:1.25`;
  switch (item.type) {
    case 'logo':
      return cfg.logoDataUrl
        ? `<img src="${cfg.logoDataUrl}" style="max-height:32px;max-width:140px;object-fit:contain" />`
        : '';
    case 'name':
      return cfg.hospitalName ? `<div style="font-weight:600;${base}">${esc(cfg.hospitalName)}</div>` : '';
    case 'services':
      return cfg.servicesList ? `<div style="${base}">${esc(cfg.servicesList.split('|').join(' • '))}</div>` : '';
    case 'address':
      return `<div style="${base}">${esc(getFormattedAddress(cfg))}</div>`;
    case 'phone':
      return cfg.phone   ? `<div style="${base}">☎ ${esc(cfg.phone)}</div>`   : '';
    case 'email':
      return cfg.email   ? `<div style="${base}">✉ ${esc(cfg.email)}</div>`   : '';
    case 'website':
      return cfg.website ? `<div style="${base}">🌐 ${esc(cfg.website)}</div>` : '';
    case 'custom':
      return item.customText ? `<div style="${base}">${esc(item.customText)}</div>` : '';
    case 'none':
    default:
      return '';
  }
}

/** Convert an array of items (or a legacy single string) into a stacked HTML block. */
function renderFooterStack(slotValue: any, customLegacy: string, cfg: HospitalBranding): string {
  const items: { type: string; customText?: string }[] = Array.isArray(slotValue)
    ? slotValue
    : (slotValue && slotValue !== 'none'
        ? [{ type: slotValue, customText: customLegacy }]
        : []);
  return items.map((it) => renderFooterItem(it, cfg)).filter(Boolean).join('');
}

/** Build the three footer columns from the per-field placement matrix
 *  (`footerSlotName` / `footerSlotPhone` / …).  Items in the same slot stack
 *  in this canonical order so users don't have to think about ordering. */
const FOOTER_FIELD_ORDER: { key: string; type: string }[] = [
  { key: 'footerSlotLogo',     type: 'logo' },
  { key: 'footerSlotName',     type: 'name' },
  { key: 'footerSlotServices', type: 'services' },
  { key: 'footerSlotAddress',  type: 'address' },
  { key: 'footerSlotPhone',    type: 'phone' },
  { key: 'footerSlotEmail',    type: 'email' },
  { key: 'footerSlotWebsite',  type: 'website' },
];
function footerItemsFromPlacement(cfg: HospitalBranding):
    { left: { type: string; customText?: string }[]; center: any[]; right: any[] } | null {
  const anySet = FOOTER_FIELD_ORDER.some((f) => (cfg as any)[f.key] && (cfg as any)[f.key] !== 'none');
  const hasCustom = !!(cfg.customFooterLeft || cfg.customFooterCenter || cfg.customFooterRight);
  if (!anySet && !hasCustom) return null;
  const out: any = { left: [], center: [], right: [] };
  for (const f of FOOTER_FIELD_ORDER) {
    const slot = (cfg as any)[f.key];
    if (slot && slot !== 'none' && out[slot]) out[slot].push({ type: f.type });
  }
  if (cfg.customFooterLeft)   out.left.push({   type: 'custom', customText: cfg.customFooterLeft });
  if (cfg.customFooterCenter) out.center.push({ type: 'custom', customText: cfg.customFooterCenter });
  if (cfg.customFooterRight)  out.right.push({  type: 'custom', customText: cfg.customFooterRight });
  return out;
}

export function buildBrandHeaderHtml(cfg: HospitalBranding): string {
  if (!cfg || !cfg.hospitalName) return '';

  const services = (cfg.servicesList || '').split('|').filter(Boolean);
  const servicesHtml = services.map(s => `<span>${esc(s.trim())}</span>`).join('<span style="margin:0 4px;color:#999">|</span>');
  const address = getFormattedAddress(cfg).toUpperCase();

  const logoSize = cfg.headerLogoSize || 80;
  // `contain` so the whole logo fits; max-width capped at 1.8× the height so
  // wordmark-style logos don't dominate the header.
  const logoHtml = (cfg.headerShowLogo !== false && cfg.logoDataUrl)
    ? `<img src="${cfg.logoDataUrl}" style="height:${logoSize}px;max-width:${Math.round(logoSize * 1.8)}px;width:auto;object-fit:contain;display:block" />`
    : '';

  // Per-field header visibility. Falls back to the legacy master
  // `headerShowContact` flag when the per-field props haven't been set yet
  // (older saved configs); user can later toggle Phone/Email/Website
  // individually to push any one of them to footer-only.
  const masterContact = cfg.headerShowContact !== false;
  const showPhone   = (cfg as any).headerShowPhone   ?? masterContact;
  const showEmail   = (cfg as any).headerShowEmail   ?? masterContact;
  const showWebsite = (cfg as any).headerShowWebsite ?? masterContact;
  const contactParts: string[] = [];
  if (showPhone   && cfg.phone)   contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.phone}<span>${esc(cfg.phone)}</span></span>`);
  if (showEmail   && cfg.email)   contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.email}<span>${esc(cfg.email)}</span></span>`);
  if (showWebsite && cfg.website) contactParts.push(`<span style="display:inline-flex;align-items:center;gap:3px">${HEADER_ICONS.globe}<span>${esc(cfg.website)}</span></span>`);
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

  const logoBoxWidth = Math.max(100, Math.round(logoSize * 1.8) + 16);
  const logoDivHtml = logoHtml ? `<div style="flex:0 0 ${logoBoxWidth}px;display:flex;justify-content:center;align-items:center">${logoHtml}</div>` : '';
  const logoSpacerHtml = logoHtml ? `<div style="flex:0 0 ${logoBoxWidth}px"></div>` : '';

  const namePart = cfg.headerShowName !== false
    ? `<div style="margin-bottom:2px;text-align:${nameAlign}"><span style="font-size:${nameFs}px;font-weight:800;color:${nameCol}">${esc(cfg.hospitalName)}</span>${cfg.brandNameSecondary ? `<span style="font-size:${nameFs}px;font-weight:400;color:${secCol};margin-left:5px">${esc(cfg.brandNameSecondary)}</span>` : ''}</div>`
    : '';
  // Services line — plain text only; the old stethoscope/scanner glyph was
  // removed per product spec.
  const svcPart = (cfg.headerShowServices !== false && services.length > 0)
    ? `<div style="display:flex;align-items:center;justify-content:${svcJustify};gap:3px;font-size:${svcFs}px;font-weight:600;color:${svcCol};flex-wrap:wrap;margin-bottom:2px">${servicesHtml}</div>`
    : '';
  const addrPart = (cfg.headerShowAddress !== false && address)
    ? `<div style="font-size:${addrFs}px;color:${addrCol};text-transform:uppercase;letter-spacing:0.5px;text-align:${addrAlign}">${esc(address)}</div>`
    : '';

  const textDivHtml = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:stretch;line-height:1.25;min-width:0">
      ${namePart}${svcPart}${addrPart}${contactHtml}
    </div>`;

  let innerHtml: string;
  if (logoPos === 'right') innerHtml = `${logoSpacerHtml}${textDivHtml}${logoDivHtml}`;
  else if (logoPos === 'center') innerHtml = `<div style="flex:1"></div>${logoDivHtml}<div style="flex:1">${namePart}${svcPart}${addrPart}${contactHtml}</div>`;
  else innerHtml = `${logoDivHtml}${textDivHtml}${logoSpacerHtml}`;

  return `<div style="display:flex;align-items:center;padding:7px 12px;border-bottom:2px solid ${borderCol};background:${bgCol};font-family:Arial,Helvetica,sans-serif;gap:8px">
    ${innerHtml}
  </div>`;
}

export function buildFooterHtml(cfg: HospitalBranding): string {
  if (!cfg) return '';
  // Prefer the per-field placement matrix when it's been touched; fall
  // back to the legacy free-form footerLayout so older configs still work
  // until they're re-saved through the new UI.
  const placed = footerItemsFromPlacement(cfg);
  const fl: any = placed || cfg.footerLayout || { left: [], center: [], right: [] };
  const l = renderFooterStack(fl.left,   (cfg as any).customFooterLeft   || '', cfg);
  const c = renderFooterStack(fl.center, (cfg as any).customFooterCenter || '', cfg);
  const r = renderFooterStack(fl.right,  (cfg as any).customFooterRight  || '', cfg);
  const bgCol = cfg.footerBgColor || '#ffffff';
  const borderCol = cfg.footerBorderTopColor || '#cccccc';
  const fontSize = cfg.footerFontSize || 8;
  const fontColor = cfg.footerFontColor || '#666666';
  // align-items:flex-start so vertically-stacked items align cleanly per column.
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 12px;border-top:1px solid ${borderCol};background:${bgCol};font-size:${fontSize}px;color:${fontColor}">
    <div style="flex:1;text-align:left">${l}</div>
    <div style="flex:1;text-align:center">${c}</div>
    <div style="flex:1;text-align:right">${r}</div>
  </div>`;
}
