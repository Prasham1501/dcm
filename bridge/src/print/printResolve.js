/**
 * printResolve.js — pure resolution helpers used by the print pipeline.
 *
 * Kept free of any `electron` import so it can be unit-tested directly with
 * `node --test`.
 */

const { PAPER_DIMS_MM } = require('../render/paperSizes');

/**
 * Decide which paper size a DICOM Print (Film Box) job should print on.
 *
 *   - If the slot maps this film size to a target paper → use that paper.
 *   - If the slot maps it to "SAME" → keep the literal film size (if its
 *     dimensions are known), otherwise fall back to the slot default.
 *   - If there's no mapping → use the slot's default paper.
 *
 * @param {object} slot         PrinterSlot (paperSize + optional filmSizeMap)
 * @param {string} filmSizeId   DICOM Film Size ID, e.g. "14INX17IN"
 * @returns {string} a paper/size id resolvable via PAPER_DIMS_MM
 */
function resolveTargetPaper(slot, filmSizeId) {
  const fallback = (slot && slot.paperSize) || 'A4';
  const id = String(filmSizeId || '').toUpperCase().replace(/\s+/g, '');
  const map = (slot && slot.filmSizeMap) || {};
  const mapped = map[id];

  if (mapped && mapped !== 'SAME') return mapped;
  if (mapped === 'SAME') return PAPER_DIMS_MM[id] ? id : fallback;
  return fallback;
}

/**
 * Resolve the branding object a slot should print with.
 *
 * Order: the slot's assigned branding → the config default → the first
 * branding → the legacy single `config.branding` → null.
 *
 * @param {object} config  BridgeConfig (brandings[] + defaultBrandingId)
 * @param {object} slot    PrinterSlot (brandingId)
 */
function resolveBranding(config, slot) {
  if (!config) return null;
  const list = Array.isArray(config.brandings) ? config.brandings : [];
  if (list.length === 0) return config.branding || null;

  const wantId = slot && slot.brandingId;
  if (wantId) {
    const byId = list.find((b) => b && b.id === wantId);
    if (byId) return byId;
  }
  const def = list.find((b) => b && b.id === config.defaultBrandingId);
  return def || list[0] || config.branding || null;
}

/**
 * Resolve a slot's print contrast (gamma LUT) to a normalised, clamped shape.
 *
 *   - Disabled, missing, or a no-op gamma (1.0) → { enabled: false }.
 *   - Otherwise → { enabled: true, gamma } with gamma clamped to [0.3, 3].
 *
 * gamma > 1 deepens the dark/black tones (denser print); gamma < 1 lightens.
 *
 * @param {object} slot  PrinterSlot (lutEnabled + lutGamma)
 */
function resolveLut(slot) {
  if (!slot || !slot.lutEnabled) return { enabled: false, gamma: 1 };
  let g = Number(slot.lutGamma);
  if (!Number.isFinite(g)) g = 1;
  g = Math.min(3, Math.max(0.3, g));
  // A gamma of exactly 1 is a no-op — don't pay for a filter pass.
  if (Math.abs(g - 1) < 1e-3) return { enabled: false, gamma: 1 };
  return { enabled: true, gamma: g };
}

module.exports = { resolveTargetPaper, resolveBranding, resolveLut };
