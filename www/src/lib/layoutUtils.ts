import { LAYOUT_CATEGORIES, type Orientation, type ViewerLayout } from '@/types/viewer';

export interface LayoutLike {
  spots: number;
  cols: number;
  rows: number;
}

export const AUTO_PORTRAIT_SPOTS = new Set([2, 6, 8, 15, 18]);
export const AUTO_LANDSCAPE_SPOTS = new Set([4, 9, 12]);

const PREFERRED_LAYOUT_BY_COUNT: Record<number, string> = {
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

export function getAllLayouts(categories = LAYOUT_CATEGORIES): ViewerLayout[] {
  return categories.flatMap((category) => category.layouts);
}

export function findLayoutById(id: string, layouts = getAllLayouts()): ViewerLayout | null {
  return layouts.find((layout) => layout.id === id) ?? null;
}

export function getLayoutAreaNames(areas?: string): string[] {
  if (!areas) return [];
  return [...new Set(areas.replace(/['"]/g, '').split(/\s+/).filter(Boolean))];
}

export function getIntrinsicLayoutOrientation(layout: Pick<LayoutLike, 'cols' | 'rows'>): Orientation {
  return layout.cols > layout.rows ? 'landscape' : 'portrait';
}

export function getAutoOrientationForSpotCount(
  spotCount: number,
  layout: Pick<LayoutLike, 'cols' | 'rows'>,
): Orientation {
  if (AUTO_PORTRAIT_SPOTS.has(spotCount)) return 'portrait';
  if (AUTO_LANDSCAPE_SPOTS.has(spotCount)) return 'landscape';
  return getIntrinsicLayoutOrientation(layout);
}

export function getAutoOrientationForLayout(layout: LayoutLike): Orientation {
  return getAutoOrientationForSpotCount(layout.spots, layout);
}

export function autoSelectLayoutForImageCount(
  imageCount: number,
  layouts = getAllLayouts(),
): { layout: ViewerLayout; orientation: Orientation } {
  const preferredId = PREFERRED_LAYOUT_BY_COUNT[imageCount];
  const preferred = preferredId ? findLayoutById(preferredId, layouts) : null;
  if (preferred) {
    return { layout: preferred, orientation: getAutoOrientationForLayout(preferred) };
  }

  const sorted = [...layouts].sort((a, b) => {
    if (a.spots !== b.spots) return a.spots - b.spots;
    const aAreaPenalty = a.areas ? 1 : 0;
    const bAreaPenalty = b.areas ? 1 : 0;
    if (aAreaPenalty !== bAreaPenalty) return aAreaPenalty - bAreaPenalty;
    const aWaste = Math.abs(a.cols - a.rows);
    const bWaste = Math.abs(b.cols - b.rows);
    return aWaste - bWaste;
  });

  const best = sorted.find((layout) => layout.spots >= imageCount) ?? sorted[sorted.length - 1];
  return { layout: best, orientation: getAutoOrientationForLayout(best) };
}

export function getLayoutGridTemplate(layout: ViewerLayout): {
  columns: string;
  rows: string;
  areas?: string;
} {
  return {
    columns: layout.gridTemplate?.columns ?? `repeat(${layout.cols}, 1fr)`,
    rows: layout.gridTemplate?.rows ?? `repeat(${layout.rows}, 1fr)`,
    areas: layout.areas,
  };
}
