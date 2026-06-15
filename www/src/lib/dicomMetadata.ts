import { cornerstone, cornerstoneWADOImageLoader } from './cornerstoneSetup';

export const SECONDARY_CAPTURE_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.7';
export const FILTER_SECONDARY_STORAGE_KEY = 'dicom-filter-secondary';

interface PixelSpacing {
  rowPixelSpacing: number;
  columnPixelSpacing: number;
  source: 'pixel-spacing' | 'imager-pixel-spacing' | 'nominal-scanned-pixel-spacing' | 'us-region-calibration';
}

function finitePositive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function getNumberValues(dataSet: any, tag: string, count = 2): number[] | null {
  if (!dataSet?.elements?.[tag]) return null;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const value = finitePositive(dataSet.floatString?.(tag, i) ?? dataSet.string?.(tag, i));
    if (value === null) return null;
    out.push(value);
  }
  return out;
}

function getSignedFloat(dataSet: any, tag: string): number | null {
  if (!dataSet?.elements?.[tag]) return null;
  return finiteNumber(
    dataSet.double?.(tag, 0)
    ?? dataSet.float?.(tag, 0)
    ?? dataSet.floatString?.(tag, 0)
    ?? dataSet.string?.(tag, 0),
  );
}

function imageIdToUri(imageId: string): string {
  const withoutScheme = imageId.startsWith('wadouri:') ? imageId.slice('wadouri:'.length) : imageId;
  return withoutScheme.replace(/[?&]frame=\d+$/i, '');
}

function normalizeUid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const uid = value.replace(/\0/g, '').replace(/\\0/g, '').trim();
  return uid ? uid : null;
}

export function isSecondaryImageFilterEnabled(): boolean {
  try {
    const stored = localStorage.getItem(FILTER_SECONDARY_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

export async function getDataSetForImageId(imageId: string): Promise<any | null> {
  const manager = (cornerstoneWADOImageLoader as any)?.wadouri?.dataSetCacheManager;
  if (!manager || !imageId) return null;

  const uri = imageIdToUri(imageId);
  try {
    return manager.get?.(uri) || manager.get?.(imageId) || await manager.load(uri, undefined, imageId);
  } catch {
    return null;
  }
}

export async function getSopClassUid(imageId: string): Promise<string | null> {
  const dataSet = await getDataSetForImageId(imageId);
  return normalizeUid(dataSet?.string?.('x00080016')) || normalizeUid(dataSet?.string?.('x00020002'));
}

export async function isSecondaryCaptureImage(imageId: string): Promise<boolean> {
  return (await getSopClassUid(imageId)) === SECONDARY_CAPTURE_SOP_CLASS_UID;
}

export async function filterSecondaryCaptureImageIds<T extends { imageId: string }>(
  entries: T[],
): Promise<{ kept: T[]; removed: T[] }> {
  if (!isSecondaryImageFilterEnabled() || entries.length === 0) {
    return { kept: entries, removed: [] };
  }

  const checks = await Promise.all(entries.map(async (entry) => ({
    entry,
    secondary: await isSecondaryCaptureImage(entry.imageId),
  })));

  return {
    kept: checks.filter((row) => !row.secondary).map((row) => row.entry),
    removed: checks.filter((row) => row.secondary).map((row) => row.entry),
  };
}

function spacingFromUsRegion(dataSet: any): PixelSpacing | null {
  const sequence = dataSet?.elements?.x00186011;
  const items = sequence?.items;
  if (!Array.isArray(items)) return null;

  for (const item of items) {
    const region = item?.dataSet;
    if (!region) continue;
    const unitsX = region.uint16?.('x00186024');
    const unitsY = region.uint16?.('x00186026');
    const deltaX = getSignedFloat(region, 'x0018602c');
    const deltaY = getSignedFloat(region, 'x0018602e');

    // DICOM US region physical unit code 3 is centimeters; convert to mm.
    // Code 2 is millimeters. Ignore time/velocity/frequency regions here.
    const xFactor = unitsX === 3 ? 10 : unitsX === 2 ? 1 : null;
    const yFactor = unitsY === 3 ? 10 : unitsY === 2 ? 1 : null;
    if (xFactor === null || yFactor === null || deltaX === null || deltaY === null) continue;

    const columnPixelSpacing = Math.abs(deltaX) * xFactor;
    const rowPixelSpacing = Math.abs(deltaY) * yFactor;
    if (rowPixelSpacing > 0 && columnPixelSpacing > 0) {
      return { rowPixelSpacing, columnPixelSpacing, source: 'us-region-calibration' };
    }
  }

  return null;
}

export function getPixelSpacingFromDataSet(dataSet: any): PixelSpacing | null {
  const standard = getNumberValues(dataSet, 'x00280030', 2);
  if (standard) {
    return { rowPixelSpacing: standard[0], columnPixelSpacing: standard[1], source: 'pixel-spacing' };
  }

  const pixelMeasures = dataSet?.elements?.x00289110?.items?.[0]?.dataSet;
  const enhanced = getNumberValues(pixelMeasures, 'x00280030', 2);
  if (enhanced) {
    return { rowPixelSpacing: enhanced[0], columnPixelSpacing: enhanced[1], source: 'pixel-spacing' };
  }

  const usRegion = spacingFromUsRegion(dataSet);
  if (usRegion) return usRegion;

  const imager = getNumberValues(dataSet, 'x00181164', 2);
  if (imager) {
    return { rowPixelSpacing: imager[0], columnPixelSpacing: imager[1], source: 'imager-pixel-spacing' };
  }

  const nominalScanned = getNumberValues(dataSet, 'x00182010', 2);
  if (nominalScanned) {
    return { rowPixelSpacing: nominalScanned[0], columnPixelSpacing: nominalScanned[1], source: 'nominal-scanned-pixel-spacing' };
  }

  return null;
}

export async function applyDicomPixelSpacing(image: any): Promise<void> {
  if (!image?.imageId) return;

  const dataSet = await getDataSetForImageId(image.imageId);
  const spacing = getPixelSpacingFromDataSet(dataSet);
  if (!spacing) return;

  image.rowPixelSpacing = spacing.rowPixelSpacing;
  image.columnPixelSpacing = spacing.columnPixelSpacing;

  const existing = cornerstone.metaData.get('imagePlaneModule', image.imageId) || {};
  cornerstone.metaData.addProvider((type: string, imageId: string) => {
    if (type !== 'imagePlaneModule' || imageId !== image.imageId) return undefined;
    return {
      ...existing,
      rowPixelSpacing: spacing.rowPixelSpacing,
      columnPixelSpacing: spacing.columnPixelSpacing,
    };
  }, 10000);
}
