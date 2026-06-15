/**
 * paperSizes.js - single source of truth for paper/film dimensions.
 *
 * De-duplicates the PAPER_DIMS_MM tables that used to live in both
 * printWorker.js and layoutBuilder.js, and centralises the Electron page-size
 * helpers.
 *
 * Two kinds of size live here:
 *   - SELECTABLE target papers - the 8 sizes a user can pick per slot
 *     (default paper + film-to-paper mapping targets).
 *   - DICOM film source sizes - the physical film dimensions a modality may
 *     send (used to render a "Same as film" job at its literal size).
 */

// Physical dimensions in millimetres (portrait: w < h where applicable).
const PAPER_DIMS_MM = {
  // Selectable target papers (the 8 the UI offers).
  A4:     { w: 210,   h: 297 },
  A5:     { w: 148,   h: 210 },
  B4JIS:  { w: 257,   h: 364 },
  B5JIS:  { w: 182,   h: 257 },
  ENV9:   { w: 98.4,  h: 225.4 },
  ENV10:  { w: 104.8, h: 241.3 },
  CSHEET: { w: 431.8, h: 558.8 },   // ANSI C  17 x 22 in
  DSHEET: { w: 558.8, h: 863.6 },   // ANSI D  22 x 34 in

  // DICOM film source sizes (not selectable, but renderable for "SAME").
  A3:          { w: 297,   h: 420 },
  '8INX10IN':  { w: 203.2, h: 254 },
  '10INX12IN': { w: 254,   h: 304.8 },
  '10INX14IN': { w: 254,   h: 355.6 },
  '11INX14IN': { w: 279.4, h: 355.6 },
  '11INX17IN': { w: 279.4, h: 431.8 },
  '14INX14IN': { w: 355.6, h: 355.6 },
  '14INX17IN': { w: 355.6, h: 431.8 },
  '24CMX24CM': { w: 240,   h: 240 },
  '24CMX30CM': { w: 240,   h: 300 },
};

// The exact 8 sizes the user can choose (order = dropdown order).
const SELECTABLE_PAPER_IDS = ['A4', 'A5', 'B4JIS', 'B5JIS', 'ENV9', 'ENV10', 'CSHEET', 'DSHEET'];

// Human labels for the selectable papers.
const PAPER_LABELS = {
  A4:     'A4',
  A5:     'A5',
  B4JIS:  'B4 (JIS)',
  B5JIS:  'B5 (JIS)',
  ENV9:   'Envelope #9',
  ENV10:  'Envelope #10',
  CSHEET: 'C Sheet',
  DSHEET: 'D Sheet',
};

// Windows DEVMODE (DMPAPER_*) codes — for reference / future driver hinting.
const WIN_PAPER_CODES = {
  A4: 9, A5: 11, B4JIS: 12, B5JIS: 13, ENV9: 19, ENV10: 20, CSHEET: 24, DSHEET: 25,
};

// DICOM Film Size IDs to prefill the per-slot mapping table.
const FILM_SIZE_PRESETS = [
  '8INX10IN', '10INX12IN', '10INX14IN', '11INX14IN', '11INX17IN',
  '14INX14IN', '14INX17IN', '24CMX24CM', '24CMX30CM', 'A4', 'A3',
];

// Sizes Electron / Chromium accept by name in `pageSize`. Everything else must
// be passed as explicit micron dimensions.
const ELECTRON_NAMED = new Set(['A4', 'A5', 'A3', 'Letter', 'Legal']);

function getPaperDimsMm(id) {
  return PAPER_DIMS_MM[id] || null;
}

function isNamedSize(id) {
  return ELECTRON_NAMED.has(id);
}

/**
 * Convert a paper id into the value Electron's webContents.print `pageSize`
 * option expects: a named string for A4/A5/etc, or explicit micron dimensions
 * for custom sizes (B4 JIS, envelopes, C/D sheets, DICOM film sizes).
 */
function electronPageSize(id, landscape = false) {
  if (isNamedSize(id)) return id;
  const dims = PAPER_DIMS_MM[id];
  if (!dims) return 'A4';
  const w = landscape ? dims.h : dims.w;
  const h = landscape ? dims.w : dims.h;
  return { width: Math.round(w * 1000), height: Math.round(h * 1000) };
}

/**
 * Convert a paper id into the value Electron's printToPDF option expects.
 * Unlike webContents.print(), printToPDF custom sizes are expressed in inches.
 */
function pdfPageSize(id, landscape = false) {
  if (isNamedSize(id)) return id;
  const dims = PAPER_DIMS_MM[id];
  if (!dims) return 'A4';
  const w = landscape ? dims.h : dims.w;
  const h = landscape ? dims.w : dims.h;
  return {
    width: +(w / 25.4).toFixed(4),
    height: +(h / 25.4).toFixed(4),
  };
}

module.exports = {
  PAPER_DIMS_MM,
  SELECTABLE_PAPER_IDS,
  PAPER_LABELS,
  WIN_PAPER_CODES,
  FILM_SIZE_PRESETS,
  ELECTRON_NAMED,
  getPaperDimsMm,
  isNamedSize,
  electronPageSize,
  pdfPageSize,
};
