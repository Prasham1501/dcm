/**
 * Layout helpers — copied from dcm/www/src/lib/layoutUtils.ts
 * so the bridge resolves layouts the same way the DCM viewer does.
 */

const { LAYOUT_CATEGORIES } = require('./layouts');

const AUTO_PORTRAIT_SPOTS = new Set([2, 6, 8, 15, 18]);
const AUTO_LANDSCAPE_SPOTS = new Set([4, 9, 12]);

const PREFERRED_LAYOUT_BY_COUNT = {
  1: '1x1',
  2: '2x1',
  3: '1+2-left',
  4: '2x2',
  5: '2+2+1',
  6: '2x3',
  7: '3+2+2',
  8: '2x4',
  9: '3x3',
  10: '3x4-11',
  11: '3x4-11',
  12: '4x3',
  15: '3x5',
  18: '3x6',
};

function getAllLayouts(categories = LAYOUT_CATEGORIES) {
  return categories.flatMap((c) => c.layouts);
}

function findLayoutById(id, layouts = getAllLayouts()) {
  return layouts.find((l) => l.id === id) || null;
}

function getIntrinsicLayoutOrientation(layout) {
  return layout.cols > layout.rows ? 'landscape' : 'portrait';
}

function getAutoOrientationForSpotCount(spotCount, layout) {
  if (AUTO_PORTRAIT_SPOTS.has(spotCount)) return 'portrait';
  if (AUTO_LANDSCAPE_SPOTS.has(spotCount)) return 'landscape';
  return getIntrinsicLayoutOrientation(layout);
}

function getAutoOrientationForLayout(layout) {
  return getAutoOrientationForSpotCount(layout.spots, layout);
}

function autoSelectLayoutForImageCount(imageCount, layouts = getAllLayouts()) {
  const preferredId = PREFERRED_LAYOUT_BY_COUNT[imageCount];
  const preferred = preferredId ? findLayoutById(preferredId, layouts) : null;
  if (preferred) return { layout: preferred, orientation: getAutoOrientationForLayout(preferred) };

  const sorted = [...layouts].sort((a, b) => {
    if (a.spots !== b.spots) return a.spots - b.spots;
    const aAreaPenalty = a.areas ? 1 : 0;
    const bAreaPenalty = b.areas ? 1 : 0;
    if (aAreaPenalty !== bAreaPenalty) return aAreaPenalty - bAreaPenalty;
    const aWaste = Math.abs(a.cols - a.rows);
    const bWaste = Math.abs(b.cols - b.rows);
    return aWaste - bWaste;
  });

  const best = sorted.find((l) => l.spots >= imageCount) || sorted[sorted.length - 1];
  return { layout: best, orientation: getAutoOrientationForLayout(best) };
}

function getLayoutGridTemplate(layout) {
  return {
    columns: (layout.gridTemplate && layout.gridTemplate.columns) || `repeat(${layout.cols}, 1fr)`,
    rows: (layout.gridTemplate && layout.gridTemplate.rows) || `repeat(${layout.rows}, 1fr)`,
    areas: layout.areas,
  };
}

function getLayoutAreaNames(areas) {
  if (!areas) return [];
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

/**
 * Bridge-specific resolution: start from saved slot.layoutId. If it doesn't
 * have enough spots for the received image count, fall back to auto-selection.
 */
function resolveLayoutForJob(savedLayoutId, imageCount) {
  const all = getAllLayouts();

  // "auto" mode: always pick the best layout for the actual image count
  if (!savedLayoutId || savedLayoutId === 'auto') {
    return autoSelectLayoutForImageCount(imageCount, all);
  }

  const saved = findLayoutById(savedLayoutId, all);
  if (saved && saved.spots >= imageCount) {
    return { layout: saved, orientation: getAutoOrientationForLayout(saved) };
  }
  return autoSelectLayoutForImageCount(imageCount, all);
}

module.exports = {
  AUTO_PORTRAIT_SPOTS,
  AUTO_LANDSCAPE_SPOTS,
  PREFERRED_LAYOUT_BY_COUNT,
  getAllLayouts,
  findLayoutById,
  getLayoutAreaNames,
  getIntrinsicLayoutOrientation,
  getAutoOrientationForSpotCount,
  getAutoOrientationForLayout,
  autoSelectLayoutForImageCount,
  getLayoutGridTemplate,
  resolveLayoutForJob,
};
